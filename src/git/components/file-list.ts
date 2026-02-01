/**
 * File List - 변경된 파일 목록
 */

import { setIcon } from "obsidian";
import { GitState } from "../git-state";
import { GitViewState, GitFile, GIT_ICON_NAMES } from "../git-types";

export function renderFileList(
  container: HTMLElement,
  state: GitViewState,
  gitState: GitState
): void {
  container.empty();
  container.addClass("git-file-list-panel");

  const status = state.status;
  if (!status || !status.isRepo) {
    return;
  }

  const files = status.files;
  if (files.length === 0) {
    const noFilesEl = container.createEl("div", { cls: "git-no-files" });
    const successIcon = noFilesEl.createEl("span");
    setIcon(successIcon, GIT_ICON_NAMES.success);
    noFilesEl.createEl("span", { text: " 변경된 파일이 없습니다" });
    return;
  }

  // 헤더
  const header = container.createEl("div", { cls: "git-file-list-header" });
  const titleEl = header.createEl("span", { cls: "git-file-list-title" });
  const listIcon = titleEl.createEl("span");
  setIcon(listIcon, "list");
  titleEl.createEl("span", { text: ` 변경된 파일 (${files.length}개)` });

  // 전체 선택/해제 버튼들
  const headerActions = header.createEl("div", { cls: "git-file-list-actions" });

  const selectAllBtn = headerActions.createEl("button", {
    cls: "git-btn-sm",
    text: "전체 선택"
  });
  selectAllBtn.onclick = () => gitState.selectAllFiles();

  const clearBtn = headerActions.createEl("button", {
    cls: "git-btn-sm",
    text: "선택 해제"
  });
  clearBtn.onclick = () => gitState.clearSelection();

  // 통합된 파일 목록 생성
  const allFiles: { file: GitFile; type: string }[] = [];

  // 우선순위에 따라 정렬하여 추가
  status.conflicted.forEach(f => allFiles.push({ file: f, type: 'conflicted' }));
  status.staged.forEach(f => allFiles.push({ file: f, type: 'staged' }));
  status.modified.forEach(f => allFiles.push({ file: f, type: 'modified' }));
  status.untracked.forEach(f => allFiles.push({ file: f, type: 'untracked' }));

  if (allFiles.length > 0) {
    const listSection = container.createEl("div", { cls: "git-file-section" });

    // 섹션 헤더 (필요시 복원, 지금은 깔끔하게 목록만 표시하거나 통합 헤더 사용)
    // listSection.createEl("div", { cls: "git-section-title", text: "변경사항" });

    const list = listSection.createEl("div", { cls: "git-file-items" });

    for (const item of allFiles) {
      renderFileItem(list, item.file, state.selectedFiles, gitState);
    }
  }
}


function renderFileItem(
  list: HTMLElement,
  file: GitFile,
  selectedFiles: Set<string>,
  gitState: GitState
): void {
  const item = list.createEl("div", { cls: "git-file-item" });

  // 체크박스
  const checkbox = item.createEl("input", { type: "checkbox" }) as HTMLInputElement;
  checkbox.checked = selectedFiles.has(file.path);
  checkbox.onchange = () => gitState.toggleFileSelection(file.path);

  // 상태 아이콘
  const iconEl = item.createEl("span", { cls: "git-file-icon" });
  const iconName = getFileStatusIconName(file.status);
  setIcon(iconEl, iconName);

  // 파일 정보
  const fileInfo = item.createEl("div", { cls: "git-file-info" });
  fileInfo.createEl("span", { cls: "git-file-name", text: file.displayName });

  // 경로 (파일명과 다를 경우에만)
  if (file.path !== file.displayName) {
    const dir = file.path.substring(0, file.path.length - file.displayName.length - 1);
    if (dir) {
      fileInfo.createEl("span", { cls: "git-file-path", text: dir });
    }
  }

  // 상태 배지
  item.createEl("span", {
    cls: `git-file-status git-status-${file.status}`,
    text: getStatusText(file.status)
  });
}

function getFileStatusIconName(status: string): string {
  switch (status) {
    case "modified":
      return GIT_ICON_NAMES.modified;
    case "added":
    case "untracked":
      return GIT_ICON_NAMES.added;
    case "deleted":
      return GIT_ICON_NAMES.deleted;
    case "renamed":
      return "file-edit";
    case "conflicted":
      return GIT_ICON_NAMES.conflict;
    default:
      return GIT_ICON_NAMES.file;
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case "modified":
      return "수정됨";
    case "added":
      return "추가됨";
    case "deleted":
      return "삭제됨";
    case "renamed":
      return "이름변경";
    case "untracked":
      return "새파일";
    case "conflicted":
      return "충돌";
    default:
      return status;
  }
}
