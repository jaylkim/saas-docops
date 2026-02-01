/**
 * Edit Remote Modal - 원격 저장소 URL 수정 모달
 */

import { Modal, App, Notice, setIcon } from "obsidian";
import { GitState } from "../git-state";
import { ICON_NAMES } from "../../shared/icons";

export class EditRemoteModal extends Modal {
  private gitState: GitState;
  private currentUrl: string;
  private urlInput: HTMLInputElement | null = null;

  constructor(app: App, gitState: GitState, currentUrl: string) {
    super(app);
    this.gitState = gitState;
    this.currentUrl = currentUrl;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("git-edit-remote-modal");

    // Header
    const header = contentEl.createEl("div", { cls: "git-modal-header" });
    const headerIcon = header.createEl("span", { cls: "git-modal-header-icon" });
    setIcon(headerIcon, ICON_NAMES.modified);
    header.createEl("h2", { text: "원격 저장소 수정" });

    // Description
    contentEl.createEl("p", {
      cls: "git-modal-desc",
      text: "원격 저장소 URL을 수정합니다.",
    });

    // Current URL display
    const currentSection = contentEl.createEl("div", { cls: "git-remote-current-section" });
    currentSection.createEl("label", { text: "현재 URL", cls: "git-remote-input-label" });
    const currentUrlDisplay = currentSection.createEl("div", { cls: "git-remote-current-url" });
    currentUrlDisplay.createEl("code", { text: this.currentUrl });

    // Input section
    const inputSection = contentEl.createEl("div", { cls: "git-remote-input-section" });
    inputSection.createEl("label", { text: "새 URL", cls: "git-remote-input-label" });

    this.urlInput = inputSection.createEl("input", {
      cls: "git-remote-url-input",
      attr: {
        type: "text",
        placeholder: "git@github.com:사용자/저장소.git",
        spellcheck: "false",
      },
    });
    this.urlInput.value = this.currentUrl;

    // Hint
    const hint = inputSection.createEl("p", { cls: "git-remote-hint" });
    hint.createEl("span", { text: "SSH (git@...) 또는 HTTPS (https://...) 형식으로 입력하세요." });

    // Actions
    const actions = contentEl.createEl("div", { cls: "git-modal-actions" });

    const cancelBtn = actions.createEl("button", {
      cls: "git-btn git-btn-secondary",
      text: "취소",
    });
    cancelBtn.onclick = () => this.close();

    const saveBtn = actions.createEl("button", {
      cls: "git-btn git-btn-primary",
      text: "저장",
    });
    saveBtn.onclick = () => this.handleSave();

    // Enter key handler
    this.urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.handleSave();
      }
    });

    // Focus and select input
    setTimeout(() => {
      this.urlInput?.focus();
      this.urlInput?.select();
    }, 50);
  }

  private async handleSave(): Promise<void> {
    const url = this.urlInput?.value.trim();
    if (!url) {
      new Notice("URL을 입력해주세요.");
      return;
    }

    if (url === this.currentUrl) {
      new Notice("변경된 내용이 없습니다.");
      this.close();
      return;
    }

    const saveBtn = this.contentEl.querySelector(".git-btn-primary") as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "저장 중...";
      saveBtn.addClass("git-btn-loading");
    }

    const result = await this.gitState.setRemoteUrl(url);

    if (result.success) {
      new Notice(result.message);
      this.close();
    } else {
      new Notice(`${result.message}: ${result.error || ""}`);
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "저장";
        saveBtn.removeClass("git-btn-loading");
      }
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
