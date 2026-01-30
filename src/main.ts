import { Plugin, WorkspaceLeaf } from "obsidian";
import {
  TERMINAL_VIEW_TYPE,
  AGENT_VIEW_TYPE,
  DEFAULT_SETTINGS,
  ICONS,
  type IntegrationSettings,
} from "./constants";
import { TerminalView, initElectronBridge } from "./terminal";
import { AgentView } from "./agent";
import { IntegrationSettingsTab } from "./settings/settings-tab";

/**
 * SaaS DocOps Plugin
 *
 * Obsidian 플러그인. 비개발자도 Claude Code 풀기능을 GUI에서 사용.
 *
 * 하이브리드 아키텍처:
 * - Agent Panel (ACP): 채팅 UI, @notename 참조, 일상적 작업
 * - Terminal Panel (PTY): Claude Code CLI 직접 실행, vim/git 등 TUI
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

    // 2. View 등록
    this.registerView(TERMINAL_VIEW_TYPE, (leaf) => new TerminalView(leaf, this));
    this.registerView(AGENT_VIEW_TYPE, (leaf) => new AgentView(leaf, this));

    // 3. 리본 아이콘 추가
    this.addRibbonIcon(ICONS.terminal, "터미널 열기", () => {
      this.activateView(TERMINAL_VIEW_TYPE);
    });

    this.addRibbonIcon(ICONS.agent, "에이전트 열기", () => {
      this.activateView(AGENT_VIEW_TYPE);
    });

    // 4. 명령어 등록
    this.addCommand({
      id: "open-terminal",
      name: "터미널 열기",
      callback: () => this.activateView(TERMINAL_VIEW_TYPE),
    });

    this.addCommand({
      id: "open-agent",
      name: "에이전트 열기",
      callback: () => this.activateView(AGENT_VIEW_TYPE),
    });

    // 5. 설정 탭 추가
    this.addSettingTab(new IntegrationSettingsTab(this.app, this));

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
      // 이미 열려있으면 해당 leaf 사용
      leaf = leaves[0];
    } else {
      // 없으면 오른쪽 사이드바에 생성
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
   * 환경변수 가져오기 (터미널/에이전트 프로세스용)
   */
  getEnvironmentVariables(): Record<string, string> {
    const env: Record<string, string> = {};

    if (this.settings.anthropicApiKey) {
      env.ANTHROPIC_API_KEY = this.settings.anthropicApiKey;
    }

    if (this.settings.slackBotToken) {
      env.SLACK_BOT_TOKEN = this.settings.slackBotToken;
    }

    if (this.settings.atlassianApiToken) {
      env.ATLASSIAN_API_TOKEN = this.settings.atlassianApiToken;
    }

    return env;
  }
}
