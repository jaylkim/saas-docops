/**
 * Slack MCP Setup Step - Step 5
 *
 * Slack Token 발급 안내 및 MCP 설정
 * Bot Token (xoxb-) 또는 User Token (xoxp-) 지원
 */

import type { WizardStep, WizardState, WizardCallbacks } from "../setup-wizard-modal";
import { EnvironmentChecker } from "../environment-checker";

let isConfigured: boolean | null = null;
let isChecking = false;

export function renderSlackSetupStep(
  container: HTMLElement,
  state: WizardState,
  updateState: (updates: Partial<WizardState>) => void,
  callbacks?: WizardCallbacks
): void {
  container.empty();

  container.createEl("h2", { text: "💬 Slack 연동 설정", cls: "wizard-step-title" });
  container.createEl("p", {
    text: "Slack과 연동하면 Claude가 Slack 채널의 메시지를 읽고 보낼 수 있습니다.",
    cls: "wizard-step-desc",
  });

  // Check current status with correct config level
  const checker = new EnvironmentChecker();
  const configLevel = callbacks?.plugin?.settings.mcpConfigLevel || state.mcpConfigLevel || "user";
  checker.setConfigLevel(configLevel, callbacks?.vaultPath);

  if (isConfigured === null && !isChecking) {
    isChecking = true;
    // Check both slack-bot and slack-personal
    Promise.all([
      checker.hasMCPServer("slack-bot"),
      checker.hasMCPServer("slack-personal"),
    ]).then(([hasBot, hasPersonal]) => {
      isConfigured = hasBot || hasPersonal;
      isChecking = false;
      renderSlackSetupStep(container, state, updateState, callbacks);
    });

    container.createEl("p", { text: "⏳ 설정 상태를 확인하고 있습니다..." });
    return;
  }

  if (isChecking) {
    container.createEl("p", { text: "⏳ 설정 상태를 확인하고 있습니다..." });
    return;
  }

  // Already configured - show status, server list, and allow adding more
  if (isConfigured && !state.slackBotToken) {
    const successBox = container.createDiv({ cls: "wizard-status-box status-success" });
    successBox.createEl("div", { text: "✅", cls: "status-icon" });
    const content = successBox.createDiv({ cls: "status-content" });
    content.createEl("h3", { text: "Slack MCP가 설정되어 있습니다" });
    content.createEl("p", { text: "다음 단계로 진행하거나, 서버를 관리할 수 있습니다." });

    // Show configured servers list
    const serverListContainer = container.createDiv({ cls: "wizard-server-list" });
    renderConfiguredSlackServers(serverListContainer, checker, container, state, updateState, callbacks);

    const addMoreBtn = container.createEl("button", {
      text: "➕ 다른 토큰 추가",
      cls: "wizard-btn wizard-btn-secondary",
    });
    addMoreBtn.addEventListener("click", () => {
      isConfigured = false;
      renderSlackSetupStep(container, state, updateState, callbacks);
    });
    return;
  }

  // Token type selection
  const tokenTypeSection = container.createDiv({ cls: "wizard-token-type-section" });
  tokenTypeSection.createEl("h4", { text: "토큰 유형 선택" });

  let selectedType: "bot" | "user" = "bot";

  const typeOptions = tokenTypeSection.createDiv({ cls: "wizard-token-type-options" });

  const botOption = typeOptions.createDiv({ cls: "wizard-token-option selected" });
  botOption.innerHTML = `
    <strong>Bot Token (xoxb-)</strong>
    <span>Slack 앱을 봇으로 설치. 워크스페이스 관리자 권한 필요.</span>
  `;

  const userOption = typeOptions.createDiv({ cls: "wizard-token-option" });
  userOption.innerHTML = `
    <strong>User Token (xoxp-)</strong>
    <span>개인 토큰. 본인 권한으로 동작. 관리자 승인 불필요.</span>
  `;

  botOption.addEventListener("click", () => {
    selectedType = "bot";
    botOption.addClass("selected");
    userOption.removeClass("selected");
    updateGuide("bot");
  });

  userOption.addEventListener("click", () => {
    selectedType = "user";
    userOption.addClass("selected");
    botOption.removeClass("selected");
    updateGuide("user");
  });

  // Setup guide container
  const guideContainer = container.createDiv({ cls: "wizard-setup-guide" });

  function updateGuide(type: "bot" | "user") {
    guideContainer.empty();

    if (type === "bot") {
      renderBotTokenGuide(guideContainer);
    } else {
      renderUserTokenGuide(guideContainer);
    }

    // Token input (common)
    renderTokenInput(guideContainer, type, state, updateState, checker, callbacks);
  }

  // Initial render
  updateGuide("bot");

  // Skip note
  container.createEl("p", {
    text: "💡 Slack 연동은 선택사항입니다. 나중에 설정 탭에서 다시 설정할 수 있습니다.",
    cls: "wizard-note",
  });
}

