/**
 * Claude API Key Step - Step 3
 *
 * Claude Code 사용을 위한 API 키 확인 및 설정
 */

import { Notice, setIcon } from "obsidian";
import type { WizardStep, WizardState } from "../setup-wizard-modal";
import { EnvironmentChecker, type ShellEnvVarInfo } from "../environment-checker";

let apiKeyInfo: ShellEnvVarInfo | null = null;
let isChecking = false;

export function renderClaudeLoginStep(
  container: HTMLElement,
  state: WizardState,
  updateState: (updates: Partial<WizardState>) => void,
  callbacks?: {
    onRunCommand?: (command: string) => void;
    onOpenTerminal?: () => void;
  }
): void {
  container.empty();

  const titleEl = container.createEl("h2", { cls: "wizard-step-title" });
  const titleIcon = titleEl.createSpan({ cls: "wizard-title-icon" });
  setIcon(titleIcon, "key");
  titleEl.createSpan({ text: " API 키 설정" });
  container.createEl("p", {
    text: "Claude Code 사용을 위해 API 키가 필요합니다.",
    cls: "wizard-step-desc",
  });

  const statusContainer = container.createDiv({ cls: "wizard-login-status" });
  const checker = new EnvironmentChecker();

  // Check API key in shell config
  if (!apiKeyInfo && !isChecking) {
    isChecking = true;
    const loadingP = statusContainer.createEl("p");
    const loadingIcon = loadingP.createSpan({ cls: "wizard-loading-icon" });
    setIcon(loadingIcon, "loader");
    loadingP.createSpan({ text: " API 키를 확인하고 있습니다..." });

    checker.checkAnthropicApiKey().then((info) => {
      apiKeyInfo = info;
      isChecking = false;
      if (info && info.found) {
        updateState({ apiKeyConfigured: true });
      }
      renderClaudeLoginStep(container, state, updateState, callbacks);
    });
    return;
  }

  if (isChecking) {
    const loadingP = statusContainer.createEl("p");
    const loadingIcon = loadingP.createSpan({ cls: "wizard-loading-icon" });
    setIcon(loadingIcon, "loader");
    loadingP.createSpan({ text: " API 키를 확인하고 있습니다..." });
    return;
  }

  if (!apiKeyInfo) return;

  // Status display
  if (apiKeyInfo.found) {
    if (!state.apiKeyConfigured) {
      setTimeout(() => updateState({ apiKeyConfigured: true }), 0);
    }
    // API key found
    const successBox = statusContainer.createDiv({ cls: "wizard-status-box status-success" });
    const successIcon = successBox.createEl("div", { cls: "status-icon" });
    setIcon(successIcon, "check-circle");
    const content = successBox.createDiv({ cls: "status-content" });
    content.createEl("h3", { text: "API 키 설정됨" });

    const keyDisplay = content.createDiv({ cls: "api-key-display" });
    keyDisplay.createEl("code", { text: apiKeyInfo.maskedValue });

    const hintP = content.createEl("p", { cls: "status-hint" });
    const folderIcon = hintP.createSpan({ cls: "status-hint-icon" });
    setIcon(folderIcon, "folder");
    hintP.createSpan({ text: ` ${apiKeyInfo.source}` });

    // Option to change
    const changeSection = container.createDiv({ cls: "wizard-login-option" });
    changeSection.createEl("h4", { text: "API 키 변경 (선택)" });

    renderApiKeyInput(changeSection, checker, () => {
      apiKeyInfo = null;
      renderClaudeLoginStep(container, state, updateState, callbacks);
    });
  } else {
    // API key not found
    const warningBox = statusContainer.createDiv({ cls: "wizard-status-box status-warning" });
    const warningIcon = warningBox.createEl("div", { cls: "status-icon" });
    setIcon(warningIcon, "alert-triangle");
    const content = warningBox.createDiv({ cls: "status-content" });
    content.createEl("h3", { text: "API 키가 설정되지 않았습니다" });
    content.createEl("p", {
      text: "터미널에서 Claude Code를 사용하려면 API 키가 필요합니다.",
      cls: "status-hint",
    });

    // Input section
    const inputSection = container.createDiv({ cls: "wizard-login-option" });
    inputSection.createEl("h4", { text: "API 키 입력" });

    renderApiKeyInput(inputSection, checker, () => {
      apiKeyInfo = null;
      renderClaudeLoginStep(container, state, updateState, callbacks);
    });

    // Help
    const helpSection = container.createDiv({ cls: "wizard-note" });
    helpSection.innerHTML = `
      <p><strong>API 키 발급 방법:</strong></p>
      <ol style="margin: 8px 0 0 20px; padding: 0;">
        <li><a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a> 접속</li>
        <li>Settings → API Keys 메뉴</li>
        <li>"Create Key" 클릭하여 새 키 생성</li>
      </ol>
    `;
  }

  // Re-check button
  const actionsRow = container.createDiv({ cls: "wizard-actions-row" });
  const recheckBtn = actionsRow.createEl("button", {
    cls: "wizard-btn wizard-btn-text",
  });
  const recheckIcon = recheckBtn.createSpan({ cls: "wizard-btn-icon" });
  setIcon(recheckIcon, "refresh-cw");
  recheckBtn.createSpan({ text: " 다시 확인" });
  recheckBtn.addEventListener("click", () => {
    apiKeyInfo = null;
    isChecking = false;
    renderClaudeLoginStep(container, state, updateState, callbacks);
  });
}

