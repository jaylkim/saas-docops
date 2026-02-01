import { App, PluginSettingTab, Setting, Notice, setIcon } from "obsidian";
import type IntegrationAIPlugin from "../main";
import { SetupWizardModal } from "../wizard";
import { EnvironmentChecker, MCPServerConfig, MCPConfigLevel } from "../wizard/environment-checker";
import { getAllPresets, MCPPreset } from "../mcp/presets";
import { MCPServerAddModal, MCPServerEditModal } from "./mcp-modals";
import {
  MCPHealthResult,
  MCPHealthStatus,
  getHealthStatusIconName,
  getHealthStatusText,
  getCachedHealth,
  clearHealthCache,
} from "../mcp/health-checker";
import {
  checkForUpdates,
  getInstallCommand,
  getReleasesPageUrl,
  formatReleaseDate,
  type UpdateCheckResult,
} from "../updater";

/**
 * Settings Tab for SaaS DocOps
 */
export class IntegrationSettingsTab extends PluginSettingTab {
  plugin: IntegrationAIPlugin;
  private envChecker: EnvironmentChecker;
  private healthResults: Record<string, MCPHealthResult> = {};
  private isCheckingHealth: boolean = false;
  private updateCheckResult: UpdateCheckResult | null = null;
  private isCheckingUpdate: boolean = false;

  constructor(app: App, plugin: IntegrationAIPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.envChecker = new EnvironmentChecker();
    this.updateEnvCheckerConfig();
  }

  /**
   * Update EnvironmentChecker with current config level
   */
  private updateEnvCheckerConfig(): void {
    const vaultPath = (this.app.vault.adapter as { basePath?: string }).basePath;
    this.envChecker.setConfigLevel(
      this.plugin.settings.mcpConfigLevel,
      vaultPath || undefined
    );
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Header
    containerEl.createEl("h2", { text: "SaaS DocOps 설정" });

    // Update Notification Section (at the top)
    this.renderUpdateSection(containerEl);

    // Wizard Section
    this.renderWizardSection(containerEl);

    // API Keys Section
    this.renderApiKeysSection(containerEl);

    // Terminal Settings Section
    this.renderTerminalSection(containerEl);

    // MCP Settings Section
    this.renderMcpSection(containerEl);
  }

  private renderUpdateSection(containerEl: HTMLElement): void {
    const section = containerEl.createDiv({ cls: "integration-settings-section" });
    const header = section.createEl("h3", { cls: "settings-section-header" });
    const headerIcon = header.createSpan({ cls: "settings-section-icon" });
    setIcon(headerIcon, "download");
    header.createSpan({ text: " 버전 및 업데이트" });

    // Current version display
    const currentVersion = this.plugin.manifest.version;
    const versionInfo = section.createDiv({ cls: "update-version-info" });
    const versionRow = versionInfo.createDiv({ cls: "update-version-row" });
    versionRow.createSpan({ text: "현재 버전: " });
    versionRow.createEl("code", { text: `v${currentVersion}`, cls: "update-version-badge" });

    // Update status container (will be populated by check)
    const updateStatusContainer = section.createDiv({ cls: "update-status-container" });

    // Check button
    new Setting(section)
      .setName("업데이트 확인")
      .setDesc("GitHub에서 최신 버전을 확인합니다")
      .addButton((btn) =>
        btn
          .setButtonText(this.isCheckingUpdate ? "확인 중..." : "확인")
          .setDisabled(this.isCheckingUpdate)
          .onClick(async () => {
            this.isCheckingUpdate = true;
            btn.setButtonText("확인 중...");
            btn.setDisabled(true);

            try {
              this.updateCheckResult = await checkForUpdates(currentVersion, true);
              this.renderUpdateStatus(updateStatusContainer);
            } catch (e) {
              console.error("[Settings] Update check failed:", e);
              new Notice("업데이트 확인 실패");
            } finally {
              this.isCheckingUpdate = false;
              btn.setButtonText("확인");
              btn.setDisabled(false);
            }
          })
      );

    // Show cached result if available
    if (this.updateCheckResult) {
      this.renderUpdateStatus(updateStatusContainer);
    }

    // Auto-check on first display
    if (!this.updateCheckResult && !this.isCheckingUpdate) {
      this.checkForUpdatesBackground(currentVersion, updateStatusContainer);
    }
  }

