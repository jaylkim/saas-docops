/**
 * Status Panel - 현재 상태 표시
 */

import { Notice } from "obsidian";
import { GitState } from "../git-state";
import { GitViewState, GIT_ICONS, GIT_TERMS } from "../git-types";

export function renderStatusPanel(
  container: HTMLElement,
  state: GitViewState,
  gitState?: GitState
): void {
  container.empty();
  container.addClass("git-status-panel");

  if (state.loading) {
    container.createEl("div", {
      cls: "git-loading",
      text: `${GIT_ICONS.loading} 상태 확인 중...`,
    });
    return;
  }

  if (state.error) {
    const errorBox = container.createEl("div", { cls: "git-error-box" });
    errorBox.createEl("span", { cls: "git-error-icon", text: GIT_ICONS.error });
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
  branchBox.createEl("span", { cls: "git-branch-icon", text: status.isMainBranch ? GIT_ICONS.main : GIT_ICONS.branch });

  const branchInfo = branchBox.createEl("div", { cls: "git-branch-info" });
  branchInfo.createEl("span", { cls: "git-branch-label", text: GIT_TERMS.branch });
  branchInfo.createEl("span", { cls: "git-branch-name", text: status.currentBranch });

  if (status.isMainBranch) {
    branchInfo.createEl("span", { cls: "git-branch-badge git-badge-main", text: "메인" });
  }

  // main 브랜치 직접 작업 경고
  if (status.isMainBranch && (status.staged.length > 0 || status.modified.length > 0)) {
    const warning = container.createEl("div", { cls: "git-warning-box" });
    warning.createEl("span", { cls: "git-warning-icon", text: GIT_ICONS.warning });
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
      pullInfo.createEl("span", { cls: "git-sync-icon", text: GIT_ICONS.pull });
      pullInfo.createEl("span", {
        text: `${status.behind}개 ${GIT_TERMS.behind} 있음 (가져오기 필요)`
      });
    }

    if (status.ahead > 0) {
      const pushInfo = syncBox.createEl("div", { cls: "git-sync-item git-sync-ahead" });
      pushInfo.createEl("span", { cls: "git-sync-icon", text: GIT_ICONS.push });
      pushInfo.createEl("span", {
        text: `${status.ahead}개 ${GIT_TERMS.ahead} 있음 (올리기 필요)`
      });
    }

    if (status.ahead === 0 && status.behind === 0) {
      const upToDate = syncBox.createEl("div", { cls: "git-sync-item git-sync-uptodate" });
      upToDate.createEl("span", { cls: "git-sync-icon", text: GIT_ICONS.success });
      upToDate.createEl("span", { text: "팀과 동기화 완료" });
    }
  } else {
    const noRemote = container.createEl("div", { cls: "git-no-remote" });
    noRemote.createEl("span", { text: "원격 저장소 연결 안됨" });
  }

  // .gitignore 상태 확인 및 추가 버튼
  if (gitState) {
    const hasGitignore = gitState.hasGitignore();

    if (!hasGitignore) {
      const gitignoreWarning = container.createEl("div", { cls: "git-gitignore-warning" });
      gitignoreWarning.createEl("span", { cls: "git-warning-icon", text: "🛡️" });

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

        const icon = result.success ? GIT_ICONS.success : GIT_ICONS.error;
        new Notice(`${icon} ${result.message}`);
      };
    }
  }

  // 파일 요약
  const fileSummary = container.createEl("div", { cls: "git-file-summary" });

  const totalChanges = status.files.length;
  if (totalChanges === 0) {
    fileSummary.createEl("div", {
      cls: "git-no-changes",
      text: `${GIT_ICONS.success} 변경사항 없음`
    });
  } else {
    fileSummary.createEl("div", {
      cls: "git-changes-count",
      text: `${GIT_ICONS.file} ${totalChanges}개 파일 변경됨`
    });

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
      details.createEl("span", {
        cls: "git-detail-item git-conflicted",
        text: `${GIT_ICONS.conflict} 충돌: ${status.conflicted.length}`
      });
    }
  }
}
