/**
 * History Panel - 커밋 히스토리 및 버전 이동
 */

import { Notice, Modal, App, setIcon } from "obsidian";
import { GitState } from "../git-state";
import { GitViewState, GitCommitInfo, GIT_TERMS, GitFile } from "../git-types";
import { ICON_NAMES } from "../../shared/icons";

/**
 * 상대 시간 포맷 (예: "3일 전", "2시간 전")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  if (diffWeek < 4) return `${diffWeek}주 전`;
  if (diffMonth < 12) return `${diffMonth}개월 전`;
  return `${Math.floor(diffMonth / 12)}년 전`;
}

// Global App reference for modals
let globalApp: App | null = null;

export function renderHistoryPanel(
  container: HTMLElement,
  state: GitViewState,
  gitState: GitState,
  app?: App
): void {
  if (app) {
    globalApp = app;
  }
  container.empty();
  container.addClass("git-history-panel");

  const status = state.status;
  if (!status || !status.isRepo) {
    container.createEl("div", {
      cls: "git-panel-empty",
      text: "Git 저장소가 아닙니다"
    });
    return;
  }

  // Detached HEAD 경고 배너
  if (state.isDetachedHead) {
    renderDetachedWarning(container, gitState);
  }

  // 로딩 상태
  if (state.loading) {
    const loadingEl = container.createEl("div", { cls: "git-loading" });
    const spinner = loadingEl.createEl("span", { cls: "git-spinner" });
    setIcon(spinner, ICON_NAMES.loading);
    loadingEl.createEl("span", { text: " 저장 이력 불러오는 중..." });
    return;
  }

  // 커밋이 없는 경우
  if (state.commits.length === 0) {
    const emptyEl = container.createEl("div", { cls: "git-panel-empty" });
    const emptyIcon = emptyEl.createEl("div", { cls: "git-empty-icon" });
    setIcon(emptyIcon, ICON_NAMES.inbox);
    emptyEl.createEl("p", { text: "아직 저장된 이력이 없습니다" });
    emptyEl.createEl("p", {
      cls: "git-empty-hint",
      text: "홈 탭에서 첫 번째 저장점을 만들어보세요"
    });
    return;
  }

  // 검색 바
  const toolbar = container.createEl("div", { cls: "git-history-toolbar" });
  const searchContainer = toolbar.createEl("div", { cls: "git-search-container" });
  const searchIcon = searchContainer.createEl("span", { cls: "git-search-icon" });
  setIcon(searchIcon, ICON_NAMES.search);

  const searchInput = searchContainer.createEl("input", {
    type: "text",
    placeholder: "저장 이력 검색...",
    cls: "git-search-input"
  });

  // Enter 키로 검색
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      gitState.loadCommitHistory(searchInput.value);
    }
  });

  // 커밋 목록 섹션
  const listSection = container.createEl("div", { cls: "git-commit-section" });
  listSection.createEl("div", {
    cls: "git-section-label",
    text: `저장 이력 (${state.commits.length}개)`
  });

  // 커밋 타임라인 목록
  const commitList = listSection.createEl("div", { cls: "git-commit-list" });

  for (const commit of state.commits) {
    renderCommitItem(commitList, commit, state, gitState);
  }

  // 더 불러오기 버튼
  if (state.commits.length > 0 && state.commits.length % 50 === 0) {
    const loadMoreBtn = listSection.createEl("button", {
      cls: "git-btn git-btn-block git-load-more",
      text: "더 불러오기"
    });

    loadMoreBtn.onclick = () => {
      loadMoreBtn.addClass("git-btn-loading");
      loadMoreBtn.disabled = true;
      // Search input value preserve? Simple way: read input
      const searchValue = searchInput.value;
      gitState.loadMoreCommits(searchValue).finally(() => {
        // Re-render will replace this button
      });
    };
  }

  // 도움말
  renderHelpBox(container);
}

function renderDetachedWarning(container: HTMLElement, gitState: GitState): void {
  const warning = container.createEl("div", { cls: "git-detached-warning" });

  const warningContent = warning.createEl("div", { cls: "git-detached-content" });
  const warningIcon = warningContent.createEl("span", { cls: "git-detached-icon" });
  setIcon(warningIcon, ICON_NAMES.warning);

  const warningText = warningContent.createEl("div", { cls: "git-detached-text" });
  warningText.createEl("div", {
    cls: "git-detached-title",
    text: GIT_TERMS.detachedHead
  });
  warningText.createEl("div", {
    cls: "git-detached-desc",
    text: "현재 과거 버전을 보고 있습니다. 파일을 확인할 수 있지만, 수정하려면 최신 버전으로 돌아가세요."
  });

  const returnBtn = warning.createEl("button", {
    cls: "git-btn git-btn-warning"
  });
  const returnIcon = returnBtn.createEl("span", { cls: "git-btn-icon" });
  setIcon(returnIcon, ICON_NAMES.arrowLeft);
  returnBtn.createEl("span", { text: GIT_TERMS.returnToLatest });

  returnBtn.onclick = async () => {
    returnBtn.disabled = true;
    returnBtn.addClass("git-btn-loading");

    const result = await gitState.returnToLatest();

    returnBtn.removeClass("git-btn-loading");
    returnBtn.disabled = false;

    new Notice(result.message);
  };
}

function renderCommitItem(
  container: HTMLElement,
  commit: GitCommitInfo,
  state: GitViewState,
  gitState: GitState
): void {
  const item = container.createEl("div", {
    cls: `git-commit-item ${commit.isCurrent ? "git-commit-current" : ""}`
  });

  // 타임라인 인디케이터
  const timeline = item.createEl("div", { cls: "git-commit-timeline" });
  const dot = timeline.createEl("div", {
    cls: `git-timeline-dot ${commit.isCurrent ? "git-timeline-dot-current" : ""}`
  });
  if (commit.isCurrent) {
    setIcon(dot, ICON_NAMES.gitCommit);
  }
  timeline.createEl("div", { cls: "git-timeline-line" });

  // 커밋 정보
  const info = item.createEl("div", { cls: "git-commit-info" });

  // 커밋 메시지 (첫 줄만)
  const message = commit.message.split("\n")[0];
  const messageRow = info.createEl("div", { cls: "git-commit-message-row" });
  messageRow.createEl("span", {
    cls: "git-commit-message",
    text: message.length > 60 ? message.substring(0, 60) + "..." : message
  });

  if (commit.isCurrent) {
    messageRow.createEl("span", { cls: "git-badge git-badge-current", text: "현재 위치" });
  }

  // 메타 정보 (작성자, 시간, 해시)
  const meta = info.createEl("div", { cls: "git-commit-meta" });
  meta.createEl("span", { cls: "git-commit-author", text: commit.author });
  meta.createEl("span", { cls: "git-commit-separator", text: "·" });
  meta.createEl("span", { cls: "git-commit-date", text: formatRelativeTime(commit.date) });
  meta.createEl("span", { cls: "git-commit-separator", text: "·" });
  meta.createEl("code", { cls: "git-commit-hash", text: commit.shortHash });

  // 이동 버튼 (현재 위치가 아닌 경우만)
  if (!commit.isCurrent) {
    const actions = item.createEl("div", { cls: "git-commit-actions" });
    const checkoutBtn = actions.createEl("button", {
      cls: "git-btn-sm",
      text: GIT_TERMS.checkout
    });

    checkoutBtn.onclick = async () => {
      // 변경사항 확인
      if (state.status && state.status.files.length > 0) {
        new Notice("저장하지 않은 변경사항이 있습니다. 먼저 저장하세요.");
        return;
      }

      // 확인 모달
      const confirmed = await showCheckoutConfirmModal(commit);
      if (!confirmed) return;

      checkoutBtn.disabled = true;
      checkoutBtn.addClass("git-btn-loading");

      const result = await gitState.checkoutCommit(commit.hash);

      checkoutBtn.removeClass("git-btn-loading");
      checkoutBtn.disabled = false;

      new Notice(result.message);
    };
  }
  // 클릭 이벤트 (상세 정보 토글)
  item.onclick = (e) => {
    // 버튼이나 링크 클릭 시 무시
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest(".git-commit-hash")) {
      return;
    }
    gitState.toggleCommitDetails(commit.hash);
  };

  // 상세 정보 표시 (확장된 경우)
  if (state.expandedCommit === commit.hash) {
    item.addClass("git-commit-expanded");
    const details = item.createEl("div", { cls: "git-commit-details" });

    if (state.detailLoading && !commit.files) {
      const loading = details.createEl("div", { cls: "git-details-loading" });
      const spinner = loading.createEl("span", { cls: "git-spinner-sm" });
      setIcon(spinner, ICON_NAMES.loading);
      loading.createEl("span", { text: "변경 내역 불러오는 중..." });
    } else if (commit.files) {
      renderCommitFiles(details, commit.files);
    }
  }
}

function renderCommitFiles(container: HTMLElement, files: GitFile[]): void {
  const header = container.createEl("div", { cls: "git-files-header" });
  header.createEl("span", { text: `${files.length}개 파일 변경됨` });

  const fileList = container.createEl("div", { cls: "git-files-list" });

  for (const file of files) {
    const fileRow = fileList.createEl("div", { cls: "git-file-row" });

    // 상태 아이콘
    const statusIcon = fileRow.createEl("span", {
      cls: `git-file-status git-status-${file.status}`
    });

    let iconName: string = ICON_NAMES.file;
    if (file.status === "added") iconName = ICON_NAMES.added;
    else if (file.status === "deleted") iconName = ICON_NAMES.deleted;
    else if (file.status === "modified") iconName = ICON_NAMES.modified;
    else if (file.status === "renamed") iconName = ICON_NAMES.moved; // History uses 'move' visually

    setIcon(statusIcon, iconName);

    // 파일 경로
    fileRow.createEl("span", {
      cls: "git-file-path",
      text: file.path
    });
  }
}

function renderHelpBox(container: HTMLElement): void {
  const helpBox = container.createEl("div", { cls: "git-help-box" });
  const helpTitle = helpBox.createEl("div", { cls: "git-help-title" });
  const helpIcon = helpTitle.createEl("span");
  setIcon(helpIcon, ICON_NAMES.lightbulb);
  helpTitle.createEl("span", { text: " 저장 이력이란?" });
  helpBox.createEl("div", {
    cls: "git-help-text",
    text: "저장 이력은 파일의 모든 저장점(커밋) 목록입니다. 과거 버전으로 이동하여 당시 파일 상태를 확인할 수 있습니다. 수정 작업은 최신 버전에서만 가능합니다."
  });
}

// 버전 이동 확인 모달
function showCheckoutConfirmModal(commit: GitCommitInfo): Promise<boolean> {
  return new Promise((resolve) => {
    if (!globalApp) {
      resolve(false);
      return;
    }
    const modal = new CheckoutConfirmModal(globalApp, commit, resolve);
    modal.open();
  });
}

class CheckoutConfirmModal extends Modal {
  private commit: GitCommitInfo;
  private resolve: (value: boolean) => void;

  constructor(app: App, commit: GitCommitInfo, resolve: (value: boolean) => void) {
    super(app);
    this.commit = commit;
    this.resolve = resolve;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("git-confirm-modal");

    contentEl.createEl("h3", { text: "과거 버전으로 이동" });

    const infoBox = contentEl.createEl("div", { cls: "git-checkout-info" });
    infoBox.createEl("p", { text: "다음 저장점으로 이동합니다:" });

    const commitInfo = infoBox.createEl("div", { cls: "git-checkout-commit" });
    commitInfo.createEl("code", { text: this.commit.shortHash });
    commitInfo.createEl("span", { text: " - " });
    commitInfo.createEl("span", { text: this.commit.message.split("\n")[0] });

    contentEl.createEl("p", {
      cls: "git-checkout-warning",
      text: "이동 후 파일을 확인할 수 있습니다. 수정하려면 최신 버전으로 돌아가세요."
    });

    const actions = contentEl.createEl("div", { cls: "git-modal-actions" });

    const cancelBtn = actions.createEl("button", {
      cls: "git-btn git-btn-secondary",
      text: "취소"
    });
    cancelBtn.onclick = () => {
      this.resolve(false);
      this.close();
    };

    const confirmBtn = actions.createEl("button", {
      cls: "git-btn git-btn-primary",
      text: "이동"
    });
    confirmBtn.onclick = () => {
      this.resolve(true);
      this.close();
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}
