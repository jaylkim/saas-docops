/**
 * Status Panel - 현재 상태 표시
 */

import { App, Notice, setIcon } from "obsidian";
import { GitState } from "../git-state";
import { GitViewState, GIT_TERMS } from "../git-types";
import { ICON_NAMES } from "../../shared/icons";
import { AddRemoteModal } from "./add-remote-modal";

export function renderStatusPanel(
  container: HTMLElement,
  state: GitViewState,
  gitState?: GitState,
  app?: App
): void {
  container.empty();
  container.addClass("git-status-panel");

  if (state.loading) {
    const loadingEl = container.createEl("div", { cls: "git-loading" });
    const loadingIcon = loadingEl.createEl("span", { cls: "git-loading-icon" });
    setIcon(loadingIcon, ICON_NAMES.loading);
    loadingEl.createEl("span", { text: " 상태 확인 중..." });
    return;
  }

  if (state.error) {
    const errorBox = container.createEl("div", { cls: "git-error-box" });
    const errorIcon = errorBox.createEl("span", { cls: "git-error-icon" });
    setIcon(errorIcon, ICON_NAMES.error);
    errorBox.createEl("span", { cls: "git-error-text", text: state.error });
    return;
  }

  if (!state.status) {
    container.createEl("div", {
      cls: "git-no-status",
      text: "상태 정보 없음",
    });
    return;
  }

  const status = state.status;

  // 현재 작업 공간 (브랜치)
  const branchBox = container.createEl("div", { cls: "git-branch-box" });
  const branchIcon = branchBox.createEl("span", { cls: "git-branch-icon" });
  setIcon(branchIcon, status.isMainBranch ? ICON_NAMES.home : ICON_NAMES.branch);

  const branchInfo = branchBox.createEl("div", { cls: "git-branch-info" });
  branchInfo.createEl("span", { cls: "git-branch-label", text: GIT_TERMS.branch });
  branchInfo.createEl("span", { cls: "git-branch-name", text: status.currentBranch });

  if (status.isMainBranch) {
    branchInfo.createEl("span", { cls: "git-branch-badge git-badge-main", text: "메인" });
  }

  // main 브랜치 직접 작업 경고
  if (status.isMainBranch && (status.staged.length > 0 || status.modified.length > 0)) {
    const warning = container.createEl("div", { cls: "git-warning-box" });
    const warningIcon = warning.createEl("span", { cls: "git-warning-icon" });
    setIcon(warningIcon, ICON_NAMES.warning);
    warning.createEl("span", {
      cls: "git-warning-text",
      text: "메인 브랜치에서 직접 작업 중입니다. 새 작업 공간을 만드는 것이 좋습니다."
    });
  }

  // 동기화 상태
  if (status.hasRemote) {
    const syncBox = container.createEl("div", { cls: "git-sync-status" });

    if (status.behind > 0) {
      const pullInfo = syncBox.createEl("div", { cls: "git-sync-item git-sync-behind" });
      const pullIcon = pullInfo.createEl("span", { cls: "git-sync-icon" });
      setIcon(pullIcon, ICON_NAMES.pull);
      pullInfo.createEl("span", {
        text: `${status.behind}개의 새 버전 (가져오기 필요)`
      });
    }

    if (status.ahead > 0) {
      const pushInfo = syncBox.createEl("div", { cls: "git-sync-item git-sync-ahead" });
      const pushIcon = pushInfo.createEl("span", { cls: "git-sync-icon" });
      setIcon(pushIcon, ICON_NAMES.push);
      pushInfo.createEl("span", {
        text: `${status.ahead}개의 작성한 버전 (업로드 필요)`
      });
    }

    if (status.ahead === 0 && status.behind === 0) {
      const upToDate = syncBox.createEl("div", { cls: "git-sync-item git-sync-uptodate" });
      const successIcon = upToDate.createEl("span", { cls: "git-sync-icon" });
      setIcon(successIcon, ICON_NAMES.success);
      upToDate.createEl("span", { text: "모든 내용이 최신 상태입니다" });
    }
  } else {
    const noRemote = container.createEl("div", { cls: "git-no-remote git-no-remote-action" });
    const noRemoteContent = noRemote.createEl("div", { cls: "git-no-remote-content" });

    const noRemoteIcon = noRemoteContent.createEl("span", { cls: "git-no-remote-icon" });
    setIcon(noRemoteIcon, ICON_NAMES.cloudOff);

    const noRemoteText = noRemoteContent.createEl("div", { cls: "git-no-remote-text" });
    noRemoteText.createEl("span", {
      cls: "git-no-remote-title",
      text: "원격 저장소 연결 안됨",
    });
    noRemoteText.createEl("span", {
      cls: "git-no-remote-hint",
      text: "GitHub 등과 연결하면 백업과 협업이 가능해요",
    });

    if (gitState && app) {
      const connectBtn = noRemote.createEl("button", {
        cls: "git-btn git-btn-primary git-btn-sm",
        text: "연결하기",
      });
      connectBtn.onclick = () => {
        new AddRemoteModal(app, gitState).open();
      };
    }
  }

  // .gitignore 상태 확인 및 추가 버튼
  if (gitState) {
    const hasGitignore = gitState.hasGitignore();

    if (!hasGitignore) {
      const gitignoreWarning = container.createEl("div", { cls: "git-gitignore-warning" });
      const shieldIcon = gitignoreWarning.createEl("span", { cls: "git-warning-icon" });
      setIcon(shieldIcon, ICON_NAMES.shield);

      const warningContent = gitignoreWarning.createEl("div", { cls: "git-gitignore-content" });
      warningContent.createEl("span", {
        cls: "git-gitignore-text",
        text: ".gitignore가 없습니다. 민감한 파일이 실수로 올라갈 수 있어요."
      });

      const addBtn = warningContent.createEl("button", {
        cls: "git-btn git-btn-sm git-btn-warning",
        text: "보호 설정 추가"
      });

      addBtn.onclick = async () => {
        addBtn.disabled = true;
        addBtn.addClass("git-btn-loading");
        const result = await gitState.createOrUpdateGitignore();
        addBtn.removeClass("git-btn-loading");
        addBtn.disabled = false;

        new Notice(result.message);
      };
    }
  }

  // 파일 요약
  const fileSummary = container.createEl("div", { cls: "git-file-summary" });

  const totalChanges = status.files.length;
  if (totalChanges === 0) {
    const noChangesEl = fileSummary.createEl("div", { cls: "git-no-changes" });
    const noChangesIcon = noChangesEl.createEl("span");
    setIcon(noChangesIcon, ICON_NAMES.success);
    noChangesEl.createEl("span", { text: " 변경사항 없음" });
  } else {
    const changesCountEl = fileSummary.createEl("div", { cls: "git-changes-count" });
    const fileIcon = changesCountEl.createEl("span");
    setIcon(fileIcon, ICON_NAMES.file);
    changesCountEl.createEl("span", { text: ` ${totalChanges}개 파일 변경됨` });

    const details = fileSummary.createEl("div", { cls: "git-changes-details" });

    if (status.staged.length > 0) {
      details.createEl("span", {
        cls: "git-detail-item git-staged",
        text: `저장 준비: ${status.staged.length}`
      });
    }

    if (status.modified.length > 0) {
      details.createEl("span", {
        cls: "git-detail-item git-modified",
        text: `수정됨: ${status.modified.length}`
      });
    }

    if (status.untracked.length > 0) {
      details.createEl("span", {
        cls: "git-detail-item git-untracked",
        text: `새 파일: ${status.untracked.length}`
      });
    }

    if (status.conflicted.length > 0) {
      const conflictEl = details.createEl("span", { cls: "git-detail-item git-conflicted" });
      const conflictIcon = conflictEl.createEl("span");
      setIcon(conflictIcon, ICON_NAMES.conflict);
      conflictEl.createEl("span", { text: ` 충돌: ${status.conflicted.length}` });
    }
  }
}
