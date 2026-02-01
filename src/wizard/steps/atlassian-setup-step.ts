/**
 * Atlassian MCP Setup Step - Step 6
 *
 * 공식 Atlassian Remote MCP Server (OAuth 2.1)
 * https://www.atlassian.com/platform/remote-mcp-server
 */

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

  container.createEl("h2", { text: "📄 Atlassian 연동 설정", cls: "wizard-step-title" });
  container.createEl("p", {
    text: "공식 Atlassian MCP 서버를 사용하여 Confluence와 Jira를 연동합니다.",
    cls: "wizard-step-desc",
  });

  // Check current status with correct config level
  const checker = new EnvironmentChecker();
  const configLevel = callbacks?.plugin?.settings.mcpConfigLevel || state.mcpConfigLevel || "user";
  checker.setConfigLevel(configLevel, callbacks?.vaultPath);

  // Check current status
  if (isConfigured === null && !isChecking) {
    isChecking = true;
    checker.hasMCPServer("atlassian").then((exists) => {
      isConfigured = exists;
      isChecking = false;
      renderAtlassianSetupStep(container, state, updateState, callbacks);
    });

    container.createEl("p", { text: "⏳ 설정 상태를 확인하고 있습니다..." });
    return;
  }

  if (isChecking) {
    container.createEl("p", { text: "⏳ 설정 상태를 확인하고 있습니다..." });
    return;
  }

  // Already configured
  if (isConfigured) {
    const successBox = container.createDiv({ cls: "wizard-status-box status-success" });
    successBox.createEl("div", { text: "✅", cls: "status-icon" });
    const content = successBox.createDiv({ cls: "status-content" });
    content.createEl("h3", { text: "Atlassian MCP가 설정되어 있습니다" });
    content.createEl("p", { text: "터미널에서 /mcp 명령으로 인증 상태를 확인하세요." });

    // Authentication instructions
    const authNote = container.createDiv({ cls: "wizard-info-box" });
    authNote.innerHTML = `
      <h4>🔑 인증 방법</h4>
      <p>터미널에서 Claude Code를 실행하면 처음 Atlassian 도구 사용 시 자동으로 브라우저 인증 창이 열립니다.</p>
      <code>claude</code>
    `;

    const btnContainer = container.createDiv({ cls: "wizard-btn-group" });

    const resetBtn = btnContainer.createEl("button", {
      text: "🔄 다시 설정",
      cls: "wizard-btn wizard-btn-secondary",
    });
    resetBtn.addEventListener("click", async () => {
      await checker.removeMCPServer("atlassian");
      isConfigured = false;
      renderAtlassianSetupStep(container, state, updateState, callbacks);
    });

    const deleteBtn = btnContainer.createEl("button", {
      text: "🗑️ 삭제",
      cls: "wizard-btn wizard-btn-danger",
    });
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
  infoBox.innerHTML = `
    <h4>🔐 공식 Atlassian MCP (OAuth 2.1)</h4>
    <ul>
      <li>✅ 브라우저에서 Atlassian 로그인</li>
      <li>✅ API 토큰 불필요</li>
      <li>✅ Jira, Confluence 자동 연동</li>
      <li>✅ 보안성 향상 (토큰 자동 갱신)</li>
    </ul>
  `;

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
    text: "📄 Atlassian MCP 서버 추가",
    cls: "wizard-btn wizard-btn-primary",
  });

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
      saveStatus.setText("✅ 추가되었습니다!");
      saveStatus.removeClass("error");
      saveStatus.addClass("success");
      isConfigured = true;

      setTimeout(() => {
        renderAtlassianSetupStep(container, state, updateState, callbacks);
      }, 1500);
    } else {
      saveStatus.setText("❌ 추가 실패");
      saveStatus.addClass("error");
      addBtn.disabled = false;
      addBtn.setText("📄 Atlassian MCP 서버 추가");
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
  noteBox.innerHTML = `
    <p>💡 <strong>Tip:</strong> 터미널에서 <code>/mcp</code> 명령으로 MCP 서버 상태를 확인할 수 있습니다.</p>
  `;
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
