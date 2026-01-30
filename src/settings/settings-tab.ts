import { App, PluginSettingTab, Setting } from "obsidian";
import type IntegrationAIPlugin from "../main";

/**
 * Settings Tab for SaaS DocOps
 */
export class IntegrationSettingsTab extends PluginSettingTab {
  plugin: IntegrationAIPlugin;

  constructor(app: App, plugin: IntegrationAIPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Header
    containerEl.createEl("h2", { text: "SaaS DocOps 설정" });

    // API Keys Section
    this.renderApiKeysSection(containerEl);

    // Terminal Settings Section
    this.renderTerminalSection(containerEl);

    // Agent Settings Section
    this.renderAgentSection(containerEl);

    // MCP Settings Section
    this.renderMcpSection(containerEl);
  }

  private renderApiKeysSection(containerEl: HTMLElement): void {
    const section = containerEl.createDiv({ cls: "integration-settings-section" });
    section.createEl("h3", { text: "🔑 API 키 관리" });

    // Anthropic API Key
    new Setting(section)
      .setName("Anthropic API Key")
      .setDesc("Claude API 사용을 위한 키")
      .addText((text) =>
        text
          .setPlaceholder("sk-ant-...")
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async (value) => {
            this.plugin.settings.anthropicApiKey = value;
            await this.plugin.saveSettings();
          })
      )
      .addButton((btn) =>
        btn.setButtonText("테스트").onClick(() => {
          // TODO: Implement API key test
          console.log("Testing Anthropic API key...");
        })
      );

    // Slack Bot Token
    new Setting(section)
      .setName("Slack Bot Token")
      .setDesc("Slack 연동을 위한 봇 토큰 (선택)")
      .addText((text) =>
        text
          .setPlaceholder("xoxb-...")
          .setValue(this.plugin.settings.slackBotToken)
          .onChange(async (value) => {
            this.plugin.settings.slackBotToken = value;
            await this.plugin.saveSettings();
          })
      );

    // Atlassian API Token
    new Setting(section)
      .setName("Atlassian API Token")
      .setDesc("Confluence/Jira 연동을 위한 토큰 (선택)")
      .addText((text) =>
        text
          .setPlaceholder("ATATT...")
          .setValue(this.plugin.settings.atlassianApiToken)
          .onChange(async (value) => {
            this.plugin.settings.atlassianApiToken = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private renderTerminalSection(containerEl: HTMLElement): void {
    const section = containerEl.createDiv({ cls: "integration-settings-section" });
    section.createEl("h3", { text: "💻 터미널 설정" });

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

  private renderAgentSection(containerEl: HTMLElement): void {
    const section = containerEl.createDiv({ cls: "integration-settings-section" });
    section.createEl("h3", { text: "🤖 에이전트 설정" });

    // Default Model
    new Setting(section)
      .setName("기본 모델")
      .setDesc("Agent Panel에서 사용할 기본 모델")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("claude-sonnet-4-20250514", "Claude Sonnet 4")
          .addOption("claude-opus-4-20250514", "Claude Opus 4")
          .addOption("claude-3-5-haiku-20241022", "Claude 3.5 Haiku")
          .setValue(this.plugin.settings.defaultModel)
          .onChange(async (value) => {
            this.plugin.settings.defaultModel = value;
            await this.plugin.saveSettings();
          })
      );

    // Max Tokens
    new Setting(section)
      .setName("최대 토큰")
      .setDesc("응답 최대 토큰 수")
      .addSlider((slider) =>
        slider
          .setLimits(1024, 8192, 512)
          .setValue(this.plugin.settings.maxTokens)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.maxTokens = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private renderMcpSection(containerEl: HTMLElement): void {
    const section = containerEl.createDiv({ cls: "integration-settings-section" });
    section.createEl("h3", { text: "🔌 MCP 서버" });

    section.createEl("p", {
      text: "MCP 서버는 .claude/settings.json에서 관리됩니다.",
      cls: "setting-item-description",
    });

    new Setting(section)
      .setName("설정 파일 열기")
      .setDesc(".claude/settings.json 편집")
      .addButton((btn) =>
        btn.setButtonText("열기").onClick(async () => {
          // TODO: Open or create .claude/settings.json
          console.log("Opening MCP settings...");
        })
      );
  }
}