function renderBotTokenGuide(container: HTMLElement): void {
  // Step 1: Create Slack App
  const step1 = container.createDiv({ cls: "wizard-guide-step" });
  step1.createDiv({ cls: "guide-step-header" }).innerHTML = `
    <span class="guide-step-number">1</span>
    <span class="guide-step-title">Slack App 생성</span>
  `;
  const step1Content = step1.createDiv({ cls: "guide-step-content" });
  step1Content.createEl("p", { text: "Slack API 페이지에서 새 앱을 만듭니다." });

  const step1Actions = step1Content.createDiv({ cls: "guide-actions" });
  const openSlackBtn = step1Actions.createEl("button", {
    text: "Slack API 페이지 열기 ↗",
    cls: "wizard-btn wizard-btn-secondary",
  });
  openSlackBtn.addEventListener("click", () => {
    window.open("https://api.slack.com/apps", "_blank");
  });

  const step1Details = step1Content.createDiv({ cls: "guide-details" });
  step1Details.innerHTML = `
    <ol>
      <li>"Create New App" 클릭</li>
      <li>"From scratch" 선택</li>
      <li>앱 이름 입력 (예: "Claude Assistant")</li>
      <li>워크스페이스 선택 후 "Create App"</li>
    </ol>
  `;

  // Step 2: Configure permissions
  const step2 = container.createDiv({ cls: "wizard-guide-step" });
  step2.createDiv({ cls: "guide-step-header" }).innerHTML = `
    <span class="guide-step-number">2</span>
    <span class="guide-step-title">Bot Token Scopes 설정</span>
  `;
  const step2Content = step2.createDiv({ cls: "guide-step-content" });
  step2Content.createEl("p", { text: "OAuth & Permissions → Bot Token Scopes에서 권한 추가:" });

  // 공식 MCP Slack 서버 필수 스코프
  renderScopesList(step2Content, [
    "channels:history",
    "channels:read",
    "chat:write",
    "reactions:write",
    "users:read",
    "users.profile:read",
  ]);

  // Step 3: Install and get token
  const step3 = container.createDiv({ cls: "wizard-guide-step" });
  step3.createDiv({ cls: "guide-step-header" }).innerHTML = `
    <span class="guide-step-number">3</span>
    <span class="guide-step-title">앱 설치 및 토큰 복사</span>
  `;
  const step3Content = step3.createDiv({ cls: "guide-step-content" });
  step3Content.innerHTML = `
    <ol>
      <li>페이지 상단의 "Install to Workspace" 클릭</li>
      <li>"허용" 클릭하여 앱 설치</li>
      <li><strong>"Bot User OAuth Token"</strong> 복사 (xoxb-로 시작)</li>
    </ol>
  `;
}

