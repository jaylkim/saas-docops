/**
 * Context Menu - 우클릭 메뉴
 */

import { App, Menu, Notice } from "obsidian";
import { ExplorerState } from "../explorer-state";
import { FileEntry } from "../explorer-types";
import { CreateModal, RenameModal, DeleteModal } from "./modals";

export function showContextMenu(
  event: MouseEvent,
  entry: FileEntry,
  explorerState: ExplorerState,
  app: App
): void {
  const menu = new Menu();

  if (entry.isDirectory) {
    // 폴더용 메뉴
    menu.addItem((item) => {
      item
        .setTitle("새 파일")
        .setIcon("file-plus")
        .onClick(() => {
          new CreateModal(app, explorerState, entry.path, "file").open();
        });
    });

    menu.addItem((item) => {
      item
        .setTitle("새 폴더")
        .setIcon("folder-plus")
        .onClick(() => {
          new CreateModal(app, explorerState, entry.path, "folder").open();
        });
    });

    menu.addSeparator();
  }

  // 공통 메뉴 - 열기
  if (!entry.isDirectory) {
    menu.addItem((item) => {
      item
        .setTitle("시스템 앱으로 열기")
        .setIcon("external-link")
        .onClick(async () => {
          const result = await explorerState.openWithSystemApp(entry.path);
          if (!result.success) {
            new Notice(result.error || result.message);
          }
        });
    });

    menu.addSeparator();
  }

  // Finder/Explorer에서 보기
  menu.addItem((item) => {
    item
      .setTitle(process.platform === "darwin" ? "Finder에서 보기" : "폴더에서 보기")
      .setIcon("folder-search")
      .onClick(() => {
        explorerState.showInFolder(entry.path);
      });
  });

  menu.addSeparator();

  // 이름 변경
  menu.addItem((item) => {
    item
      .setTitle("이름 바꾸기")
      .setIcon("pencil")
      .onClick(() => {
        new RenameModal(app, explorerState, entry).open();
      });
  });

  // 삭제
  menu.addItem((item) => {
    item
      .setTitle("삭제")
      .setIcon("trash-2")
      .onClick(() => {
        new DeleteModal(app, explorerState, entry).open();
      });
  });

  menu.showAtMouseEvent(event);
}

/**
 * 빈 영역 우클릭 메뉴 (루트에서 새 파일/폴더 생성)
 */
export function showEmptyContextMenu(
  event: MouseEvent,
  explorerState: ExplorerState,
  app: App
): void {
  const menu = new Menu();

  menu.addItem((item) => {
    item
      .setTitle("새 파일")
      .setIcon("file-plus")
      .onClick(() => {
        new CreateModal(app, explorerState, "", "file").open();
      });
  });

  menu.addItem((item) => {
    item
      .setTitle("새 폴더")
      .setIcon("folder-plus")
      .onClick(() => {
        new CreateModal(app, explorerState, "", "folder").open();
      });
  });

  menu.showAtMouseEvent(event);
}
