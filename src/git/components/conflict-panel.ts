/**
 * Conflict Panel - 충돌 해결 패널
 */

import { Notice, setIcon } from "obsidian";
import { GitState } from "../git-state";
import { GitViewState, GIT_ICON_NAMES } from "../git-types";

export function renderConflictPanel(
  container: HTMLElement,
  state: GitViewState,
  gitState: GitState
): void {
  container.empty();
  container.addClass("git-conflict-panel");

  const status = state.status;
  if (!status || !status.isRepo) {
    container.createEl("div", {
      cls: "git-panel-empty",
      text: "Git 저장소가 아닙니다"
    });
    return;
  }

  // 충돌이 없으면 안내
  if (status.conflicted.length === 0) {
    const noConflict = container.createEl("div", { cls: "git-no-conflict" });
    const successIcon = noConflict.createEl("span", { cls: "git-no-conflict-icon" });
    setIcon(successIcon, GIT_ICON_NAMES.success);
    noConflict.createEl("span", { text: " 충돌 없음! 모든 파일이 정상입니다." });
    return;
  }

  // 충돌 경고
  const warningBox = container.createEl("div", { cls: "git-conflict-warning" });
  const conflictIcon = warningBox.createEl("span", { cls: "git-conflict-icon" });
  setIcon(conflictIcon, GIT_ICON_NAMES.conflict);
  warningBox.createEl("div", { cls: "git-conflict-message" }).innerHTML = `
    <strong>${status.conflicted.length}개 파일에서 충돌 발생</strong>
    <p>같은 부분을 동시에 수정했을 때 충돌이 발생합니다. 각 파일의 충돌을 해결해야 합니다.</p>
  `;

  // 충돌 파일 목록
  const fileList = container.createEl("div", { cls: "git-conflict-files" });
  fileList.createEl("div", { cls: "git-section-label", text: "충돌 파일" });

  for (const file of status.conflicted) {
    const fileItem = fileList.createEl("div", { cls: "git-conflict-item" });

    // 파일 정보
    const fileInfo = fileItem.createEl("div", { cls: "git-conflict-file-info" });
    const fileIcon = fileInfo.createEl("span", { cls: "git-conflict-file-icon" });
    setIcon(fileIcon, GIT_ICON_NAMES.conflict);
    fileInfo.createEl("span", { cls: "git-conflict-file-name", text: file.displayName });

    if (file.path !== file.displayName) {
      const dir = file.path.substring(0, file.path.length - file.displayName.length - 1);
      if (dir) {
        fileInfo.createEl("span", { cls: "git-conflict-file-path", text: dir });
      }
    }

    // 해결 버튼들
    const actions = fileItem.createEl("div", { cls: "git-conflict-actions" });

    // 내 변경사항 사용
    const oursBtn = actions.createEl("button", {
      cls: "git-btn git-btn-sm git-btn-ours",
      text: "내 변경사항 사용"
    });
    oursBtn.title = "내가 수정한 내용으로 적용합니다";

    oursBtn.onclick = async () => {
      oursBtn.disabled = true;
      oursBtn.addClass("git-btn-loading");

      const result = await gitState.resolveConflict(file.path, "ours");

      oursBtn.removeClass("git-btn-loading");
      oursBtn.disabled = false;

      new Notice(result.message);
    };

    // 상대방 변경사항 사용
    const theirsBtn = actions.createEl("button", {
      cls: "git-btn git-btn-sm git-btn-theirs",
      text: "상대 변경사항 사용"
    });
    theirsBtn.title = "팀원이 수정한 내용으로 적용합니다";

    theirsBtn.onclick = async () => {
      theirsBtn.disabled = true;
      theirsBtn.addClass("git-btn-loading");

      const result = await gitState.resolveConflict(file.path, "theirs");

      theirsBtn.removeClass("git-btn-loading");
      theirsBtn.disabled = false;

      new Notice(result.message);
    };
  }

  // 도움말
  const helpBox = container.createEl("div", { cls: "git-help-box" });
  const helpTitle = helpBox.createEl("div", { cls: "git-help-title" });
  const helpIcon = helpTitle.createEl("span");
  setIcon(helpIcon, "lightbulb");
  helpTitle.createEl("span", { text: " 충돌 해결 방법" });
  helpBox.createEl("div", { cls: "git-help-text" }).innerHTML = `
    <p><strong>내 변경사항 사용:</strong> 내가 수정한 내용을 유지합니다.</p>
    <p><strong>상대 변경사항 사용:</strong> 팀원이 수정한 내용으로 대체합니다.</p>
    <p>두 변경사항을 모두 유지하려면 파일을 직접 열어 수동으로 편집해야 합니다.</p>
  `;

  // 모두 해결 후 안내
  const finishGuide = container.createEl("div", { cls: "git-conflict-finish" });
  finishGuide.createEl("p", {
    text: "모든 충돌을 해결한 후 '저장 & 올리기'를 하세요."
  });
}
