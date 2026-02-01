/**
 * Add Remote Modal - 원격 저장소 연결 모달
 */

import { Modal, App, Notice, setIcon } from "obsidian";
import { GitState } from "../git-state";
import { ICON_NAMES } from "../../shared/icons";

export class AddRemoteModal extends Modal {
  private gitState: GitState;
  private urlInput: HTMLInputElement | null = null;

  constructor(app: App, gitState: GitState) {
    super(app);
    this.gitState = gitState;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("git-add-remote-modal");

    // Header
    const header = contentEl.createEl("div", { cls: "git-modal-header" });
    const headerIcon = header.createEl("span", { cls: "git-modal-header-icon" });
    setIcon(headerIcon, ICON_NAMES.cloud);
    header.createEl("h2", { text: "원격 저장소 연결" });

    // Description
    contentEl.createEl("p", {
      cls: "git-modal-desc",
      text: "GitHub, GitLab, Bitbucket 등의 원격 저장소 URL을 입력하세요.",
    });

    // Info box with examples
    const infoBox = contentEl.createEl("div", { cls: "git-remote-info-box" });
    infoBox.createEl("div", { cls: "git-remote-info-title", text: "URL 예시" });

    const examples = infoBox.createEl("div", { cls: "git-remote-examples" });

    const githubExample = examples.createEl("div", { cls: "git-remote-example" });
    const githubIcon = githubExample.createEl("span", { cls: "git-remote-provider-icon" });
    setIcon(githubIcon, ICON_NAMES.github);
    githubExample.createEl("code", { text: "git@github.com:사용자/저장소.git" });

    const gitlabExample = examples.createEl("div", { cls: "git-remote-example" });
    const gitlabIcon = gitlabExample.createEl("span", { cls: "git-remote-provider-icon" });
    setIcon(gitlabIcon, ICON_NAMES.gitlab);
    gitlabExample.createEl("code", { text: "git@gitlab.com:사용자/저장소.git" });

    const bitbucketExample = examples.createEl("div", { cls: "git-remote-example" });
    const bitbucketIcon = bitbucketExample.createEl("span", { cls: "git-remote-provider-icon" });
    setIcon(bitbucketIcon, ICON_NAMES.bitbucket);
    bitbucketExample.createEl("code", { text: "git@bitbucket.org:사용자/저장소.git" });

    // Input section
    const inputSection = contentEl.createEl("div", { cls: "git-remote-input-section" });
    inputSection.createEl("label", { text: "저장소 URL", cls: "git-remote-input-label" });

    this.urlInput = inputSection.createEl("input", {
      cls: "git-remote-url-input",
      attr: {
        type: "text",
        placeholder: "git@github.com:사용자/저장소.git",
        spellcheck: "false",
      },
    });

    // Hint
    const hint = inputSection.createEl("p", { cls: "git-remote-hint" });
    hint.createEl("span", { text: "💡 저장소 페이지에서 " });
    hint.createEl("strong", { text: "Code → SSH" });
    hint.createEl("span", { text: " 탭의 URL을 복사하세요." });

    // Actions
    const actions = contentEl.createEl("div", { cls: "git-modal-actions" });

    const cancelBtn = actions.createEl("button", {
      cls: "git-btn git-btn-secondary",
      text: "취소",
    });
    cancelBtn.onclick = () => this.close();

    const connectBtn = actions.createEl("button", {
      cls: "git-btn git-btn-primary",
      text: "연결하기",
    });
    connectBtn.onclick = () => this.handleConnect();

    // Enter key handler
    this.urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.handleConnect();
      }
    });

    // Focus input
    setTimeout(() => this.urlInput?.focus(), 50);
  }

  private async handleConnect(): Promise<void> {
    const url = this.urlInput?.value.trim();
    if (!url) {
      new Notice("URL을 입력해주세요.");
      return;
    }

    const connectBtn = this.contentEl.querySelector(".git-btn-primary") as HTMLButtonElement;
    if (connectBtn) {
      connectBtn.disabled = true;
      connectBtn.textContent = "연결 중...";
      connectBtn.addClass("git-btn-loading");
    }

    const result = await this.gitState.addRemote(url);

    if (result.success) {
      new Notice(result.message);
      this.close();
    } else {
      new Notice(`${result.message}: ${result.error || ""}`);
      if (connectBtn) {
        connectBtn.disabled = false;
        connectBtn.textContent = "연결하기";
        connectBtn.removeClass("git-btn-loading");
      }
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