  private async checkForUpdatesBackground(
    currentVersion: string,
    container: HTMLElement
  ): Promise<void> {
    try {
      this.updateCheckResult = await checkForUpdates(currentVersion);
      this.renderUpdateStatus(container);
    } catch (e) {
      console.error("[Settings] Background update check failed:", e);
    }
  }

  private renderUpdateStatus(container: HTMLElement): void {
    container.empty();

    if (!this.updateCheckResult) return;

    const { hasUpdate, latestVersion, releaseInfo, error } = this.updateCheckResult;

    if (error) {
      // Error state
      const errorDiv = container.createDiv({ cls: "update-error-box" });
      const errorIcon = errorDiv.createSpan({ cls: "update-error-icon" });
      setIcon(errorIcon, "alert-triangle");
      errorDiv.createSpan({ text: ` 확인 실패: ${error}`, cls: "update-error-text" });
      return;
    }

    if (hasUpdate && latestVersion && releaseInfo) {
      // Update available
      const updateBox = container.createDiv({ cls: "update-available-box" });

      const updateHeader = updateBox.createDiv({ cls: "update-available-header" });
      const updateIcon = updateHeader.createSpan({ cls: "update-available-icon" });
      setIcon(updateIcon, "arrow-up-circle");
      updateHeader.createSpan({ text: ` 새 버전 사용 가능: v${latestVersion}` });

      if (releaseInfo.publishedAt) {
        updateBox.createDiv({
          text: `릴리즈 날짜: ${formatReleaseDate(releaseInfo.publishedAt)}`,
          cls: "update-release-date",
        });
      }

      // Install command
      const cmdSection = updateBox.createDiv({ cls: "update-cmd-section" });
      cmdSection.createEl("p", { text: "설치 명령어:", cls: "update-cmd-label" });

      const cmdBox = cmdSection.createDiv({ cls: "update-cmd-box" });
      const cmdCode = cmdBox.createEl("code", { text: getInstallCommand() });

      const copyBtn = cmdBox.createEl("button", {
        cls: "update-cmd-copy-btn",
        attr: { title: "복사" },
      });
      setIcon(copyBtn, "copy");
      copyBtn.addEventListener("click", async () => {
        await navigator.clipboard.writeText(getInstallCommand());
        new Notice("설치 명령어가 복사되었습니다");
        setIcon(copyBtn, "check");
        setTimeout(() => setIcon(copyBtn, "copy"), 2000);
      });

      // Release page link
      const linkSection = updateBox.createDiv({ cls: "update-link-section" });
      const releaseLink = linkSection.createEl("a", {
        text: "GitHub 릴리즈 페이지 열기 →",
        href: releaseInfo.htmlUrl || getReleasesPageUrl(),
      });
      releaseLink.addEventListener("click", (e) => {
        e.preventDefault();
        const { shell } = require("electron");
        shell.openExternal(releaseInfo.htmlUrl || getReleasesPageUrl());
      });
    } else {
      // Up to date
      const upToDateBox = container.createDiv({ cls: "update-uptodate-box" });
      const upToDateIcon = upToDateBox.createSpan({ cls: "update-uptodate-icon" });
      setIcon(upToDateIcon, "check-circle");
      upToDateBox.createSpan({ text: " 최신 버전을 사용 중입니다" });
    }
  }