function renderApiKeyInput(
  container: HTMLElement,
  checker: EnvironmentChecker,
  onSaved: () => void
): void {
  const inputGroup = container.createDiv({ cls: "wizard-input-group" });
  inputGroup.createEl("label", { text: "Anthropic API Key" });

  const inputRow = inputGroup.createDiv({ cls: "wizard-input-row" });

  const input = inputRow.createEl("input", {
    type: "password",
    placeholder: "sk-ant-...",
    cls: "wizard-input",
  }) as HTMLInputElement;

  const saveBtn = inputRow.createEl("button", {
    text: "저장",
    cls: "wizard-btn wizard-btn-primary",
  });

  const statusEl = inputGroup.createDiv({ cls: "wizard-save-status" });

  saveBtn.addEventListener("click", async () => {
    const value = input.value.trim();

    if (!value) {
      new Notice("API 키를 입력해주세요");
      return;
    }

    if (!value.startsWith("sk-ant-")) {
      new Notice("올바른 API 키 형식이 아닙니다 (sk-ant-...)");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "저장 중...";

    const result = await checker.saveAnthropicApiKey(value);

    if (result.success) {
      statusEl.empty();
      const successIcon = statusEl.createSpan({ cls: "wizard-status-icon" });
      setIcon(successIcon, "check-circle");
      statusEl.createSpan({ text: ` ${result.path}에 저장됨` });
      statusEl.className = "wizard-save-status success";
      new Notice("API 키가 저장되었습니다");

      // Refresh after short delay
      setTimeout(() => {
        // Assume success leads to found key on next check
        onSaved();
      }, 1000);
    } else {
      statusEl.empty();
      const errorIcon = statusEl.createSpan({ cls: "wizard-status-icon" });
      setIcon(errorIcon, "x-circle");
      statusEl.createSpan({ text: ` ${result.error}` });
      statusEl.className = "wizard-save-status error";
      saveBtn.disabled = false;
      saveBtn.textContent = "저장";
    }
  });

  const hint = inputGroup.createEl("p", { cls: "wizard-hint" });
  hint.textContent = "키는 쉘 설정 파일(.zshrc 또는 .bashrc)에 저장됩니다.";
}

export function resetClaudeLoginStatus(): void {
  apiKeyInfo = null;
  isChecking = false;
}

export const claudeLoginStep: WizardStep = {
  id: "claude-login",
  title: "API 키 설정",
  render: renderClaudeLoginStep,
};
