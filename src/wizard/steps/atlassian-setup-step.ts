/**
 * Atlassian MCP Setup Step - Step 6
 *
 * 공식 Atlassian Remote MCP Server (OAuth 2.1)
 * https://www.atlassian.com/platform/remote-mcp-server
 */

import { setIcon } from "obsidian";
import type { WizardStep, WizardState, WizardCallbacks } from "../setup-wizard-modal";
import { EnvironmentChecker } from "../environment-checker";

let isConfigured: boolean | null = null;
let isChecking = false;

export function renderAtlassianSetupStep(
  container: HTMLElement,
  state: WizardState,
  updateState: (updates: Partial<WizardState>) => void,
  callbacks?: WizardCallbacks
): void {
  container.empty();

  const titleEl = container.createEl("h2", { cls: "wizard-step-title" });
  const titleIcon = titleEl.createSpan({ cls: "wizard-title-icon" });
  setIcon(titleIcon, "file-text");
  titleEl.createSpan({ text: " Atlassian 연동 설정" });
  container.createEl("p", {
    text: "공식 Atlassian MCP 서버를 사용하여 Confluence와 Jira를 연동합니다.",
    cls: "wizard-step-desc",
  });

  // Check current status with correct config level
  const checker = new EnvironmentChecker();
  const configLevel = callbacks?.plugin?.settings.mcpConfigLevel || state.mcpConfigLevel || "user";
  checker.setConfigLevel(configLevel, callbacks?.vaultPath);

  // Use state or local cache
  if (state.atlassianConfigured && isConfigured === null) {
    isConfigured = true;
  }

  // Check current status
  if (isConfigured === null && !isChecking) {
    isChecking = true;
    checker.hasMCPServer("atlassian").then((exists) => {
      isConfigured = exists;
      if (isConfigured) {
        updateState({ atlassianConfigured: true });
      }
      isChecking = false;
      renderAtlassianSetupStep(container, state, updateState, callbacks);
    });

    const loadingP = container.createEl("p");
    const loadingIcon = loadingP.createSpan({ cls: "wizard-loading-icon" });
    setIcon(loadingIcon, "loader");
    loadingP.createSpan({ text: " 설정 상태를 확인하고 있습니다..." });
    return;
  }

  if (isChecking) {
    const loadingP = container.createEl("p");
    const loadingIcon = loadingP.createSpan({ cls: "wizard-loading-icon" });
    setIcon(loadingIcon, "loader");
    loadingP.createSpan({ text: " 설정 상태를 확인하고 있습니다..." });
    return;
  }

  // Already configured
  if (isConfigured) {
    if (!state.atlassianConfigured) {
      setTimeout(() => updateState({ atlassianConfigured: true }), 0);
    }
    const successBox = container.createDiv({ cls: "wizard-status-box status-success" });
    const successIcon = successBox.createEl("div", { cls: "status-icon" });
    setIcon(successIcon, "check-circle");
    const content = successBox.createDiv({ cls: "status-content" });
    content.createEl("h3", { text: "Atlassian MCP가 설정되어 있습니다" });
    content.createEl("p", { text: "터미널에서 /mcp 명령으로 인증 상태를 확인하세요." });

    // Authentication instructions
    const authNote = container.createDiv({ cls: "wizard-info-box" });
    const authTitle = authNote.createEl("h4");
    const authIcon = authTitle.createSpan({ cls: "wizard-info-icon" });
    setIcon(authIcon, "key");
    authTitle.createSpan({ text: " 인증 방법" });
    authNote.createEl("p", { text: "터미널에서 Claude Code를 실행하면 처음 Atlassian 도구 사용 시 자동으로 브라우저 인증 창이 열립니다." });
    authNote.createEl("code", { text: "claude" });

    const btnContainer = container.createDiv({ cls: "wizard-btn-group" });

    const resetBtn = btnContainer.createEl("button", {
      cls: "wizard-btn wizard-btn-secondary",
    });
    const resetIcon = resetBtn.createSpan({ cls: "wizard-btn-icon" });
    setIcon(resetIcon, "refresh-cw");
    resetBtn.createSpan({ text: " 다시 설정" });
    resetBtn.addEventListener("click", async () => {
      await checker.removeMCPServer("atlassian");
      isConfigured = false;
      renderAtlassianSetupStep(container, state, updateState, callbacks);
    });

    const deleteBtn = btnContainer.createEl("button", {
      cls: "wizard-btn wizard-btn-danger",
    });
    const deleteIcon = deleteBtn.createSpan({ cls: "wizard-btn-icon" });
    setIcon(deleteIcon, "trash-2");
    deleteBtn.createSpan({ text: " 삭제" });
    deleteBtn.addEventListener("click", async () => {
      if (confirm("Atlassian MCP 서버를 삭제하시겠습니까?")) {
        await checker.removeMCPServer("atlassian");
        isConfigured = false;
        renderAtlassianSetupStep(container, state, updateState, callbacks);
      }
    });
    return;
  }

  // OAuth setup explanation
  const infoBox = container.createDiv({ cls: "wizard-info-box" });
  const infoTitle = infoBox.createEl("h4");
  const infoIcon = infoTitle.createSpan({ cls: "wizard-info-icon" });
  setIcon(infoIcon, "lock");
  infoTitle.createSpan({ text: " 공식 Atlassian MCP (OAuth 2.1)" });

  const infoList = infoBox.createEl("ul");
  const checkItems = [
    "브라우저에서 Atlassian 로그인",
    "API 토큰 불필요",
    "Jira, Confluence 자동 연동",
    "보안성 향상 (토큰 자동 갱신)",
  ];
  for (const text of checkItems) {
    const li = infoList.createEl("li");
    const checkIcon = li.createSpan({ cls: "wizard-check-icon" });
    setIcon(checkIcon, "check");
    li.createSpan({ text: ` ${text}` });
  }

  // Setup guide
  const guide = container.createDiv({ cls: "wizard-setup-guide" });

  // Step 1: Add MCP server
  const step1 = guide.createDiv({ cls: "wizard-guide-step" });
  step1.createDiv({ cls: "guide-step-header" }).innerHTML = `
    <span class="guide-step-number">1</span>
    <span class="guide-step-title">MCP 서버 추가</span>
  `;
  const step1Content = step1.createDiv({ cls: "guide-step-content" });
  step1Content.createEl("p", { text: "아래 버튼을 클릭하여 Atlassian MCP 서버를 추가합니다." });

  const addBtnContainer = step1Content.createDiv({ cls: "guide-actions" });
  const addBtn = addBtnContainer.createEl("button", {
    cls: "wizard-btn wizard-btn-primary",
  });
  const addBtnIcon = addBtn.createSpan({ cls: "wizard-btn-icon" });
  setIcon(addBtnIcon, "file-text");
  addBtn.createSpan({ text: " Atlassian MCP 서버 추가" });

  const saveStatus = addBtnContainer.createSpan({ cls: "save-status" });

  addBtn.addEventListener("click", async () => {
    addBtn.disabled = true;
    addBtn.setText("추가 중...");

    // Add official Atlassian MCP server with HTTP transport
    const success = await checker.addMCPServer("atlassian", {
      type: "http",
      url: "https://mcp.atlassian.com/v1/mcp",
    });

    if (success) {
      saveStatus.empty();
      const successStatusIcon = saveStatus.createSpan({ cls: "save-status-icon" });
      setIcon(successStatusIcon, "check-circle");
      saveStatus.createSpan({ text: " 추가되었습니다!" });
      saveStatus.removeClass("error");
      saveStatus.addClass("success");
      saveStatus.addClass("success");
      isConfigured = true;
      updateState({ atlassianConfigured: true });

      setTimeout(() => {
        renderAtlassianSetupStep(container, state, updateState, callbacks);
      }, 1500);
    } else {
      saveStatus.empty();
      const errorStatusIcon = saveStatus.createSpan({ cls: "save-status-icon" });
      setIcon(errorStatusIcon, "x-circle");
      saveStatus.createSpan({ text: " 추가 실패" });
      saveStatus.addClass("error");
      addBtn.disabled = false;
      addBtn.empty();
      const newIcon = addBtn.createSpan({ cls: "wizard-btn-icon" });
      setIcon(newIcon, "file-text");
      addBtn.createSpan({ text: " Atlassian MCP 서버 추가" });
    }
  });

  // Step 2: Authentication
  const step2 = guide.createDiv({ cls: "wizard-guide-step" });
  step2.createDiv({ cls: "guide-step-header" }).innerHTML = `
    <span class="guide-step-number">2</span>
    <span class="guide-step-title">브라우저 인증</span>
  `;
  const step2Content = step2.createDiv({ cls: "guide-step-content" });
  step2Content.innerHTML = `
    <p>MCP 서버를 추가한 후, 터미널에서 Claude Code를 실행합니다.</p>
    <div class="guide-code-block">
      <code>claude</code>
    </div>
    <p>처음 Atlassian 관련 도구를 사용하면 자동으로 브라우저 인증 창이 열립니다.</p>
    <ol>
      <li>브라우저에서 Atlassian 계정으로 로그인</li>
      <li>권한 요청 승인</li>
      <li>자동으로 터미널로 돌아옴</li>
    </ol>
  `;

  // Note about MCP command
  const noteBox = container.createDiv({ cls: "wizard-note-box" });
  const noteP = noteBox.createEl("p");
  const noteIcon = noteP.createSpan({ cls: "wizard-note-icon" });
  setIcon(noteIcon, "lightbulb");
  noteP.createSpan({ text: " " });
  noteP.createEl("strong", { text: "Tip:" });
  noteP.createSpan({ text: " 터미널에서 " });
  noteP.createEl("code", { text: "/mcp" });
  noteP.createSpan({ text: " 명령으로 MCP 서버 상태를 확인할 수 있습니다." });
}

export function resetAtlassianSetupStatus(): void {
  isConfigured = null;
  isChecking = false;
}

export const atlassianSetupStep: WizardStep = {
  id: "atlassian-setup",
  title: "Atlassian 연동",
  render: renderAtlassianSetupStep,
};
