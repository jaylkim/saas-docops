/**
 * Delete Remote Modal - 원격 저장소 연결 해제 확인 모달
 */

import { Modal, App, Notice, setIcon } from "obsidian";
import { GitState } from "../git-state";
import { ICON_NAMES } from "../../shared/icons";

export class DeleteRemoteModal extends Modal {
  private gitState: GitState;
  private currentUrl: string;

  constructor(app: App, gitState: GitState, currentUrl: string) {
    super(app);
    this.gitState = gitState;
    this.currentUrl = currentUrl;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("git-delete-remote-modal");

    // Header
    const header = contentEl.createEl("div", { cls: "git-modal-header" });
    const headerIcon = header.createEl("span", { cls: "git-modal-header-icon git-modal-icon-warning" });
    setIcon(headerIcon, ICON_NAMES.unlink);
    header.createEl("h2", { text: "원격 저장소 연결 해제" });

    // Warning message
    const warning = contentEl.createEl("div", { cls: "git-delete-warning" });
    const warningIcon = warning.createEl("span", { cls: "git-delete-warning-icon" });
    setIcon(warningIcon, ICON_NAMES.warning);
    warning.createEl("span", { text: "원격 저장소와의 연결을 해제합니다." });

    // Current URL display
    const urlSection = contentEl.createEl("div", { cls: "git-remote-current-section" });
    urlSection.createEl("label", { text: "연결 해제할 저장소", cls: "git-remote-input-label" });
    const currentUrlDisplay = urlSection.createEl("div", { cls: "git-remote-current-url" });
    currentUrlDisplay.createEl("code", { text: this.currentUrl });

    // Info message
    const info = contentEl.createEl("div", { cls: "git-delete-info" });
    const infoIcon = info.createEl("span", { cls: "git-delete-info-icon" });
    setIcon(infoIcon, ICON_NAMES.info);
    info.createEl("span", { text: "로컬 저장소와 파일은 유지됩니다. 원격 서버의 저장소도 삭제되지 않습니다." });

    // Actions
    const actions = contentEl.createEl("div", { cls: "git-modal-actions" });

    const cancelBtn = actions.createEl("button", {
      cls: "git-btn git-btn-secondary",
      text: "취소",
    });
    cancelBtn.onclick = () => this.close();

    const deleteBtn = actions.createEl("button", {
      cls: "git-btn git-btn-danger",
      text: "연결 해제",
    });
    deleteBtn.onclick = () => this.handleDelete();
  }

  private async handleDelete(): Promise<void> {
    const deleteBtn = this.contentEl.querySelector(".git-btn-danger") as HTMLButtonElement;
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.textContent = "해제 중...";
      deleteBtn.addClass("git-btn-loading");
    }

    const result = await this.gitState.removeRemote();

    if (result.success) {
      new Notice(result.message);
      this.close();
    } else {
      new Notice(`${result.message}: ${result.error || ""}`);
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = "연결 해제";
        deleteBtn.removeClass("git-btn-loading");
      }
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
