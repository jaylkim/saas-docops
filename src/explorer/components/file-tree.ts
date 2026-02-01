/**
 * File Tree - 트리 뷰 렌더링
 */

import { App, setIcon, TFile } from "obsidian";
import { ExplorerState } from "../explorer-state";
import { ExplorerViewState, FileEntry } from "../explorer-types";
import { showContextMenu } from "./context-menu";
import * as path from "path";

// 파일 확장자별 아이콘 매핑
const EXTENSION_ICONS: Record<string, string> = {
  ".md": "file-text",
  ".txt": "file-text",
  ".json": "file-json",
  ".js": "file-code",
  ".ts": "file-code",
  ".tsx": "file-code",
  ".jsx": "file-code",
  ".css": "file-code",
  ".scss": "file-code",
  ".html": "file-code",
  ".xml": "file-code",
  ".yml": "file-code",
  ".yaml": "file-code",
  ".toml": "file-code",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".gif": "image",
  ".svg": "image",
  ".webp": "image",
  ".pdf": "file",
  ".zip": "archive",
  ".tar": "archive",
  ".gz": "archive",
  ".rar": "archive",
  ".7z": "archive",
  ".mp3": "music",
  ".wav": "music",
  ".mp4": "video",
  ".mov": "video",
  ".avi": "video",
};

function getFileIcon(entry: FileEntry): string {
  if (entry.isDirectory) {
    return "folder";
  }
  return EXTENSION_ICONS[entry.extension.toLowerCase()] || "file";
}

function getDepth(entryPath: string): number {
  if (!entryPath) return 0;
  return entryPath.split(path.sep).length;
}

export function renderFileTree(
  container: HTMLElement,
  state: ExplorerViewState,
  explorerState: ExplorerState,
  app: App
): void {
  container.empty();

  if (state.loading) {
    const loadingEl = container.createEl("div", { cls: "explorer-loading" });
    const spinner = loadingEl.createEl("span", { cls: "explorer-spinner" });
    setIcon(spinner, "loader");
    loadingEl.createEl("span", { text: " 로딩 중..." });
    return;
  }

  if (state.error) {
    const errorEl = container.createEl("div", { cls: "explorer-error" });
    const errorIcon = errorEl.createEl("span", { cls: "explorer-error-icon" });
    setIcon(errorIcon, "alert-circle");
    errorEl.createEl("span", { text: ` ${state.error}` });
    return;
  }

  if (state.entries.length === 0) {
    const emptyEl = container.createEl("div", { cls: "explorer-empty" });
    const emptyIcon = emptyEl.createEl("span", { cls: "explorer-empty-icon" });
    setIcon(emptyIcon, "folder-open");
    emptyEl.createEl("span", { text: " 빈 폴더입니다" });
    return;
  }

  const treeEl = container.createEl("div", { cls: "explorer-tree" });

  for (const entry of state.entries) {
    renderFileEntry(treeEl, entry, state, explorerState, app);
  }
}

function renderFileEntry(
  container: HTMLElement,
  entry: FileEntry,
  state: ExplorerViewState,
  explorerState: ExplorerState,
  app: App
): void {
  const depth = getDepth(entry.path);
  const isExpanded = state.expandedPaths.has(entry.path);
  const isSelected = state.selectedPath === entry.path;

  const itemEl = container.createEl("div", {
    cls: `explorer-item ${isSelected ? "explorer-item-selected" : ""} ${entry.isHidden ? "explorer-item-hidden" : ""}`,
  });

  // 들여쓰기
  itemEl.style.paddingLeft = `${depth * 16 + 8}px`;

  // 펼침/접힘 아이콘 (폴더만)
  const chevronEl = itemEl.createEl("span", { cls: "explorer-chevron" });
  if (entry.isDirectory) {
    setIcon(chevronEl, isExpanded ? "chevron-down" : "chevron-right");
    chevronEl.onclick = (e) => {
      e.stopPropagation();
      explorerState.toggleExpand(entry.path);
    };
  }

  // 파일/폴더 아이콘
  const iconEl = itemEl.createEl("span", { cls: "explorer-icon" });
  if (entry.isDirectory && isExpanded) {
    setIcon(iconEl, "folder-open");
  } else {
    setIcon(iconEl, getFileIcon(entry));
  }

  // 파일명
  const nameEl = itemEl.createEl("span", { cls: "explorer-name" });
  nameEl.textContent = entry.name;

  // 클릭 이벤트 (선택 + 열기)
  itemEl.onclick = async () => {
    explorerState.select(entry.path);

    if (entry.isDirectory) {
      // 폴더 클릭 시 펼침/접힘 토글
      await explorerState.toggleExpand(entry.path);
    } else {
      // 파일 클릭 시 열기
      await openFile(entry, app, explorerState);
    }
  };

  // 우클릭 이벤트 (컨텍스트 메뉴)
  itemEl.oncontextmenu = (e) => {
    e.preventDefault();
    explorerState.select(entry.path);
    showContextMenu(e, entry, explorerState, app);
  };
}

async function openFile(
  entry: FileEntry,
  app: App,
  explorerState: ExplorerState
): Promise<void> {
  // .md 파일은 Obsidian에서 열기
  if (entry.extension.toLowerCase() === ".md") {
    const file = app.vault.getAbstractFileByPath(entry.path);
    if (file instanceof TFile) {
      await app.workspace.getLeaf().openFile(file);
    }
  } else {
    // 다른 파일은 시스템 앱으로 열기
    await explorerState.openWithSystemApp(entry.path);
  }
}
