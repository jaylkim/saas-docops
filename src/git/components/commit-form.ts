/**
 * Commit Form - 저장(커밋) 메시지 입력
 */

import { Notice, setIcon } from "obsidian";
import { GitState } from "../git-state";
import { GitViewState, GIT_ICONS, GIT_TEXT_ICONS } from "../git-types";
import { getExtendedPath } from "../../wizard/environment-checker";

export function renderCommitForm(
  container: HTMLElement,
  state: GitViewState,
  gitState: GitState
): void {
  // ... (unchanged code omitted, reusing surrounding logic in mind) ...
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

  // 선택된 파일 확인
  const selectedFiles = Array.from(state.selectedFiles);
  const hasSelection = selectedFiles.length > 0;

  // 라벨 + AI 버튼
  const labelRow = container.createEl("div", { cls: "git-commit-label-row" });
  const label = labelRow.createEl("div", { cls: "git-commit-label" });
  label.createEl("span", { text: "버전 설명:" });
  if (!hasSelection) {
    label.createEl("span", {
      cls: "git-commit-hint",
      text: " (파일을 선택하세요)"
    });
  }

  // AI 생성 버튼 (라벨 옆)
  const aiButton = labelRow.createEl("button", {
    cls: "git-suggestion-chip git-ai-chip",
    text: "AI 생성"
  });
  aiButton.disabled = !hasSelection;

  // 입력 컨테이너
  const inputContainer = container.createEl("div", { cls: "git-commit-input-container" });

  // 텍스트 입력 (멀티라인)
  const input = inputContainer.createEl("textarea", {
    cls: "git-commit-input",
    placeholder: hasSelection
      ? "어떤 내용을 작성했나요? (예: 문서 업데이트)"
      : "먼저 위에서 파일을 선택하세요",
    attr: { rows: "3" }
  }) as HTMLTextAreaElement;

  input.value = state.commitMessage;
  input.disabled = !hasSelection;

  // AI 버튼 클릭 핸들러 (input 참조 후 설정)
  aiButton.onclick = () => generateAICommitMessage(gitState, selectedFiles, input, aiButton);

  input.oninput = () => {
    gitState.setCommitMessage(input.value);
  };

  // Cmd/Ctrl+Enter 키로 저장
  input.onkeydown = async (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && input.value.trim() && hasSelection) {
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
    chip.disabled = !hasSelection;
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
    attr: { style: "width: 100%; justify-content: center;" } // Full width
  });

  // Icon
  const btnIcon = commitPushBtn.createEl("span", { cls: "git-btn-icon" });
  setIcon(btnIcon, GIT_ICONS.push);

  // Text
  commitPushBtn.createEl("span", { text: "버전 저장 & 업로드" });

  if (!state.commitMessage.trim() || !hasSelection) {
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
  // Notice에는 텍스트 이모지 사용
  const icon = result.success ? GIT_TEXT_ICONS.success : GIT_TEXT_ICONS.error;
  new Notice(`${icon} ${result.message}`);
}

/**
 * AI 커밋 메시지 생성
 */
async function generateAICommitMessage(
  gitState: GitState,
  selectedFiles: string[],
  input: HTMLTextAreaElement,
  aiButton: HTMLButtonElement
): Promise<void> {
  const originalText = aiButton.textContent || "AI 생성";

  try {
    // 로딩 상태
    aiButton.textContent = "생성 중...";
    aiButton.disabled = true;

    // 1. 선택된 파일들의 git diff 가져오기
    const { diff } = await gitState.getDiff(selectedFiles);

    if (!diff || !diff.trim()) {
      new Notice("변경사항이 없습니다");
      return;
    }

    // 2. diff 크기 제한 (4000자)
    const truncatedDiff = diff.length > 4000
      ? diff.substring(0, 4000) + "\n... (truncated)"
      : diff;

    // 3. 프롬프트 구성
    const prompt = `다음 git diff를 분석하고, 한국어로 간결한 커밋 메시지를 생성해주세요.
- 50자 이내
- 명령형 (예: "문서 업데이트", "버그 수정")
- 커밋 메시지만 출력

${truncatedDiff}`;

    // 4. claude -p 실행 (stdin으로 프롬프트 전달, cwd 설정으로 CLAUDE.md/스킬 활용)
    const repoPath = gitState.getRepoPath();
    const result = await runClaudeWithPrompt(prompt, repoPath);

    if (!result.success) {
      new Notice(result.error || "AI 생성 실패");
      return;
    }

    // 5. 결과 처리
    const message = result.message?.trim();
    if (!message) {
      new Notice("AI가 메시지를 생성하지 못했습니다");
      return;
    }

    // 6. 입력 필드에 결과 채우기
    input.value = message;
    gitState.setCommitMessage(message);
    input.focus();
    new Notice("AI 커밋 메시지 생성 완료");

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    new Notice(`AI 생성 실패: ${errorMsg}`);
  } finally {
    // 버튼 상태 복원
    aiButton.textContent = originalText;
    aiButton.disabled = false;
  }
}

/**
 * claude -p 실행 (stdin으로 프롬프트 전달하여 shell escape 문제 회피)
 * @param prompt 프롬프트 문자열
 * @param cwd 작업 디렉토리 (CLAUDE.md, 스킬 활용을 위해 필요)
 */
function runClaudeWithPrompt(prompt: string, cwd?: string): Promise<{ success: boolean; message?: string; error?: string }> {
  return new Promise((resolve) => {
    const { spawn } = require("child_process");

    const env = { ...process.env, PATH: getExtendedPath() };
    const child = spawn("claude", ["-p"], { env, cwd, timeout: 30000 });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("error", (err: Error) => {
      if (err.message.includes("ENOENT")) {
        resolve({ success: false, error: "Claude Code가 설치되어 있지 않습니다" });
      } else {
        resolve({ success: false, error: err.message });
      }
    });

    child.on("close", (code: number) => {
      if (code === 0) {
        resolve({ success: true, message: stdout });
      } else {
        resolve({ success: false, error: stderr || "알 수 없는 오류" });
      }
    });

    // stdin으로 프롬프트 전달
    child.stdin.write(prompt);
    child.stdin.end();
  });
}
