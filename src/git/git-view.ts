/**
 * Git View - 비개발자 친화 Git 워크플로 UI
 */

import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { GitOperationResult } from "./git-types";
import type IntegrationAIPlugin from "../main";
import { GitState } from "./git-state";
import { GitViewState, GIT_ICONS } from "./git-types";
import {
  renderStatusPanel,
  renderSyncPanel,
  renderFileList,
  renderCommitForm,
  renderWorkspacePanel,
  renderReviewPanel,
  renderConflictPanel,
} from "./components";

export const GIT_VIEW_TYPE = "integration-git-view";

type TabId = "home" | "workspace" | "review" | "conflict";

interface TabConfig {
  id: TabId;
  icon: string;
  label: string;
}

const TABS: TabConfig[] = [
  { id: "home", icon: "🏠", label: "홈" },
  { id: "workspace", icon: "🌿", label: "작업 공간" },
  { id: "review", icon: "📝", label: "검토 요청" },
  { id: "conflict", icon: "⚠️", label: "충돌 해결" },
];

export class GitView extends ItemView {
  private plugin: IntegrationAIPlugin;
  private gitState: GitState | null = null;
  private unsubscribe: (() => void) | null = null;
  private activeTab: TabId = "home";
  private gitContentEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: IntegrationAIPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return GIT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "협업";
  }

  getIcon(): string {
    return "users";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("git-view-container");

    // Git 저장소 경로 (vault)
    const vaultPath = (this.app.vault.adapter as { basePath?: string }).basePath;

    if (!vaultPath) {
      container.createEl("div", {
        cls: "git-error-container",
        text: "Vault 경로를 찾을 수 없습니다"
      });
      return;
    }

    // GitState 초기화
    this.gitState = new GitState(vaultPath);

    // 상태 변경 구독
    this.unsubscribe = this.gitState.subscribe((state) => {
      this.render(state);
    });

    // 초기 상태 로드
    await this.gitState.refresh();

    // 자동 새로고침 시작 (30초)
    this.gitState.startAutoRefresh(30000);
  }

  async onClose(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.gitState) {
      this.gitState.destroy();
      this.gitState = null;
    }
  }

  private render(state: GitViewState): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();

    // 헤더
    this.renderHeader(container, state);

    // 탭 네비게이션
    this.renderTabs(container, state);

    // 컨텐츠 영역
    this.gitContentEl = container.createEl("div", { cls: "git-content" });
    this.renderContent(this.gitContentEl, state);
  }

  private renderHeader(container: HTMLElement, state: GitViewState): void {
    const header = container.createEl("div", { cls: "git-view-header" });

    // 제목
    const title = header.createEl("div", { cls: "git-view-title" });
    title.createEl("span", { cls: "git-view-icon", text: GIT_ICONS.sync });
    title.createEl("span", { text: "협업" });

    // 헤더 액션
    const actions = header.createEl("div", { cls: "git-header-actions" });

    // 새로고침 버튼
    const refreshBtn = actions.createEl("button", {
      cls: "git-header-btn",
      attr: { title: "새로고침" }
    });
    refreshBtn.createEl("span", { text: "🔄" });

    refreshBtn.onclick = async () => {
      refreshBtn.addClass("git-btn-spin");
      await this.gitState?.refresh();
      refreshBtn.removeClass("git-btn-spin");
    };

    // 설정 버튼
    const settingsBtn = actions.createEl("button", {
      cls: "git-header-btn",
      attr: { title: "설정" }
    });
    settingsBtn.createEl("span", { text: "⚙️" });

    settingsBtn.onclick = () => {
      // 설정 탭 열기
      (this.app as any).setting.open();
    };
  }

  private renderTabs(container: HTMLElement, state: GitViewState): void {
    const tabBar = container.createEl("div", { cls: "git-tab-bar" });

    for (const tab of TABS) {
      const tabBtn = tabBar.createEl("button", {
        cls: `git-tab ${this.activeTab === tab.id ? "git-tab-active" : ""}`
      });

      tabBtn.createEl("span", { cls: "git-tab-icon", text: tab.icon });
      tabBtn.createEl("span", { cls: "git-tab-label", text: tab.label });

      // 충돌 탭에 배지 표시
      if (tab.id === "conflict" && state.status?.conflicted.length) {
        tabBtn.createEl("span", {
          cls: "git-tab-badge git-badge-danger",
          text: String(state.status.conflicted.length)
        });
      }

      tabBtn.onclick = () => {
        this.activeTab = tab.id;
        if (this.gitState) {
          this.render(this.gitState.getState());
        }
      };
    }
  }

  private renderContent(container: HTMLElement, state: GitViewState): void {
    if (!this.gitState) return;

    switch (this.activeTab) {
      case "home":
        this.renderHomeTab(container, state);
        break;
      case "workspace":
        renderWorkspacePanel(container, state, this.gitState, this.app);
        break;
      case "review":
        renderReviewPanel(container, state, this.gitState);
        break;
      case "conflict":
        renderConflictPanel(container, state, this.gitState);
        break;
    }
  }

  private renderHomeTab(container: HTMLElement, state: GitViewState): void {
    if (!this.gitState) return;

    // Git 저장소가 아닌 경우 초기화 UI 표시
    if (state.status && !state.status.isRepo) {
      this.renderInitPanel(container);
      return;
    }

    // 상태 패널
    const statusSection = container.createEl("div", { cls: "git-section" });
    statusSection.createEl("div", { cls: "git-section-header", text: "📊 현재 상태" });
    renderStatusPanel(statusSection, state, this.gitState);

    // 빠른 작업 패널
    const syncSection = container.createEl("div", { cls: "git-section" });
    syncSection.createEl("div", { cls: "git-section-header", text: "🚀 빠른 작업" });
    renderSyncPanel(syncSection, state, this.gitState);

    // 파일 목록
    const fileSection = container.createEl("div", { cls: "git-section" });
    renderFileList(fileSection, state, this.gitState);

    // 커밋 폼
    const commitSection = container.createEl("div", { cls: "git-section" });
    renderCommitForm(commitSection, state, this.gitState);
  }

  private renderInitPanel(container: HTMLElement): void {
    const initPanel = container.createEl("div", { cls: "git-init-panel" });

    // 아이콘과 제목
    const hero = initPanel.createEl("div", { cls: "git-init-hero" });
    hero.createEl("div", { cls: "git-init-icon", text: "📁" });
    hero.createEl("h2", { text: "Git 저장소가 아닙니다" });
    hero.createEl("p", {
      cls: "git-init-desc",
      text: "이 폴더에서 협업 기능을 사용하려면 Git 저장소를 초기화해야 합니다."
    });

    // 설명
    const info = initPanel.createEl("div", { cls: "git-init-info" });
    info.createEl("h4", { text: "💡 Git이란?" });
    info.createEl("p", {
      text: "Git은 파일의 변경 이력을 관리하고, 팀원들과 협업할 수 있게 해주는 도구입니다."
    });

    const benefits = info.createEl("ul", { cls: "git-init-benefits" });
    benefits.createEl("li", { text: "파일 변경 이력 추적" });
    benefits.createEl("li", { text: "이전 버전으로 되돌리기" });
    benefits.createEl("li", { text: "팀원들과 동시 작업" });
    benefits.createEl("li", { text: "작업 검토 및 승인 프로세스" });

    // 초기화 버튼
    const actions = initPanel.createEl("div", { cls: "git-init-actions" });

    const initBtn = actions.createEl("button", {
      cls: "git-btn git-btn-primary git-btn-large"
    });
    initBtn.createEl("span", { cls: "git-btn-icon", text: "🚀" });
    initBtn.createEl("span", { text: "Git 저장소 시작하기" });

    initBtn.onclick = async () => {
      if (!this.gitState) return;

      initBtn.disabled = true;
      initBtn.addClass("git-btn-loading");

      const result = await this.gitState.init();

      initBtn.removeClass("git-btn-loading");
      initBtn.disabled = false;

      const icon = result.success ? GIT_ICONS.success : GIT_ICONS.error;
      new Notice(`${icon} ${result.message}`);

      if (result.success) {
        // 상태 새로고침
        await this.gitState.refresh();
      }
    };

    // 주의사항
    const note = initPanel.createEl("div", { cls: "git-init-note" });
    note.createEl("p", {
      text: "참고: 팀과 협업하려면 초기화 후 원격 저장소(GitHub, Bitbucket 등)를 연결해야 합니다."
    });
  }
}
