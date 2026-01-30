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

    // MCP Settings Section
    this.renderMcpSection(containerEl);
  }

  private renderApiKeysSection(containerEl: HTMLElement): void {
    const section = containerEl.createDiv({ cls: "integration-settings-section" });
    section.createEl("h3", { text: "🔑 API 키 관리" });

    section.createEl("p", {
      text: "터미널에서 환경변수로 자동 주입됩니다. Claude Max 구독자는 OAuth 로그인 사용 가능.",
      cls: "setting-item-description",
    });

    // Anthropic API Key
    new Setting(section)
      .setName("Anthropic API Key (선택)")
      .setDesc("터미널에서 ANTHROPIC_API_KEY로 주입")
      .addText((text) =>
        text
          .setPlaceholder("sk-ant-... (비워두면 OAuth 사용)")
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async (value) => {
            this.plugin.settings.anthropicApiKey = value;
            await this.plugin.saveSettings();
          })
      );

    // Slack Bot Token
    new Setting(section)
      .setName("Slack Bot Token (선택)")
      .setDesc("MCP Slack 서버용 토큰")
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
      .setName("Atlassian API Token (선택)")
      .setDesc("MCP Confluence/Jira 서버용 토큰")
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
