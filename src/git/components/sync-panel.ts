/**
 * Sync Panel - 동기화 (Pull/Push) 패널
 */

import { App, Notice, setIcon } from "obsidian";
import { GitState } from "../git-state";
import { GitViewState } from "../git-types";
import { ICON_NAMES } from "../../shared/icons";
import { EditRemoteModal } from "./edit-remote-modal";
import { DeleteRemoteModal } from "./delete-remote-modal";

export function renderSyncPanel(
  container: HTMLElement,
  state: GitViewState,
  gitState: GitState,
  app?: App
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
      attr: { style: "width: 100%; max-width: none; justify-content: center; flex-direction: row;" }
    });
    const pullIcon = pullBtn.createEl("span", { cls: "git-action-icon" });
    setIcon(pullIcon, ICON_NAMES.pull);
    pullBtn.createEl("span", { text: `${status.behind}개의 새 버전 가져오기` });

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

  // 2. 첫 동기화 (원격 저장소 연결 후 첫 push)
  if (status.needsInitialPush && status.files.length === 0) {
    const initialPushBtn = quickActions.createEl("button", {
      cls: "git-action-btn git-action-push git-action-primary",
      attr: { style: "width: 100%; max-width: none; justify-content: center; flex-direction: row;" }
    });
    const pushIcon = initialPushBtn.createEl("span", { cls: "git-action-icon" });
    setIcon(pushIcon, ICON_NAMES.cloudUpload);
    initialPushBtn.createEl("span", { text: "클라우드에 첫 업로드" });

    initialPushBtn.onclick = async () => {
      initialPushBtn.disabled = true;
      initialPushBtn.addClass("git-btn-loading");
      const result = await gitState.push();
      initialPushBtn.removeClass("git-btn-loading");
      initialPushBtn.disabled = false;
      showNotice(result.success, result.message);
    };
    return;
  }

  // 3. 대기중인 업로드 (로컬 변경사항 없이 커밋만 있는 경우)
  if (status.ahead > 0 && status.files.length === 0) {
    const pushBtn = quickActions.createEl("button", {
      cls: "git-action-btn git-action-push git-action-primary",
      attr: { style: "width: 100%; max-width: none; justify-content: center; flex-direction: row;" }
    });
    const pushIcon = pushBtn.createEl("span", { cls: "git-action-icon" });
    setIcon(pushIcon, ICON_NAMES.push);
    pushBtn.createEl("span", { text: `${status.ahead}개의 버전 클라우드에 올리기` });

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

  // 4. 최신 상태 (변경사항은 file-list/commit-form에서 처리)
  // 원격 저장소가 있을 때만 "동기화됨" 메시지 표시
  if (status.hasRemote && status.ahead === 0 && status.behind === 0 && !status.needsInitialPush) {
    const syncedEl = quickActions.createEl("div", {
      cls: "git-synced-message",
      attr: { style: "text-align: center; color: var(--text-muted); padding: 10px;" }
    });
    const checkIcon = syncedEl.createEl("span");
    setIcon(checkIcon, ICON_NAMES.success);
    syncedEl.createEl("span", { text: " 모든 내용이 클라우드와 동기화되었습니다." });
  }

  // 원격 저장소 정보
  if (status.remoteUrl) {
    const remoteInfo = container.createEl("div", { cls: "git-remote-info" });
    remoteInfo.createEl("span", { cls: "git-remote-label", text: "원격 저장소:" });
    remoteInfo.createEl("span", { cls: "git-remote-url", text: formatRemoteUrl(status.remoteUrl) });

    // 수정/삭제 버튼 (app이 제공된 경우에만)
    if (app) {
      const remoteActions = remoteInfo.createEl("div", { cls: "git-remote-actions" });

      // 수정 버튼
      const editBtn = remoteActions.createEl("button", {
        cls: "git-remote-action-btn",
        attr: { title: "URL 수정" },
      });
      const editIcon = editBtn.createEl("span");
      setIcon(editIcon, ICON_NAMES.modified);
      editBtn.onclick = (e) => {
        e.stopPropagation();
        new EditRemoteModal(app, gitState, status.remoteUrl!).open();
      };

      // 연결 해제 버튼
      const unlinkBtn = remoteActions.createEl("button", {
        cls: "git-remote-action-btn git-remote-action-btn-danger",
        attr: { title: "연결 해제" },
      });
      const unlinkIcon = unlinkBtn.createEl("span");
      setIcon(unlinkIcon, ICON_NAMES.unlink);
      unlinkBtn.onclick = (e) => {
        e.stopPropagation();
        new DeleteRemoteModal(app, gitState, status.remoteUrl!).open();
      };
    }
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
