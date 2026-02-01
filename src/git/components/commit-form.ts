/**
 * Commit Form - 저장(커밋) 메시지 입력
 */

import { Notice } from "obsidian";
import { GitState } from "../git-state";
import { GitViewState, GIT_ICONS } from "../git-types";

export function renderCommitForm(
  container: HTMLElement,
  state: GitViewState,
  gitState: GitState
): void {
  container.empty();
  container.addClass("git-commit-form");

  const status = state.status;
  if (!status || !status.isRepo) {
    return;
  }

  // 변경사항 없으면 폼 숨김
  if (status.files.length === 0) {
    return;
  }

  // 라벨
  const label = container.createEl("div", { cls: "git-commit-label" });
  label.createEl("span", { text: `${GIT_ICONS.commit} 버전 설명:` });

  // 입력 컨테이너
  const inputContainer = container.createEl("div", { cls: "git-commit-input-container" });

  // 텍스트 입력
  const input = inputContainer.createEl("input", {
    cls: "git-commit-input",
    type: "text",
    placeholder: "어떤 내용을 작성했나요? (예: 문서 업데이트)"
  }) as HTMLInputElement;

  input.value = state.commitMessage;

  input.oninput = () => {
    gitState.setCommitMessage(input.value);
  };

  // Enter 키로 저장
  input.onkeydown = async (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      await handleCommit(gitState, state);
    }
  };

  // 빠른 메시지 제안
  const suggestions = container.createEl("div", { cls: "git-commit-suggestions" });
  suggestions.createEl("span", { cls: "git-suggestions-label", text: "빠른 선택:" });

  const quickMessages = [
    "문서 업데이트",
    "오타 수정",
    "내용 보강",
    "초안 작성",
    "리뷰 반영"
  ];

  for (const msg of quickMessages) {
    const chip = suggestions.createEl("button", {
      cls: "git-suggestion-chip",
      text: msg
    });
    chip.onclick = () => {
      input.value = msg;
      gitState.setCommitMessage(msg);
      input.focus();
    };
  }

  // 액션 버튼들
  const actions = container.createEl("div", { cls: "git-commit-actions" });

  // 저장 & 올리기 버튼 (메인)
  const commitPushBtn = actions.createEl("button", {
    cls: "git-btn git-btn-primary git-btn-large", // Large button
    attr: { style: "width: 100%; justify-content: center;" }, // Full width
    text: `${GIT_ICONS.push} 버전 저장 & 업로드`
  });

  if (!state.commitMessage.trim()) {
    commitPushBtn.disabled = true;
  }

  commitPushBtn.onclick = async () => {
    await handleCommit(gitState, state);
    input.value = "";
  };
}

async function handleCommit(gitState: GitState, state: GitViewState): Promise<void> {
  if (!state.commitMessage.trim()) {
    new Notice("저장 메시지를 입력하세요");
    return;
  }

  const status = state.status;
  if (!status) return;

  // staged가 없으면 전체 stage
  if (status.staged.length === 0) {
    await gitState.stageAll();
  }

  const result = await gitState.commitAndPush();
  const icon = result.success ? GIT_ICONS.success : GIT_ICONS.error;
  new Notice(`${icon} ${result.message}`);
}
