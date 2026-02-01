/**
 * Explorer Modals - 생성/이름변경/삭제 모달
 */

import { Modal, App, Notice, setIcon } from "obsidian";
import { ExplorerState } from "../explorer-state";
import { FileEntry } from "../explorer-types";

/**
 * 파일/폴더 생성 모달
 */
export class CreateModal extends Modal {
  private explorerState: ExplorerState;
  private parentPath: string;
  private type: "file" | "folder";
  private nameInput: HTMLInputElement | null = null;

  constructor(
    app: App,
    explorerState: ExplorerState,
    parentPath: string,
    type: "file" | "folder"
  ) {
    super(app);
    this.explorerState = explorerState;
    this.parentPath = parentPath;
    this.type = type;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("explorer-modal");

    // 헤더
    const header = contentEl.createEl("div", { cls: "explorer-modal-header" });
    const headerIcon = header.createEl("span", { cls: "explorer-modal-icon" });
    setIcon(headerIcon, this.type === "file" ? "file-plus" : "folder-plus");
    header.createEl("h2", {
      text: this.type === "file" ? "새 파일" : "새 폴더",
    });

    // 위치 표시
    if (this.parentPath) {
      contentEl.createEl("p", {
        cls: "explorer-modal-location",
        text: `위치: ${this.parentPath}`,
      });
    }

    // 입력 필드
    const inputSection = contentEl.createEl("div", { cls: "explorer-modal-input-section" });
    inputSection.createEl("label", {
      text: this.type === "file" ? "파일 이름" : "폴더 이름",
      cls: "explorer-modal-label",
    });

    this.nameInput = inputSection.createEl("input", {
      cls: "explorer-modal-input",
      attr: {
        type: "text",
        placeholder: this.type === "file" ? "example.md" : "새 폴더",
        spellcheck: "false",
      },
    });

    // 힌트
    if (this.type === "file") {
      inputSection.createEl("p", {
        cls: "explorer-modal-hint",
        text: "확장자를 포함해서 입력하세요 (예: note.md, data.json)",
      });
    }

    // 버튼
    const actions = contentEl.createEl("div", { cls: "explorer-modal-actions" });

    const cancelBtn = actions.createEl("button", {
      cls: "explorer-btn explorer-btn-secondary",
      text: "취소",
    });
    cancelBtn.onclick = () => this.close();

    const createBtn = actions.createEl("button", {
      cls: "explorer-btn explorer-btn-primary",
      text: "생성",
    });
    createBtn.onclick = () => this.handleCreate();

    // Enter 키 처리
    this.nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.handleCreate();
      } else if (e.key === "Escape") {
        this.close();
      }
    });

    // 포커스
    setTimeout(() => this.nameInput?.focus(), 50);
  }

  private async handleCreate(): Promise<void> {
    const name = this.nameInput?.value.trim();
    if (!name) {
      new Notice("이름을 입력해주세요.");
      return;
    }

    // 유효하지 않은 문자 체크
    if (/[\\/:*?"<>|]/.test(name)) {
      new Notice("파일/폴더 이름에 사용할 수 없는 문자가 포함되어 있습니다.");
      return;
    }

    const createBtn = this.contentEl.querySelector(".explorer-btn-primary") as HTMLButtonElement;
    if (createBtn) {
      createBtn.disabled = true;
      createBtn.textContent = "생성 중...";
    }

    const result =
      this.type === "file"
        ? await this.explorerState.createFile(this.parentPath, name)
        : await this.explorerState.createDirectory(this.parentPath, name);

    if (result.success) {
      new Notice(result.message);
      this.close();
    } else {
      new Notice(`${result.message}: ${result.error || ""}`);
      if (createBtn) {
        createBtn.disabled = false;
        createBtn.textContent = "생성";
      }
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * 이름 변경 모달
 */
export class RenameModal extends Modal {
  private explorerState: ExplorerState;
  private entry: FileEntry;
  private nameInput: HTMLInputElement | null = null;

  constructor(app: App, explorerState: ExplorerState, entry: FileEntry) {
    super(app);
    this.explorerState = explorerState;
    this.entry = entry;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("explorer-modal");

    // 헤더
    const header = contentEl.createEl("div", { cls: "explorer-modal-header" });
    const headerIcon = header.createEl("span", { cls: "explorer-modal-icon" });
    setIcon(headerIcon, "pencil");
    header.createEl("h2", { text: "이름 바꾸기" });

    // 현재 이름 표시
    contentEl.createEl("p", {
      cls: "explorer-modal-current",
      text: `현재: ${this.entry.name}`,
    });

    // 입력 필드
    const inputSection = contentEl.createEl("div", { cls: "explorer-modal-input-section" });
    inputSection.createEl("label", {
      text: "새 이름",
      cls: "explorer-modal-label",
    });

    this.nameInput = inputSection.createEl("input", {
      cls: "explorer-modal-input",
      attr: {
        type: "text",
        value: this.entry.name,
        spellcheck: "false",
      },
    });

    // 버튼
    const actions = contentEl.createEl("div", { cls: "explorer-modal-actions" });

    const cancelBtn = actions.createEl("button", {
      cls: "explorer-btn explorer-btn-secondary",
      text: "취소",
    });
    cancelBtn.onclick = () => this.close();

    const renameBtn = actions.createEl("button", {
      cls: "explorer-btn explorer-btn-primary",
      text: "변경",
    });
    renameBtn.onclick = () => this.handleRename();

    // Enter 키 처리
    this.nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.handleRename();
      } else if (e.key === "Escape") {
        this.close();
      }
    });

    // 포커스 및 전체 선택 (확장자 제외)
    setTimeout(() => {
      if (this.nameInput) {
        this.nameInput.focus();
        // 파일인 경우 확장자 제외하고 선택
        if (!this.entry.isDirectory && this.entry.extension) {
          const nameWithoutExt = this.entry.name.length - this.entry.extension.length;
          this.nameInput.setSelectionRange(0, nameWithoutExt);
        } else {
          this.nameInput.select();
        }
      }
    }, 50);
  }

  private async handleRename(): Promise<void> {
    const newName = this.nameInput?.value.trim();
    if (!newName) {
      new Notice("이름을 입력해주세요.");
      return;
    }

    if (newName === this.entry.name) {
      this.close();
      return;
    }

    // 유효하지 않은 문자 체크
    if (/[\\/:*?"<>|]/.test(newName)) {
      new Notice("파일/폴더 이름에 사용할 수 없는 문자가 포함되어 있습니다.");
      return;
    }

    const renameBtn = this.contentEl.querySelector(".explorer-btn-primary") as HTMLButtonElement;
    if (renameBtn) {
      renameBtn.disabled = true;
      renameBtn.textContent = "변경 중...";
    }

    const result = await this.explorerState.rename(this.entry.path, newName);

    if (result.success) {
      new Notice(result.message);
      this.close();
    } else {
      new Notice(`${result.message}: ${result.error || ""}`);
      if (renameBtn) {
        renameBtn.disabled = false;
        renameBtn.textContent = "변경";
      }
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * 삭제 확인 모달
 */
export class DeleteModal extends Modal {
  private explorerState: ExplorerState;
  private entry: FileEntry;

  constructor(app: App, explorerState: ExplorerState, entry: FileEntry) {
    super(app);
    this.explorerState = explorerState;
    this.entry = entry;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("explorer-modal");

    // 헤더
    const header = contentEl.createEl("div", { cls: "explorer-modal-header" });
    const headerIcon = header.createEl("span", { cls: "explorer-modal-icon explorer-modal-icon-danger" });
    setIcon(headerIcon, "trash-2");
    header.createEl("h2", { text: "삭제 확인" });

    // 경고 메시지
    const warningBox = contentEl.createEl("div", { cls: "explorer-modal-warning" });
    const warningIcon = warningBox.createEl("span", { cls: "explorer-warning-icon" });
    setIcon(warningIcon, "alert-triangle");

    const warningText = warningBox.createEl("div", { cls: "explorer-warning-text" });
    warningText.createEl("strong", {
      text: this.entry.isDirectory ? "폴더를 삭제하시겠습니까?" : "파일을 삭제하시겠습니까?",
    });
    warningText.createEl("p", { text: this.entry.name });

    // 안내 메시지
    contentEl.createEl("p", {
      cls: "explorer-modal-info",
      text: "삭제된 항목은 휴지통으로 이동됩니다.",
    });

    // 버튼
    const actions = contentEl.createEl("div", { cls: "explorer-modal-actions" });

    const cancelBtn = actions.createEl("button", {
      cls: "explorer-btn explorer-btn-secondary",
      text: "취소",
    });
    cancelBtn.onclick = () => this.close();

    const deleteBtn = actions.createEl("button", {
      cls: "explorer-btn explorer-btn-danger",
      text: "삭제",
    });
    deleteBtn.onclick = () => this.handleDelete();

    // Escape 키 처리
    this.contentEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.close();
      }
    });
  }

  private async handleDelete(): Promise<void> {
    const deleteBtn = this.contentEl.querySelector(".explorer-btn-danger") as HTMLButtonElement;
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.textContent = "삭제 중...";
    }

    const result = await this.explorerState.delete(this.entry.path);

    if (result.success) {
      new Notice(result.message);
      this.close();
    } else {
      new Notice(`${result.message}: ${result.error || ""}`);
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = "삭제";
      }
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
