/**
 * File List - 변경된 파일 목록
 */

import { GitState } from "../git-state";
import { GitViewState, GitFile, GIT_ICONS } from "../git-types";

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
    container.createEl("div", {
      cls: "git-no-files",
      text: `${GIT_ICONS.success} 변경된 파일이 없습니다`
    });
    return;
  }

  // 헤더
  const header = container.createEl("div", { cls: "git-file-list-header" });
  header.createEl("span", {
    cls: "git-file-list-title",
    text: `📋 변경된 파일 (${files.length}개)`
  });

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
    renderFileSection(
      container,
      `${GIT_ICONS.conflict} 충돌`,
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
    const item = list.createEl("div", { cls: "git-file-item" });

    // 체크박스
    const checkbox = item.createEl("input", { type: "checkbox" }) as HTMLInputElement;
    checkbox.checked = selectedFiles.has(file.path);
    checkbox.onchange = () => gitState.toggleFileSelection(file.path);

    // 상태 아이콘
    const icon = getFileStatusIcon(file.status);
    item.createEl("span", { cls: "git-file-icon", text: icon });

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
    const statusBadge = item.createEl("span", {
      cls: `git-file-status git-status-${file.status}`,
      text: getStatusText(file.status)
    });
  }
}

function getFileStatusIcon(status: string): string {
  switch (status) {
    case "modified":
      return GIT_ICONS.modified;
    case "added":
    case "untracked":
      return GIT_ICONS.added;
    case "deleted":
      return GIT_ICONS.deleted;
    case "renamed":
      return "📝";
    case "conflicted":
      return GIT_ICONS.conflict;
    default:
      return GIT_ICONS.file;
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