  private renderWizardSection(containerEl: HTMLElement): void {
    const section = containerEl.createDiv({ cls: "integration-settings-section" });
    const header = section.createEl("h3", { cls: "settings-section-header" });
    const headerIcon = header.createSpan({ cls: "settings-section-icon" });
    setIcon(headerIcon, "rocket");
    header.createSpan({ text: " 설정 마법사" });

    new Setting(section)
      .setName("마법사 다시 실행")
      .setDesc("환경 점검, API 키 설정, MCP 구성을 다시 진행합니다")
      .addButton((btn) =>
        btn.setButtonText("마법사 열기").onClick(() => {
          new SetupWizardModal(this.app, this.plugin).open();
        })
      );
  }

  private renderApiKeysSection(containerEl: HTMLElement): void {
    const section = containerEl.createDiv({ cls: "integration-settings-section" });
    const header = section.createEl("h3", { cls: "settings-section-header" });
    const headerIcon = header.createSpan({ cls: "settings-section-icon" });
    setIcon(headerIcon, "key");
    header.createSpan({ text: " API 키 관리" });

    section.createEl("p", {
      text: "API 키는 쉘 설정 파일(.zshrc, .bashrc)에 저장되어 터미널에서 자동으로 사용됩니다.",
      cls: "setting-item-description",
    });

    // Anthropic API Key - Shell config based
    this.renderAnthropicApiKeySection(section);
  }

  private async renderAnthropicApiKeySection(container: HTMLElement): Promise<void> {
    const keyInfo = await this.envChecker.checkAnthropicApiKey();

    const keySection = container.createDiv({ cls: "api-key-section" });

    // Status display
    const statusDiv = keySection.createDiv({ cls: "api-key-status" });

    if (keyInfo.found) {
      const statusIcon = statusDiv.createSpan({ cls: "api-key-status-icon" });
      setIcon(statusIcon, "check-circle");
      const infoSpan = statusDiv.createSpan({ cls: "api-key-info" });
      infoSpan.createSpan({ text: "ANTHROPIC_API_KEY 설정됨" });
      infoSpan.createEl("code", { text: keyInfo.maskedValue, cls: "api-key-masked" });

      const sourceDiv = keySection.createDiv({ cls: "api-key-source" });
      const sourceIcon = sourceDiv.createSpan({ cls: "api-key-source-icon" });
      setIcon(sourceIcon, "folder");
      sourceDiv.createSpan({ text: ` ${keyInfo.source}`, cls: "api-key-source-path" });
    } else {
      const statusIcon = statusDiv.createSpan({ cls: "api-key-status-icon" });
      setIcon(statusIcon, "alert-triangle");
      statusDiv.createSpan({ text: "ANTHROPIC_API_KEY가 설정되지 않았습니다", cls: "api-key-warning" });
    }

    // Input section
    const inputSection = keySection.createDiv({ cls: "api-key-input-section" });

    let inputValue = "";

    new Setting(inputSection)
      .setName(keyInfo.found ? "API 키 변경" : "API 키 설정")
      .setDesc("sk-ant-로 시작하는 Anthropic API 키를 입력하세요")
      .addText((text) =>
        text
          .setPlaceholder("sk-ant-...")
          .onChange((value) => {
            inputValue = value;
          })
      )
      .addButton((btn) =>
        btn
          .setButtonText("저장")
          .setCta()
          .onClick(async () => {
            if (!inputValue) {
              new Notice("API 키를 입력해주세요");
              return;
            }

            if (!inputValue.startsWith("sk-ant-")) {
              new Notice("올바른 Anthropic API 키 형식이 아닙니다 (sk-ant-...)");
              return;
            }

            const result = await this.envChecker.saveAnthropicApiKey(inputValue);

            if (result.success) {
              new Notice(`API 키가 ${result.path}에 저장되었습니다. 터미널을 재시작하세요.`);
              // Refresh the section
              keySection.empty();
              this.renderAnthropicApiKeySection(container);
            } else {
              new Notice(`저장 실패: ${result.error}`);
            }
          })
      );

    // Help text
    const helpDiv = keySection.createDiv({ cls: "api-key-help" });
    const helpIcon = helpDiv.createSpan({ cls: "api-key-help-icon" });
    setIcon(helpIcon, "lightbulb");
    helpDiv.createSpan({
      text: " API 키는 쉘 설정 파일에 저장됩니다. 저장 후 새 터미널에서 claude 명령이 키를 인식합니다.",
    });
  }

