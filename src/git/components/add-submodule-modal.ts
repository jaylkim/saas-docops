import { App, Modal, Setting, Notice } from "obsidian";
import { GitState } from "../git-state";

export class AddSubmoduleModal extends Modal {
  private gitState: GitState;
  private url: string = "";
  private path: string = "";

  constructor(app: App, gitState: GitState) {
    super(app);
    this.gitState = gitState;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "하위 저장소(Submodule) 추가" });

    new Setting(contentEl)
      .setName("저장소 URL")
      .setDesc("Git 저장소 주소 (HTTPS 또는 SSH)")
      .addText((text) =>
        text
          .setPlaceholder("https://github.com/username/repo.git")
          .onChange((value) => {
            this.url = value;
            // 자동으로 path 제안
            if (!this.path && value) {
              const match = value.match(/\/([^/]+?)(?:\.git)?$/);
              if (match) {
                // TODO: UI에 반영하려면 stateful하게 관리하거나 input을 찾아야 함.
                // 간단하게는 유저가 직접 입력하게 둠.
              }
            }
          })
      );

    new Setting(contentEl)
      .setName("저장 경로")
      .setDesc("Vault 내 상대 경로 (예: lib/my-repo)")
      .addText((text) =>
        text
          .setPlaceholder("lib/my-repo")
          .onChange((value) => {
            this.path = value;
          })
      );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("추가하기")
        .setCta()
        .onClick(async () => {
          if (!this.url || !this.path) {
            new Notice("URL과 경로를 모두 입력해주세요.");
            return;
          }

          this.close();
          new Notice("하위 저장소를 추가하는 중...");

          const result = await this.gitState.addSubmodule(this.url, this.path);
          new Notice(result.message);
        })
    );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
