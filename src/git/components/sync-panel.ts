/**
 * Sync Panel - 동기화 (Pull/Push) 패널
 */

import { Notice } from "obsidian";
import { GitState } from "../git-state";
import { GitViewState, GIT_ICONS } from "../git-types";

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

  // 빠른 작업 버튼들
  const quickActions = container.createEl("div", { cls: "git-quick-actions" });

  // 최신 가져오기 버튼
  const pullBtn = quickActions.createEl("button", {
    cls: "git-action-btn git-action-pull"
  });
  pullBtn.createEl("span", { cls: "git-action-icon", text: GIT_ICONS.pull });
  pullBtn.createEl("span", { cls: "git-action-label", text: "최신 가져오기" });
  if (status.behind > 0) {
    pullBtn.createEl("span", { cls: "git-action-badge", text: String(status.behind) });
  }
  pullBtn.onclick = async () => {
    pullBtn.disabled = true;
    pullBtn.addClass("git-btn-loading");
    const result = await gitState.pull();
    pullBtn.removeClass("git-btn-loading");
    pullBtn.disabled = false;
    showNotice(result.success, result.message);
  };

  const hasChanges = status.files.length > 0;
  const hasMessage = state.commitMessage.trim().length > 0;

  // 저장만 버튼 (커밋만)
  const commitBtn = quickActions.createEl("button", {
    cls: "git-action-btn git-action-commit"
  });
  commitBtn.createEl("span", { cls: "git-action-icon", text: GIT_ICONS.commit });
  commitBtn.createEl("span", { cls: "git-action-label", text: "저장만" });

  if (!hasChanges) {
    commitBtn.disabled = true;
    commitBtn.title = "변경사항이 없습니다";
  } else if (!hasMessage) {
    commitBtn.disabled = true;
    commitBtn.title = "저장 메시지를 입력하세요";
  }

  commitBtn.onclick = async () => {
    if (!hasMessage) {
      new Notice("저장 메시지를 입력하세요");
      return;
    }

    // 변경된 파일이 있지만 staged가 없으면 전체 stage
    if (status.staged.length === 0 && status.files.length > 0) {
      await gitState.stageAll();
    }

    commitBtn.disabled = true;
    commitBtn.addClass("git-btn-loading");
    const result = await gitState.commit();
    commitBtn.removeClass("git-btn-loading");
    commitBtn.disabled = false;
    showNotice(result.success, result.message);
  };

  // 저장 & 올리기 버튼 (가장 중요한 액션)
  const commitPushBtn = quickActions.createEl("button", {
    cls: "git-action-btn git-action-commit-push git-action-primary"
  });
  commitPushBtn.createEl("span", { cls: "git-action-icon", text: GIT_ICONS.commit });
  commitPushBtn.createEl("span", { cls: "git-action-label", text: "저장 & 올리기" });

  if (!hasChanges) {
    commitPushBtn.disabled = true;
    commitPushBtn.title = "변경사항이 없습니다";
  } else if (!hasMessage) {
    commitPushBtn.disabled = true;
    commitPushBtn.title = "저장 메시지를 입력하세요";
  }

  commitPushBtn.onclick = async () => {
    if (!hasMessage) {
      new Notice("저장 메시지를 입력하세요");
      return;
    }

    // 변경된 파일이 있지만 staged가 없으면 전체 stage
    if (status.staged.length === 0 && status.files.length > 0) {
      await gitState.stageAll();
    }

    commitPushBtn.disabled = true;
    commitPushBtn.addClass("git-btn-loading");
    const result = await gitState.commitAndPush();
    commitPushBtn.removeClass("git-btn-loading");
    commitPushBtn.disabled = false;
    showNotice(result.success, result.message);
  };

  // 올리기만 버튼
  const pushBtn = quickActions.createEl("button", {
    cls: "git-action-btn git-action-push"
  });
  pushBtn.createEl("span", { cls: "git-action-icon", text: GIT_ICONS.push });
  pushBtn.createEl("span", { cls: "git-action-label", text: "올리기" });
  if (status.ahead > 0) {
    pushBtn.createEl("span", { cls: "git-action-badge", text: String(status.ahead) });
  }

  if (status.ahead === 0) {
    pushBtn.disabled = true;
    pushBtn.title = "올릴 저장점이 없습니다";
  }

  pushBtn.onclick = async () => {
    pushBtn.disabled = true;
    pushBtn.addClass("git-btn-loading");
    const result = await gitState.push();
    pushBtn.removeClass("git-btn-loading");
    pushBtn.disabled = false;
    showNotice(result.success, result.message);
  };

  // 원격 저장소 정보
  if (status.remoteUrl) {
    const remoteInfo = container.createEl("div", { cls: "git-remote-info" });
    remoteInfo.createEl("span", { cls: "git-remote-label", text: "원격 저장소:" });
    remoteInfo.createEl("span", { cls: "git-remote-url", text: formatRemoteUrl(status.remoteUrl) });
  }
}

function showNotice(success: boolean, message: string): void {
  const icon = success ? GIT_ICONS.success : GIT_ICONS.error;
  new Notice(`${icon} ${message}`);
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