function renderUserTokenGuide(container: HTMLElement): void {
  // Step 1: Create or use existing Slack App
  const step1 = container.createDiv({ cls: "wizard-guide-step" });
  step1.createDiv({ cls: "guide-step-header" }).innerHTML = `
    <span class="guide-step-number">1</span>
    <span class="guide-step-title">Slack App 생성 또는 선택</span>
  `;
  const step1Content = step1.createDiv({ cls: "guide-step-content" });

  const step1Actions = step1Content.createDiv({ cls: "guide-actions" });
  const openSlackBtn = step1Actions.createEl("button", {
    text: "Slack API 페이지 열기 ↗",
    cls: "wizard-btn wizard-btn-secondary",
  });
  openSlackBtn.addEventListener("click", () => {
    window.open("https://api.slack.com/apps", "_blank");
  });

  step1Content.createEl("p", { text: "기존 앱을 사용하거나 새 앱을 만드세요." });

  // Step 2: Configure User Token Scopes
  const step2 = container.createDiv({ cls: "wizard-guide-step" });
  step2.createDiv({ cls: "guide-step-header" }).innerHTML = `
    <span class="guide-step-number">2</span>
    <span class="guide-step-title">User Token Scopes 설정</span>
  `;
  const step2Content = step2.createDiv({ cls: "guide-step-content" });
  step2Content.createEl("p", { text: "OAuth & Permissions → User Token Scopes에서 권한 추가:" });

  // 공식 MCP Slack 서버 필수 스코프
  renderScopesList(step2Content, [
    "channels:history",
    "channels:read",
    "chat:write",
    "reactions:write",
    "users:read",
    "users.profile:read",
  ]);

  // Step 3: Install and get token
  const step3 = container.createDiv({ cls: "wizard-guide-step" });
  step3.createDiv({ cls: "guide-step-header" }).innerHTML = `
    <span class="guide-step-number">3</span>
    <span class="guide-step-title">앱 설치 및 토큰 복사</span>
  `;
  const step3Content = step3.createDiv({ cls: "guide-step-content" });
  step3Content.innerHTML = `
    <ol>
      <li>"Install to Workspace" 클릭 (또는 "Reinstall")</li>
      <li>"허용" 클릭</li>
      <li><strong>"User OAuth Token"</strong> 복사 (xoxp-로 시작)</li>
    </ol>
  `;
}

function renderScopesList(container: HTMLElement, scopes: string[]): void {
  const scopesDiv = container.createDiv({ cls: "wizard-scopes-list" });
  for (const scope of scopes) {
    const scopeEl = scopesDiv.createDiv({ cls: "scope-item" });
    scopeEl.createEl("code", { text: scope });
  }
}

