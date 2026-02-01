/**
 * Explorer View - 파일 탐색기 사이드바 뷰
 */

import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type IntegrationAIPlugin from "../main";
import { ExplorerState } from "./explorer-state";
import { ExplorerViewState } from "./explorer-types";
import { renderFileTree, showEmptyContextMenu, CreateModal } from "./components";

export const EXPLORER_VIEW_TYPE = "integration-explorer-view";

export class ExplorerView extends ItemView {
  private plugin: IntegrationAIPlugin;
  private explorerState: ExplorerState | null = null;
  private unsubscribe: (() => void) | null = null;
  private treeContentEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: IntegrationAIPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return EXPLORER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "파일 탐색기";
  }

  getIcon(): string {
    return "folder-tree";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("explorer-view-container");

    // Vault 경로 가져오기
    const vaultPath = (this.app.vault.adapter as { basePath?: string }).basePath;

    if (!vaultPath) {
      container.createEl("div", {
        cls: "explorer-error-container",
        text: "Vault 경로를 찾을 수 없습니다",
      });
      return;
    }

    // ExplorerState 초기화
    this.explorerState = new ExplorerState(vaultPath);

    // 상태 변경 구독
    this.unsubscribe = this.explorerState.subscribe((state) => {
      this.render(state);
    });

    // 초기 로드
    await this.explorerState.refresh();

    // Vault 이벤트 리스너 등록 (자동 새로고침)
    this.registerEvent(
      this.app.vault.on("create", () => this.explorerState?.refreshDebounced())
    );
    this.registerEvent(
      this.app.vault.on("delete", () => this.explorerState?.refreshDebounced())
    );
    this.registerEvent(
      this.app.vault.on("rename", () => this.explorerState?.refreshDebounced())
    );

    // 외부 변경 감지 (창 포커스 시)
    this.registerDomEvent(window, "focus", () => {
      this.explorerState?.refreshDebounced(500); // 약간의 딜레이
    });
  }

  async onClose(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.explorerState) {
      this.explorerState.destroy();
      this.explorerState = null;
    }
  }

  private render(state: ExplorerViewState): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();

    // 헤더
    this.renderHeader(container);

    // 콘텐츠 영역
    this.treeContentEl = container.createEl("div", { cls: "explorer-content" });

    // 파일 트리
    if (this.explorerState) {
      renderFileTree(this.treeContentEl, state, this.explorerState, this.app);
    }

    // 빈 영역 우클릭 메뉴
    this.treeContentEl.oncontextmenu = (e) => {
      // 아이템 위에서 우클릭한 경우 무시 (아이템 자체 메뉴 표시)
      const target = e.target as HTMLElement;
      if (target.closest(".explorer-item")) {
        return;
      }

      e.preventDefault();
      if (this.explorerState) {
        showEmptyContextMenu(e, this.explorerState, this.app);
      }
    };
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createEl("div", { cls: "explorer-header" });

    // 제목
    const title = header.createEl("div", { cls: "explorer-title" });
    const titleIcon = title.createEl("span", { cls: "explorer-title-icon" });
    setIcon(titleIcon, "folder-tree");
    title.createEl("span", { text: "파일 탐색기" });

    // 헤더 액션
    const actions = header.createEl("div", { cls: "explorer-header-actions" });

    // 새로 만들기 (파일)
    const newFileBtn = actions.createEl("button", {
      cls: "explorer-header-btn",
      text: "새 파일",
    });
    newFileBtn.onclick = () => {
      if (this.explorerState) {
        new CreateModal(this.app, this.explorerState, "", "file").open();
      }
    };

    // 새로 만들기 (폴더)
    const newFolderBtn = actions.createEl("button", {
      cls: "explorer-header-btn",
      text: "새 폴더",
    });
    newFolderBtn.onclick = () => {
      if (this.explorerState) {
        new CreateModal(this.app, this.explorerState, "", "folder").open();
      }
    };

    // 모두 접기 버튼
    const collapseBtn = actions.createEl("button", {
      cls: "explorer-header-btn",
      text: "접기",
    });
    collapseBtn.onclick = async () => {
      await this.explorerState?.collapseAll();
    };

    // 새로고침 버튼
    const refreshBtn = actions.createEl("button", {
      cls: "explorer-header-btn",
      text: "새로고침",
    });
    refreshBtn.onclick = async () => {
      refreshBtn.addClass("explorer-btn-spin");
      await this.explorerState?.refresh();
      refreshBtn.removeClass("explorer-btn-spin");
    };
  }
}
