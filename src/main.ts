import { Plugin, WorkspaceLeaf } from "obsidian";
import {
  TERMINAL_VIEW_TYPE,
  GIT_VIEW_TYPE,
  EXPLORER_VIEW_TYPE,
  DEFAULT_SETTINGS,
  ICONS,
  type IntegrationSettings,
} from "./constants";
import { TerminalView, initElectronBridge } from "./terminal";
import { IntegrationSettingsTab } from "./settings/settings-tab";
import { SetupWizardModal, EnvironmentChecker } from "./wizard";
import { GitView } from "./git";
import { ExplorerView } from "./explorer";

// Import styles (injected via esbuild)
import "./styles.css";

/**
 * SaaS DocOps Plugin
 *
 * Obsidian 플러그인. 비개발자도 Claude Code 풀기능을 GUI에서 사용.
 *
 * Terminal Panel (PTY): Claude Code CLI 직접 실행, vim/git 등 TUI
 */
export default class IntegrationAIPlugin extends Plugin {
  settings!: IntegrationSettings;

  async onload(): Promise<void> {
    console.log("Loading SaaS DocOps...");

    // 1. 설정 로드
    await this.loadSettings();

    // 2. Electron Bridge 초기화 (node-pty 경로 설정)
    const pluginDir = this.manifest.dir;
    if (pluginDir) {
      const basePath = (this.app.vault.adapter as { basePath?: string }).basePath;
      if (basePath) {
        const fullPluginPath = require("path").join(basePath, pluginDir);
        initElectronBridge(fullPluginPath);
      }
    }

    // 3. View 등록
    this.registerView(TERMINAL_VIEW_TYPE, (leaf) => new TerminalView(leaf, this));
    this.registerView(GIT_VIEW_TYPE, (leaf) => new GitView(leaf, this));
    this.registerView(EXPLORER_VIEW_TYPE, (leaf) => new ExplorerView(leaf, this));

    // 4. 리본 아이콘 추가
    this.addRibbonIcon(ICONS.terminal, "터미널 열기", () => {
      this.activateView(TERMINAL_VIEW_TYPE);
    });

    this.addRibbonIcon(ICONS.git, "프로젝트 관리", () => {
      this.activateView(GIT_VIEW_TYPE);
    });

    this.addRibbonIcon(ICONS.explorer, "파일 탐색기", () => {
      this.activateView(EXPLORER_VIEW_TYPE);
    });

    // 5. 명령어 등록
    this.addCommand({
      id: "open-terminal",
      name: "터미널 열기",
      icon: "terminal-square",
      callback: () => this.activateView(TERMINAL_VIEW_TYPE),
    });

    this.addCommand({
      id: "open-git",
      name: "프로젝트 관리 열기",
      icon: "folder-kanban",
      callback: () => this.activateView(GIT_VIEW_TYPE),
    });

    this.addCommand({
      id: "open-explorer",
      name: "파일 탐색기 열기",
      icon: "folder-tree",
      callback: () => this.activateView(EXPLORER_VIEW_TYPE),
    });

    this.addCommand({
      id: "open-setup-wizard",
      name: "설정 마법사 열기",
      icon: "wand",
      callback: () => new SetupWizardModal(this.app, this).open(),
    });

    // 6. 설정 탭 추가
    this.addSettingTab(new IntegrationSettingsTab(this.app, this));

    // 7. 첫 실행 시 설정 마법사 표시
    if (!this.settings.wizardCompleted) {
      // 약간의 지연 후 마법사 열기 (UI가 완전히 로드된 후)
      setTimeout(() => {
        new SetupWizardModal(this.app, this).open();
      }, 500);
    }

    console.log("SaaS DocOps loaded successfully!");
  }

  onunload(): void {
    console.log("Unloading SaaS DocOps...");
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * View 활성화 (없으면 생성)
   */
  async activateView(viewType: string): Promise<void> {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(viewType);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: viewType, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  /**
   * 환경변수 가져오기 (터미널 프로세스용)
   *
   * 우선순위 (낮은 것이 높은 것을 override):
   * 1. MCP config의 env 필드 (user level: ~/.claude.json)
   * 2. MCP config의 env 필드 (project level: .mcp.json)
   * 3. Shell config (~/.zshrc 등)
   */
  async getEnvironmentVariables(): Promise<Record<string, string>> {
    const env: Record<string, string> = {};
    const vaultPath = (this.app.vault.adapter as { basePath?: string }).basePath;

    // 1. Read env vars from MCP config (user level first)
    const userChecker = new EnvironmentChecker();
    userChecker.setConfigLevel("user");
    const userServers = await userChecker.getAllMCPServers();

    for (const server of Object.values(userServers)) {
      if (server.env) {
        Object.assign(env, server.env);
      }
    }

    // 2. Project level overrides user level
    if (vaultPath) {
      const projectChecker = new EnvironmentChecker();
      projectChecker.setConfigLevel("project", vaultPath);
      const projectServers = await projectChecker.getAllMCPServers();

      for (const server of Object.values(projectServers)) {
        if (server.env) {
          Object.assign(env, server.env);
        }
      }
    }

    // 3. Read ANTHROPIC_API_KEY from shell config (highest priority)
    const checker = new EnvironmentChecker();
    const apiKeyInfo = await checker.checkAnthropicApiKey();
    if (apiKeyInfo.found && apiKeyInfo.value) {
      env.ANTHROPIC_API_KEY = apiKeyInfo.value;
    }

    return env;
  }

  /**
   * 설정 마법사 열기
   */
  openSetupWizard(): void {
    new SetupWizardModal(this.app, this).open();
  }
}
