/**
 * Sync Panel - 동기화 (Pull/Push) 패널
 */

import { Notice, setIcon } from "obsidian";
import { GitState } from "../git-state";
import { GitViewState, GIT_ICON_NAMES } from "../git-types";

export function renderSyncPanel(
  container: HTMLElement,
  state: GitViewState,
  gitState: GitState
): void {
  container.empty();
  container.addClass("git-sync-panel");

  const status = state.status;
  if (!status || !status.isRepo) {
    container.createEl("div", {
      cls: "git-panel-empty",
      text: "Git 저장소가 아닙니다"
    });
    return;
  }

  // 빠른 작업 버튼들 (스마트 동기화)
  const quickActions = container.createEl("div", { cls: "git-quick-actions" });

  // 1. 최신글 가져오기 (가장 높은 우선순위)
  if (status.behind > 0) {
    const pullBtn = quickActions.createEl("button", {
      cls: "git-action-btn git-action-pull git-action-primary",
      attr: { style: "width: 100%; justify-content: center;" }
    });
    const pullIcon = pullBtn.createEl("span", { cls: "git-action-icon" });
    setIcon(pullIcon, GIT_ICON_NAMES.pull);
    pullBtn.createEl("span", { cls: "git-action-label", text: `${status.behind}개의 새 버전 가져오기` });

    pullBtn.onclick = async () => {
      pullBtn.disabled = true;
      pullBtn.addClass("git-btn-loading");
      const result = await gitState.pull();
      pullBtn.removeClass("git-btn-loading");
      pullBtn.disabled = false;
      showNotice(result.success, result.message);
    };
    return; // 가져오기가 있으면 다른 액션 숨김
  }

  // 2. 대기중인 업로드 (로컬 변경사항 없이 커밋만 있는 경우)
  if (status.ahead > 0 && status.files.length === 0) {
    const pushBtn = quickActions.createEl("button", {
      cls: "git-action-btn git-action-push git-action-primary",
      attr: { style: "width: 100%; justify-content: center;" }
    });
    const pushIcon = pushBtn.createEl("span", { cls: "git-action-icon" });
    setIcon(pushIcon, GIT_ICON_NAMES.push);
    pushBtn.createEl("span", { cls: "git-action-label", text: `${status.ahead}개의 버전 클라우드에 올리기` });

    pushBtn.onclick = async () => {
      pushBtn.disabled = true;
      pushBtn.addClass("git-btn-loading");
      const result = await gitState.push();
      pushBtn.removeClass("git-btn-loading");
      pushBtn.disabled = false;
      showNotice(result.success, result.message);
    };
    return;
  }

  // 3. 최신 상태 (변경사항은 file-list/commit-form에서 처리)
  if (status.ahead === 0 && status.behind === 0) {
    const syncedEl = quickActions.createEl("div", {
      cls: "git-synced-message",
      attr: { style: "text-align: center; color: var(--text-muted); padding: 10px;" }
    });
    const checkIcon = syncedEl.createEl("span");
    setIcon(checkIcon, "check-circle");
    syncedEl.createEl("span", { text: " 모든 내용이 클라우드와 동기화되었습니다." });
  }

  // 원격 저장소 정보
  if (status.remoteUrl) {
    const remoteInfo = container.createEl("div", { cls: "git-remote-info" });
    remoteInfo.createEl("span", { cls: "git-remote-label", text: "원격 저장소:" });
    remoteInfo.createEl("span", { cls: "git-remote-url", text: formatRemoteUrl(status.remoteUrl) });
  }
}

function showNotice(success: boolean, message: string): void {
  new Notice(message);
}

function formatRemoteUrl(url: string): string {
  // SSH URL을 읽기 쉽게 변환
  // git@github.com:owner/repo.git -> owner/repo
  let formatted = url
    .replace(/^git@[^:]+:/, "")
    .replace(/^https?:\/\/[^/]+\//, "")
    .replace(/\.git$/, "");

  // 너무 길면 자르기
  if (formatted.length > 40) {
    formatted = "..." + formatted.slice(-37);
  }

  return formatted;
}