function renderTokenInput(
  container: HTMLElement,
  tokenType: "bot" | "user",
  state: WizardState,
  updateState: (updates: Partial<WizardState>) => void,
  checker: EnvironmentChecker,
  callbacks?: WizardCallbacks
): void {
  const step4 = container.createDiv({ cls: "wizard-guide-step" });
  step4.createDiv({ cls: "guide-step-header" }).innerHTML = `
    <span class="guide-step-number">4</span>
    <span class="guide-step-title">토큰 입력</span>
  `;
  const step4Content = step4.createDiv({ cls: "guide-step-content" });

  const expectedPrefix = tokenType === "bot" ? "xoxb-" : "xoxp-";
  const tokenLabel = tokenType === "bot" ? "Bot Token" : "User Token";
  const mcpServerName = tokenType === "bot" ? "slack-bot" : "slack-personal";

  const inputGroup = step4Content.createDiv({ cls: "wizard-input-group" });
  inputGroup.createEl("label", { text: `Slack ${tokenLabel}` });
  const tokenInput = inputGroup.createEl("input", {
    type: "password",
    placeholder: `${expectedPrefix}...`,
    cls: "wizard-input",
  }) as HTMLInputElement;
  tokenInput.value = state.slackBotToken || "";
  tokenInput.addEventListener("input", () => {
    updateState({ slackBotToken: tokenInput.value });
  });

  // Show/hide toggle
  const toggleBtn = inputGroup.createEl("button", {
    text: "👁️ 보기",
    cls: "wizard-btn wizard-btn-text wizard-btn-sm",
  });
  toggleBtn.addEventListener("click", () => {
    if (tokenInput.type === "password") {
      tokenInput.type = "text";
      toggleBtn.setText("🙈 숨기기");
    } else {
      tokenInput.type = "password";
      toggleBtn.setText("👁️ 보기");
    }
  });

  // Info about MCP server name
  step4Content.createEl("p", {
    text: `💡 MCP 서버 이름: ${mcpServerName}`,
    cls: "wizard-hint",
  });

  // Save button
  const saveContainer = step4Content.createDiv({ cls: "wizard-save-container" });
  const saveBtn = saveContainer.createEl("button", {
    text: `💾 ${mcpServerName} 저장`,
    cls: "wizard-btn wizard-btn-primary",
  });

  const saveStatus = saveContainer.createSpan({ cls: "save-status" });

  saveBtn.addEventListener("click", async () => {
    const token = tokenInput.value.trim();
    if (!token) {
      saveStatus.setText("❌ 토큰을 입력해주세요");
      saveStatus.addClass("error");
      return;
    }

    // Validate token format
    if (!token.startsWith(expectedPrefix)) {
      saveStatus.setText(`❌ ${tokenLabel}은 ${expectedPrefix}로 시작해야 합니다`);
      saveStatus.addClass("error");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.setText("저장 중...");

    // 각 토큰 유형별로 별도의 MCP 서버로 저장
    const envVarName = tokenType === "bot" ? "SLACK_MCP_XOXB_TOKEN" : "SLACK_MCP_XOXP_TOKEN";
    const success = await checker.addMCPServer(mcpServerName, {
      type: "stdio",
      command: "npx",
      args: ["-y", "slack-mcp-server@latest", "--transport", "stdio"],
      env: {
        [envVarName]: token,
        SLACK_MCP_ADD_MESSAGE_TOOL: "true",
      },
    });

    if (success) {
      saveStatus.setText(`✅ ${mcpServerName} 저장됨!`);
      saveStatus.removeClass("error");
      saveStatus.addClass("success");
      isConfigured = true;

      setTimeout(() => {
        renderSlackSetupStep(container.parentElement as HTMLElement, state, updateState, callbacks);
      }, 1500);
    } else {
      saveStatus.setText("❌ 저장 실패");
      saveStatus.addClass("error");
      saveBtn.disabled = false;
      saveBtn.setText(`💾 ${mcpServerName} 저장`);
    }
  });
}

async function renderConfiguredSlackServers(
  container: HTMLElement,
  checker: EnvironmentChecker,
  parentContainer: HTMLElement,
  state: WizardState,
  updateState: (updates: Partial<WizardState>) => void,
  callbacks?: WizardCallbacks
): Promise<void> {
  const servers = await checker.getAllMCPServers();
  const slackServers = Object.entries(servers).filter(
    ([name]) => name === "slack-bot" || name === "slack-personal"
  );

  if (slackServers.length === 0) {
    return;
  }

  container.createEl("h4", { text: "설정된 Slack 서버", cls: "wizard-server-list-title" });

  for (const [name, config] of slackServers) {
    const serverItem = container.createDiv({ cls: "wizard-server-item" });

    const infoDiv = serverItem.createDiv({ cls: "wizard-server-info" });
    const icon = name === "slack-bot" ? "🤖" : "👤";
    const label = name === "slack-bot" ? "Bot Token" : "User Token";
    infoDiv.createSpan({ text: `${icon} ${label}`, cls: "wizard-server-name" });

    // Show masked token (support both old and new env var names)
    const newEnvKey = name === "slack-bot" ? "SLACK_MCP_XOXB_TOKEN" : "SLACK_MCP_XOXP_TOKEN";
    const oldEnvKey = name === "slack-bot" ? "SLACK_BOT_TOKEN" : "SLACK_USER_TOKEN";
    const token = config.env?.[newEnvKey] || config.env?.[oldEnvKey] || "";
    if (token) {
      const maskedToken = token.length > 12
        ? `${token.substring(0, 8)}...${token.substring(token.length - 4)}`
        : "••••••••";
      infoDiv.createEl("code", { text: maskedToken, cls: "wizard-server-token" });
    }

    const deleteBtn = serverItem.createEl("button", {
      text: "🗑️ 삭제",
      cls: "wizard-btn wizard-btn-danger wizard-btn-sm",
    });
    deleteBtn.addEventListener("click", async () => {
      if (confirm(`${label} 서버를 삭제하시겠습니까?`)) {
        await checker.removeMCPServer(name);
        // Check if any slack servers remain
        const [hasBot, hasPersonal] = await Promise.all([
          checker.hasMCPServer("slack-bot"),
          checker.hasMCPServer("slack-personal"),
        ]);
        isConfigured = hasBot || hasPersonal;
        renderSlackSetupStep(parentContainer, state, updateState, callbacks);
      }
    });
  }
}

export function resetSlackSetupStatus(): void {
  isConfigured = null;
  isChecking = false;
}

export const slackSetupStep: WizardStep = {
  id: "slack-setup",
  title: "Slack 연동",
  render: renderSlackSetupStep,
};