  private renderTerminalSection(containerEl: HTMLElement): void {
    const section = containerEl.createDiv({ cls: "integration-settings-section" });
    const header = section.createEl("h3", { cls: "settings-section-header" });
    const headerIcon = header.createSpan({ cls: "settings-section-icon" });
    setIcon(headerIcon, "terminal-square");
    header.createSpan({ text: " 터미널 설정" });

    // Shell
    new Setting(section)
      .setName("Shell")
      .setDesc("사용할 셸 (비워두면 시스템 기본값)")
      .addText((text) =>
        text
          .setPlaceholder("/bin/zsh")
          .setValue(this.plugin.settings.terminalShell)
          .onChange(async (value) => {
            this.plugin.settings.terminalShell = value;
            await this.plugin.saveSettings();
          })
      );

    // Font Size
    new Setting(section)
      .setName("폰트 크기")
      .setDesc("터미널 폰트 크기 (px)")
      .addSlider((slider) =>
        slider
          .setLimits(10, 24, 1)
          .setValue(this.plugin.settings.terminalFontSize)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.terminalFontSize = value;
            await this.plugin.saveSettings();
          })
      );

    // Font Family
    new Setting(section)
      .setName("폰트 패밀리")
      .setDesc("터미널 폰트")
      .addText((text) =>
        text
          .setPlaceholder("monospace")
          .setValue(this.plugin.settings.terminalFontFamily)
          .onChange(async (value) => {
            this.plugin.settings.terminalFontFamily = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private renderMcpSection(containerEl: HTMLElement): void {
    const section = containerEl.createDiv({ cls: "integration-settings-section" });
    const header = section.createEl("h3", { cls: "settings-section-header" });
    const headerIcon = header.createSpan({ cls: "settings-section-icon" });
    setIcon(headerIcon, "plug");
    header.createSpan({ text: " MCP 서버 관리" });

    // Config level selector
    const vaultPath = (this.app.vault.adapter as { basePath?: string }).basePath || "";
    new Setting(section)
      .setName("설정 저장 위치")
      .setDesc("MCP 서버 설정을 저장할 위치를 선택합니다")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("user", `사용자 (~/.claude.json)`)
          .addOption("project", `프로젝트 (.mcp.json)`)
          .setValue(this.plugin.settings.mcpConfigLevel)
          .onChange(async (value) => {
            this.plugin.settings.mcpConfigLevel = value as MCPConfigLevel;
            await this.plugin.saveSettings();
            this.updateEnvCheckerConfig();
            new Notice(`MCP 설정 위치가 변경되었습니다: ${value === "user" ? "사용자" : "프로젝트"}`);
            // Refresh the section to show servers from new location
            this.display();
          })
      );

    // Config level explanation
    const configLevelNote = section.createDiv({ cls: "mcp-config-note" });
    const noteIcon = configLevelNote.createSpan({ cls: "mcp-config-note-icon" });
    setIcon(noteIcon, "folder");
    if (this.plugin.settings.mcpConfigLevel === "user") {
      const noteText = configLevelNote.createDiv({ cls: "mcp-config-note-text" });
      noteText.createEl("p").innerHTML = `<strong>사용자 레벨</strong>: ~/.claude.json에 저장됩니다.`;
      noteText.createEl("p", { text: "모든 프로젝트에서 공통으로 사용됩니다." });
    } else {
      const noteText = configLevelNote.createDiv({ cls: "mcp-config-note-text" });
      noteText.createEl("p").innerHTML = `<strong>프로젝트 레벨</strong>: ${vaultPath}/.mcp.json에 저장됩니다.`;
      noteText.createEl("p", { text: "이 vault에서만 사용됩니다. Git으로 팀과 공유 가능합니다." });
    }

    // Server list container
    const serverListContainer = section.createDiv({ cls: "mcp-server-list" });
    this.loadMcpServers(serverListContainer);

    // Presets section
    section.createEl("h4", { text: "서버 추가", cls: "mcp-section-title" });

    const presetGrid = section.createDiv({ cls: "mcp-preset-grid" });
    const presets = getAllPresets();

    for (const preset of presets) {
      this.renderPresetCard(presetGrid, preset);
    }

    // Open settings file button
    const settingsPath = this.envChecker.getClaudeSettingsPath();
    new Setting(section)
      .setName("설정 파일 열기")
      .setDesc(settingsPath)
      .addButton((btn) =>
        btn.setButtonText("열기").onClick(async () => {
          const { shell } = require("electron");
          shell.openPath(settingsPath);
        })
      );

    // Restart notice
    const notice = section.createEl("p", { cls: "mcp-notice" });
    const noticeIcon = notice.createSpan({ cls: "mcp-notice-icon" });
    setIcon(noticeIcon, "alert-triangle");
    notice.createSpan({ text: " MCP 서버 변경 후 Claude Code를 재시작해야 적용됩니다." });
  }

  private async loadMcpServers(container: HTMLElement): Promise<void> {
    container.empty();

    const servers = await this.envChecker.getAllMCPServers();
    const serverNames = Object.keys(servers);

    if (serverNames.length === 0) {
      container.createEl("p", {
        text: "설정된 MCP 서버가 없습니다.",
        cls: "mcp-empty-message",
      });
      return;
    }

    // Header with title and refresh button
    const headerDiv = container.createDiv({ cls: "mcp-server-list-header" });
    headerDiv.createEl("h4", { text: "설정된 서버", cls: "mcp-section-title" });

    const refreshBtn = headerDiv.createEl("button", {
      cls: "mcp-btn mcp-btn-sm mcp-btn-secondary",
    });
    const refreshIcon = refreshBtn.createSpan({ cls: "mcp-btn-icon" });
    setIcon(refreshIcon, "refresh-cw");
    refreshBtn.createSpan({ text: " 전체 상태 점검" });
    refreshBtn.addEventListener("click", async () => {
      if (this.isCheckingHealth) return;
      await this.refreshAllServerHealth(container);
    });

    // Render server items
    for (const name of serverNames) {
      const config = servers[name];
      const cachedHealth = this.healthResults[name] || getCachedHealth(name);
      this.renderServerItem(container, name, config, cachedHealth);
    }
  }

  /**
   * Refresh health status for all servers
   */
  private async refreshAllServerHealth(container: HTMLElement): Promise<void> {
    if (this.isCheckingHealth) return;

    this.isCheckingHealth = true;
    clearHealthCache();

    // Update UI to show checking state
    const servers = await this.envChecker.getAllMCPServers();
    const serverNames = Object.keys(servers);

    // Set all to checking state
    for (const name of serverNames) {
      this.healthResults[name] = {
        status: "checking",
        message: "점검 중...",
        lastChecked: Date.now(),
      };
    }

    // Reload to show checking state
    await this.loadMcpServers(container);

    // Perform health checks
    try {
      this.healthResults = await this.envChecker.checkAllMCPServersHealth();
    } catch (e) {
      console.error("[Settings] Health check failed:", e);
    }

    this.isCheckingHealth = false;

    // Reload with results
    await this.loadMcpServers(container);

    new Notice("MCP 서버 상태 점검 완료");
  }

  /**
   * Test health of a single server
   */
  private async testSingleServerHealth(
    name: string,
    container: HTMLElement
  ): Promise<void> {
    // Set to checking state
    this.healthResults[name] = {
      status: "checking",
      message: "점검 중...",
      lastChecked: Date.now(),
    };

    // Reload to show checking state
    await this.loadMcpServers(container);

    // Perform health check
    try {
      const result = await this.envChecker.checkMCPServerHealth(name);
      this.healthResults[name] = result;
    } catch (e) {
      console.error(`[Settings] Health check failed for ${name}:`, e);
      this.healthResults[name] = {
        status: "unhealthy",
        message: "점검 실패",
        lastChecked: Date.now(),
      };
    }

    // Reload with result
    await this.loadMcpServers(container);
  }

  private renderServerItem(
    container: HTMLElement,
    name: string,
    config: MCPServerConfig,
    healthResult?: MCPHealthResult
  ): void {
    const item = container.createDiv({ cls: "mcp-server-item" });

    // Server info
    const infoDiv = item.createDiv({ cls: "mcp-server-info" });

    const headerDiv = infoDiv.createDiv({ cls: "mcp-server-header" });
    const iconName = this.getServerIconName(name);
    const serverIcon = headerDiv.createSpan({ cls: "mcp-server-icon" });
    setIcon(serverIcon, iconName);
    headerDiv.createSpan({ text: name, cls: "mcp-server-name" });

    // Transport type badge
    const transportType = config.type || "stdio";
    headerDiv.createSpan({
      text: transportType.toUpperCase(),
      cls: `mcp-transport-badge mcp-transport-${transportType}`,
    });

    // Health status badge (replaces simple enabled/disabled badge)
    const isEnabled = config.enabled !== false;
    let healthStatus: MCPHealthStatus = isEnabled ? "healthy" : "disabled";
    let healthMessage = isEnabled ? "활성" : "비활성";

    if (healthResult) {
      healthStatus = healthResult.status;
      healthMessage = healthResult.message;
    }

    const healthIconName = getHealthStatusIconName(healthStatus);
    const healthText = getHealthStatusText(healthStatus);

    const healthBadge = headerDiv.createSpan({
      cls: `mcp-health-badge mcp-health-${healthStatus}`,
    });
    const healthIconEl = healthBadge.createSpan({ cls: "mcp-health-icon" });
    setIcon(healthIconEl, healthIconName);
    healthBadge.createSpan({ text: ` ${healthText}` });

    // Show response time if available
    if (healthResult?.responseTime && healthStatus === "healthy") {
      healthBadge.setAttribute("title", `응답 시간: ${healthResult.responseTime}ms`);
    } else if (healthResult?.message && healthStatus !== "healthy") {
      healthBadge.setAttribute("title", healthResult.message);
    }

    // Server info based on transport type
    if (transportType === "sse" || transportType === "http") {
      // Remote server: show URL
      infoDiv.createEl("code", { text: config.url || "", cls: "mcp-server-url" });

      // OAuth note for Atlassian
      if (name === "atlassian") {
        const oauthNote = infoDiv.createDiv({ cls: "mcp-oauth-note" });
        const oauthIcon = oauthNote.createSpan({ cls: "mcp-oauth-icon" });
        setIcon(oauthIcon, "lock");
        oauthNote.createSpan({ text: " OAuth 인증 • 터미널에서 /mcp로 인증", cls: "mcp-oauth-hint" });
      }
    } else {
      // stdio server: show command
      const cmdPreview = [config.command, ...(config.args || [])].join(" ");
      infoDiv.createEl("code", { text: cmdPreview, cls: "mcp-server-cmd" });
    }

    // Health status message row (if there's an error)
    if (healthResult && healthStatus === "unhealthy" && healthResult.message) {
      const errorDiv = infoDiv.createDiv({ cls: "mcp-health-error" });
      const errorIcon = errorDiv.createSpan({ cls: "mcp-health-error-icon" });
      setIcon(errorIcon, "alert-triangle");
      errorDiv.createSpan({ text: ` ${healthResult.message}`, cls: "mcp-health-error-text" });
    }

    // Actions
    const actionsDiv = item.createDiv({ cls: "mcp-server-actions" });

    // Test button
    const testBtn = actionsDiv.createEl("button", {
      cls: `mcp-btn-icon ${healthStatus === "checking" ? "mcp-btn-checking" : ""}`,
      attr: { title: "상태 점검" },
    });
    setIcon(testBtn, "search");
    testBtn.addEventListener("click", async () => {
      if (this.isCheckingHealth) return;
      await this.testSingleServerHealth(name, container);
    });

    // Toggle button
    const toggleBtn = actionsDiv.createEl("button", {
      text: isEnabled ? "비활성화" : "활성화",
      cls: "mcp-btn mcp-btn-sm",
    });
    toggleBtn.addEventListener("click", async () => {
      const success = await this.envChecker.toggleMCPServer(name, !isEnabled);
      if (success) {
        new Notice(`${name} 서버가 ${!isEnabled ? "활성화" : "비활성화"}되었습니다`);
        // Update health result for disabled state
        if (!isEnabled) {
          delete this.healthResults[name];
        } else {
          this.healthResults[name] = {
            status: "disabled",
            message: "비활성화됨",
            lastChecked: Date.now(),
          };
        }
        this.loadMcpServers(container);
      }
    });

    // Edit button
    const editBtn = actionsDiv.createEl("button", {
      cls: "mcp-btn-icon",
      attr: { title: "편집" },
    });
    setIcon(editBtn, "edit");
    editBtn.addEventListener("click", () => {
      new MCPServerEditModal(this.app, name, config, () => {
        this.loadMcpServers(container);
      }, this.envChecker).open();
    });

    // Delete button
    const deleteBtn = actionsDiv.createEl("button", {
      cls: "mcp-btn-icon mcp-btn-danger",
      attr: { title: "삭제" },
    });
    setIcon(deleteBtn, "trash-2");
    deleteBtn.addEventListener("click", async () => {
      if (confirm(`${name} 서버를 삭제하시겠습니까?`)) {
        const success = await this.envChecker.removeMCPServer(name);
        if (success) {
          new Notice(`${name} 서버가 삭제되었습니다`);
          delete this.healthResults[name];
          this.loadMcpServers(container);
        }
      }
    });
  }

  private renderPresetCard(container: HTMLElement, preset: MCPPreset): void {
    const card = container.createDiv({ cls: "mcp-preset-card" });

    // Add transport indicator for remote servers
    if (preset.transport === "sse" || preset.transport === "http") {
      card.addClass("mcp-preset-remote");
    }

    const presetIcon = card.createSpan({ cls: "mcp-preset-icon" });
    setIcon(presetIcon, preset.iconName);

    const nameContainer = card.createDiv({ cls: "mcp-preset-name-container" });
    nameContainer.createSpan({ text: preset.name, cls: "mcp-preset-name" });

    // Show OAuth badge for OAuth-based presets
    if (preset.requiresOAuth) {
      nameContainer.createSpan({ text: "OAuth", cls: "mcp-preset-oauth-badge" });
    }

    card.addEventListener("click", async () => {
      // Check if already exists
      const exists = await this.envChecker.hasMCPServer(preset.id);
      if (exists) {
        new Notice(`${preset.name} 서버가 이미 설정되어 있습니다`);
        return;
      }

      new MCPServerAddModal(this.app, preset, () => {
        const serverListContainer = container.parentElement?.querySelector(".mcp-server-list");
        if (serverListContainer) {
          this.loadMcpServers(serverListContainer as HTMLElement);
        }
      }, this.envChecker).open();
    });
  }

  private getServerIconName(name: string): string {
    const iconMap: Record<string, string> = {
      "slack-bot": "bot",
      "slack-personal": "user",
      slack: "message-square",
      atlassian: "file-text",
      github: "github",
      filesystem: "folder",
      memory: "brain",
      postgres: "database",
      sqlite: "database",
    };
    return iconMap[name] || "plug";
  }
}
