/**
 * Git View - 비개발자 친화 Git 워크플로 UI
 */

import { ItemView, WorkspaceLeaf, Notice, setIcon } from "obsidian";
import { GitOperationResult } from "./git-types";
import type IntegrationAIPlugin from "../main";
import { GitState } from "./git-state";
import { GitViewState } from "./git-types";
import { ICON_NAMES } from "../shared/icons";
import {
  renderStatusPanel,
  renderSyncPanel,
  renderFileList,
  renderCommitForm,
  renderWorkspacePanel,
  renderReviewPanel,
  renderConflictPanel,
  renderHistoryPanel,
  renderRepoSelector,
  renderUninitializedSubmoduleMessage,
} from "./components";

export const GIT_VIEW_TYPE = "integration-git-view";

type TabId = "home" | "workspace" | "review" | "conflict" | "history";

interface TabConfig {
  id: TabId;
  iconName: string;
  label: string;
  description?: string;
}

const TABS: TabConfig[] = [
  { id: "home", iconName: ICON_NAMES.home, label: "홈" },
  { id: "workspace", iconName: ICON_NAMES.branch, label: "작업 공간", description: "브랜치 · 독립된 작업 영역" },
  { id: "review", iconName: ICON_NAMES.pullRequest, label: "검토 요청", description: "PR · 변경사항 검토 요청" },
  { id: "history", iconName: ICON_NAMES.history, label: "저장 이력", description: "과거 버전 · 되돌리기" },
  { id: "conflict", iconName: ICON_NAMES.conflict, label: "충돌 해결" },
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
    return "프로젝트 관리";
  }

  getIcon(): string {
    return ICON_NAMES.users;
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

    // 저장소 선택 (submodule이 있을 때만 표시)
    if (this.gitState && state.submodules.length > 0) {
      const repoSelectorContainer = container.createEl("div", { cls: "git-repo-selector-container" });
      renderRepoSelector(repoSelectorContainer, state, this.gitState, this.app);
    }

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
    const titleIcon = title.createEl("span", { cls: "git-view-icon" });
    setIcon(titleIcon, ICON_NAMES.kanban);
    title.createEl("span", { text: "프로젝트 관리" });

    // 헤더 액션
    const actions = header.createEl("div", { cls: "git-header-actions" });

    // 새로고침 버튼
    const refreshBtn = actions.createEl("button", {
      cls: "git-header-btn",
      attr: { title: "새로고침" }
    });
    const refreshIcon = refreshBtn.createEl("span", { cls: "git-header-btn-icon" });
    setIcon(refreshIcon, ICON_NAMES.refresh);
    refreshBtn.createEl("span", { cls: "git-header-btn-text", text: "새로고침" });

    refreshBtn.onclick = async () => {
      refreshBtn.addClass("git-btn-spin");
      await this.gitState?.refresh();
      refreshBtn.removeClass("git-btn-spin");
    };

    // 마법사 버튼
    const wizardBtn = actions.createEl("button", {
      cls: "git-header-btn",
      attr: { title: "설정 마법사" }
    });
    const wizardIcon = wizardBtn.createEl("span", { cls: "git-header-btn-icon" });
    setIcon(wizardIcon, ICON_NAMES.wand);
    wizardBtn.createEl("span", { cls: "git-header-btn-text", text: "설정 마법사" });

    wizardBtn.onclick = () => {
      this.plugin.openSetupWizard();
    };

    // 설정 버튼
    const settingsBtn = actions.createEl("button", {
      cls: "git-header-btn",
      attr: { title: "설정" }
    });
    const settingsIcon = settingsBtn.createEl("span", { cls: "git-header-btn-icon" });
    setIcon(settingsIcon, ICON_NAMES.settings);
    settingsBtn.createEl("span", { cls: "git-header-btn-text", text: "설정" });

    settingsBtn.onclick = () => {
      // 플러그인 설정 탭으로 바로 이동
      const setting = (this.app as any).setting;
      setting.open();
      setting.openTabById("saas-docops");
    };
  }

  private renderTabs(container: HTMLElement, state: GitViewState): void {
    const tabBar = container.createEl("div", { cls: "git-tab-bar" });

    for (const tab of TABS) {
      const isActive = this.activeTab === tab.id;
      const tabWrapper = tabBar.createEl("div", {
        cls: `git-tab-wrapper ${isActive ? "git-tab-active" : ""}`
      });

      // Main tab content (Icon + Label)
      const tabHeader = tabWrapper.createDiv({ cls: "git-tab-header" });

      const iconSpan = tabHeader.createSpan({ cls: "git-tab-icon" });
      setIcon(iconSpan, tab.iconName);
      tabHeader.createSpan({ cls: "git-tab-label", text: tab.label });

      // Badge for conflict tab
      if (tab.id === "conflict" && state.status?.conflicted.length) {
        tabWrapper.addClass("has-badge");
        tabHeader.createSpan({
          cls: "git-tab-badge git-badge-danger",
          text: String(state.status.conflicted.length)
        });
      }

      // Click handler on the whole wrapper
      tabWrapper.addEventListener("click", () => {
        if (this.activeTab !== tab.id) {
          this.activeTab = tab.id;
          if (this.gitState) {
            this.render(this.gitState.getState());
          }
        }
      });
    }
  }

  private renderContent(container: HTMLElement, state: GitViewState): void {
    if (!this.gitState) return;

    // 초기화되지 않은 submodule 선택 시 안내 메시지 표시
    if (state.activeRepoPath) {
      const submodule = state.submodules.find(s => s.path === state.activeRepoPath);
      if (submodule && !submodule.isInitialized) {
        renderUninitializedSubmoduleMessage(container, state, this.gitState);
        return;
      }
    }

    // Render Tab Description if available
    const activeTabConfig = TABS.find((t) => t.id === this.activeTab);
    if (activeTabConfig?.description) {
      const descContainer = container.createDiv({ cls: "git-content-header" });
      descContainer.createEl("p", {
        text: activeTabConfig.description,
        cls: "git-content-description"
      });
    }

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
      case "history":
        this.renderHistoryTab(container, state);
        break;
      case "conflict":
        renderConflictPanel(container, state, this.gitState);
        break;
    }
  }

  private async renderHistoryTab(container: HTMLElement, state: GitViewState): Promise<void> {
    if (!this.gitState) return;

    // Git 저장소가 아닌 경우 바로 패널 렌더링 (메시지 표시)
    if (!state.status?.isRepo) {
      renderHistoryPanel(container, state, this.gitState, this.app);
      return;
    }

    // 커밋 히스토리가 비어있으면 로드
    if (state.commits.length === 0 && !state.loading) {
      await this.gitState.loadCommitHistory();
      return; // loadCommitHistory가 상태 변경 후 리렌더를 트리거함
    }

    renderHistoryPanel(container, state, this.gitState, this.app);
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
    const statusHeader = statusSection.createEl("div", { cls: "git-section-header" });
    const statusIcon = statusHeader.createEl("span", { cls: "git-section-icon" });
    setIcon(statusIcon, ICON_NAMES.activity);
    statusHeader.createEl("span", { text: " 현재 상태" });
    renderStatusPanel(statusSection, state, this.gitState, this.app);

    // 빠른 작업 패널
    const syncSection = container.createEl("div", { cls: "git-section" });
    const syncHeader = syncSection.createEl("div", { cls: "git-section-header" });
    const syncIcon = syncHeader.createEl("span", { cls: "git-section-icon" });
    setIcon(syncIcon, ICON_NAMES.zap);
    syncHeader.createEl("span", { text: " 빠른 작업" });
    renderSyncPanel(syncSection, state, this.gitState, this.app);

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
    const heroIcon = hero.createEl("div", { cls: "git-init-icon" });
    setIcon(heroIcon, ICON_NAMES.folder);
    hero.createEl("h2", { text: "Git 저장소가 아닙니다" });
    hero.createEl("p", {
      cls: "git-init-desc",
      text: "이 폴더에서 협업 기능을 사용하려면 Git 저장소를 초기화해야 합니다."
    });

    // 설명
    const info = initPanel.createEl("div", { cls: "git-init-info" });
    const infoHeader = info.createEl("h4");
    const infoIcon = infoHeader.createEl("span");
    setIcon(infoIcon, ICON_NAMES.lightbulb);
    infoHeader.createEl("span", { text: " Git이란?" });
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
    const initBtnIcon = initBtn.createEl("span", { cls: "git-btn-icon" });
    setIcon(initBtnIcon, ICON_NAMES.play);
    initBtn.createEl("span", { text: "Git 저장소 시작하기" });

    initBtn.onclick = async () => {
      if (!this.gitState) return;

      initBtn.disabled = true;
      initBtn.addClass("git-btn-loading");

      const result = await this.gitState.init();

      initBtn.removeClass("git-btn-loading");
      initBtn.disabled = false;

      new Notice(result.message);

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
