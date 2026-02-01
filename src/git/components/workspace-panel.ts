/**
 * Workspace Panel - 작업 공간(브랜치) 관리
 */

import { Notice, Modal, App, setIcon } from "obsidian";
import { GitState } from "../git-state";
import { GitViewState, GitBranch, GIT_TERMS } from "../git-types";
import { ICON_NAMES } from "../../shared/icons";

export function renderWorkspacePanel(
  container: HTMLElement,
  state: GitViewState,
  gitState: GitState,
  app: App
): void {
  container.empty();
  container.addClass("git-workspace-panel");

  const status = state.status;
  if (!status || !status.isRepo) {
    container.createEl("div", {
      cls: "git-panel-empty",
      text: "Git 저장소가 아닙니다"
    });
    return;
  }

  // 현재 작업 공간 표시
  const currentSection = container.createEl("div", { cls: "git-current-workspace" });
  currentSection.createEl("div", { cls: "git-section-label", text: "현재 작업 공간" });

  const currentBox = currentSection.createEl("div", { cls: "git-workspace-current-box" });
  const workspaceIcon = currentBox.createEl("span", { cls: "git-workspace-icon" });
  setIcon(workspaceIcon, status.isMainBranch ? ICON_NAMES.home : ICON_NAMES.branch);
  currentBox.createEl("span", { cls: "git-workspace-name", text: status.currentBranch });

  if (status.isMainBranch) {
    currentBox.createEl("span", { cls: "git-badge git-badge-main", text: "메인" });
  }

  // 새 작업 공간 만들기
  const createSection = container.createEl("div", { cls: "git-create-workspace" });
  createSection.createEl("div", { cls: "git-section-label", text: "새 작업 공간 만들기" });

  const createBox = createSection.createEl("div", { cls: "git-create-box" });

  const input = createBox.createEl("input", {
    cls: "git-workspace-input",
    type: "text",
    placeholder: "작업 이름 입력 (예: 로그인-기능-추가)"
  }) as HTMLInputElement;

  const createBtn = createBox.createEl("button", {
    cls: "git-btn git-btn-primary",
    text: "만들기"
  });

  createBtn.onclick = async () => {
    const name = input.value.trim();
    if (!name) {
      new Notice("작업 공간 이름을 입력하세요");
      return;
    }

    // 변경사항이 있으면 경고
    if (status.files.length > 0) {
      const confirmed = await showConfirmModal(
        app,
        "저장하지 않은 변경사항이 있습니다",
        "새 작업 공간으로 이동하면 현재 변경사항이 임시 보관됩니다. 계속하시겠습니까?"
      );

      if (!confirmed) return;

      // Stash 먼저
      await gitState.getService().stash();
    }

    createBtn.disabled = true;
    createBtn.addClass("git-btn-loading");
    const result = await gitState.createBranch(name, true);
    createBtn.removeClass("git-btn-loading");
    createBtn.disabled = false;

    new Notice(result.message);

    if (result.success) {
      input.value = "";
    }
  };

  // Enter 키 지원
  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      createBtn.click();
    }
  };

  // 작업 공간 목록
  if (state.branches.length > 1) {
    const listSection = container.createEl("div", { cls: "git-workspace-list" });
    listSection.createEl("div", {
      cls: "git-section-label",
      text: `다른 작업 공간 (${state.branches.length - 1}개)`
    });

    const list = listSection.createEl("div", { cls: "git-workspace-items" });

    for (const branch of state.branches) {
      if (branch.current) continue; // 현재 브랜치는 스킵

      const item = list.createEl("div", { cls: "git-workspace-item" });

      const info = item.createEl("div", { cls: "git-workspace-item-info" });
      const itemIcon = info.createEl("span", { cls: "git-workspace-icon" });
      setIcon(itemIcon, branch.isMain ? ICON_NAMES.home : ICON_NAMES.branch);
      info.createEl("span", { cls: "git-workspace-item-name", text: branch.name });

      if (branch.isMain) {
        info.createEl("span", { cls: "git-badge git-badge-main", text: "메인" });
      }

      const switchBtn = item.createEl("button", {
        cls: "git-btn-sm",
        text: "전환"
      });

      switchBtn.onclick = async () => {
        // 변경사항 확인
        if (status.files.length > 0) {
          new Notice("저장하지 않은 변경사항이 있습니다. 먼저 저장하세요.");
          return;
        }

        switchBtn.disabled = true;
        switchBtn.addClass("git-btn-loading");
        const result = await gitState.switchBranch(branch.name);
        switchBtn.removeClass("git-btn-loading");
        switchBtn.disabled = false;

        new Notice(result.message);
      };
    }
  }

  // 도움말
  const helpBox = container.createEl("div", { cls: "git-help-box" });
  const helpTitle = helpBox.createEl("div", { cls: "git-help-title" });
  const helpIcon = helpTitle.createEl("span");
  setIcon(helpIcon, ICON_NAMES.lightbulb);
  helpTitle.createEl("span", { text: " 작업 공간이란?" });
  helpBox.createEl("div", {
    cls: "git-help-text",
    text: "작업 공간은 팀의 메인 버전과 별개로 내 작업을 진행할 수 있는 공간입니다. 작업이 완료되면 '검토 요청'을 통해 메인에 합칠 수 있습니다."
  });
}

// 확인 모달
function showConfirmModal(app: App, title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = new ConfirmModal(app, title, message, resolve);
    modal.open();
  });
}

class ConfirmModal extends Modal {
  private title: string;
  private message: string;
  private resolve: (value: boolean) => void;

  constructor(app: App, title: string, message: string, resolve: (value: boolean) => void) {
    super(app);
    this.title = title;
    this.message = message;
    this.resolve = resolve;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("git-confirm-modal");

    contentEl.createEl("h3", { text: this.title });
    contentEl.createEl("p", { text: this.message });

    const actions = contentEl.createEl("div", { cls: "git-modal-actions" });

    const cancelBtn = actions.createEl("button", {
      cls: "git-btn git-btn-secondary",
      text: "취소"
    });
    cancelBtn.onclick = () => {
      this.resolve(false);
      this.close();
    };

    const confirmBtn = actions.createEl("button", {
      cls: "git-btn git-btn-primary",
      text: "계속"
    });
    confirmBtn.onclick = () => {
      this.resolve(true);
      this.close();
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}
