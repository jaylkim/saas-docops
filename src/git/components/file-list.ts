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

  // Staged 파일 섹션
  if (status.staged.length > 0) {
    renderFileSection(
      container,
      "저장 준비됨",
      status.staged,
      state.selectedFiles,
      gitState,
      "staged"
    );
  }

  // Modified 파일 섹션
  if (status.modified.length > 0) {
    renderFileSection(
      container,
      "수정됨",
      status.modified,
      state.selectedFiles,
      gitState,
      "modified"
    );
  }

  // Untracked 파일 섹션
  if (status.untracked.length > 0) {
    renderFileSection(
      container,
      "새 파일",
      status.untracked,
      state.selectedFiles,
      gitState,
      "untracked"
    );
  }

  // Conflicted 파일 섹션
  if (status.conflicted.length > 0) {
    renderFileSectionWithIcon(
      container,
      "충돌",
      GIT_ICON_NAMES.conflict,
      status.conflicted,
      state.selectedFiles,
      gitState,
      "conflicted"
    );
  }
}

function renderFileSection(
  container: HTMLElement,
  title: string,
  files: GitFile[],
  selectedFiles: Set<string>,
  gitState: GitState,
  sectionType: string
): void {
  const section = container.createEl("div", { cls: `git-file-section git-section-${sectionType}` });

  section.createEl("div", { cls: "git-section-title", text: `${title} (${files.length})` });

  const list = section.createEl("div", { cls: "git-file-items" });

  for (const file of files) {
    renderFileItem(list, file, selectedFiles, gitState);
  }
}

function renderFileSectionWithIcon(
  container: HTMLElement,
  title: string,
  iconName: string,
  files: GitFile[],
  selectedFiles: Set<string>,
  gitState: GitState,
  sectionType: string
): void {
  const section = container.createEl("div", { cls: `git-file-section git-section-${sectionType}` });

  const titleEl = section.createEl("div", { cls: "git-section-title" });
  const icon = titleEl.createEl("span");
  setIcon(icon, iconName);
  titleEl.createEl("span", { text: ` ${title} (${files.length})` });

  const list = section.createEl("div", { cls: "git-file-items" });

  for (const file of files) {
    renderFileItem(list, file, selectedFiles, gitState);
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
