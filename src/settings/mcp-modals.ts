/**
 * MCP Server Modals
 *
 * MCP 서버 추가/편집/커스텀/원격 모달
 */

import { Modal, App, Notice, Setting } from "obsidian";
import { EnvironmentChecker, MCPServerConfig } from "../wizard/environment-checker";
import { MCPPreset, MCPTransport } from "../mcp/presets";

/**
 * Modal for adding MCP server from preset
 * Handles both stdio and sse/http transports
 */
export class MCPServerAddModal extends Modal {
  private preset: MCPPreset;
  private envChecker: EnvironmentChecker;
  private envValues: Record<string, string> = {};
  private argsValue: string = "";
  private onSuccess: () => void;

  constructor(app: App, preset: MCPPreset, onSuccess: () => void, envChecker?: EnvironmentChecker) {
    super(app);
    this.preset = preset;
    this.envChecker = envChecker || new EnvironmentChecker();
    this.onSuccess = onSuccess;

    // Initialize args from preset
    if (preset.args) {
      this.argsValue = preset.args.join(" ");
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("mcp-modal");

    // Header
    contentEl.createEl("h2", { text: `${this.preset.icon} ${this.preset.name} 서버 추가` });

    contentEl.createEl("p", {
      text: this.preset.description,
      cls: "mcp-modal-desc",
    });

    // SSE/HTTP transport (OAuth-based)
    if (this.preset.transport === "sse" || this.preset.transport === "http") {
      this.renderRemoteServerForm(contentEl);
      return;
    }

    // stdio transport
    this.renderStdioServerForm(contentEl);
  }

  private renderRemoteServerForm(contentEl: HTMLElement): void {
    // OAuth explanation
    if (this.preset.requiresOAuth) {
      const oauthBox = contentEl.createDiv({ cls: "mcp-modal-info" });
      oauthBox.innerHTML = `
        <h4>🔐 OAuth 인증</h4>
        <p>이 서버는 OAuth 인증을 사용합니다.</p>
        <ul>
          <li>환경변수나 API 토큰이 필요하지 않습니다</li>
          <li>서버 추가 후 터미널에서 인증합니다</li>
          <li>브라우저에서 로그인하면 자동으로 연동됩니다</li>
        </ul>
      `;
    }

    // URL preview
    if (this.preset.url) {
      const urlSection = contentEl.createDiv({ cls: "mcp-modal-section" });
      urlSection.createEl("h4", { text: "서버 URL" });
      urlSection.createEl("code", { text: this.preset.url, cls: "mcp-url-preview" });
    }

    // Actions
    const actions = contentEl.createDiv({ cls: "mcp-modal-actions" });

    const cancelBtn = actions.createEl("button", { text: "취소", cls: "mcp-btn mcp-btn-secondary" });
    cancelBtn.addEventListener("click", () => this.close());

    const addBtn = actions.createEl("button", { text: "추가", cls: "mcp-btn mcp-btn-primary" });
    addBtn.addEventListener("click", () => this.handleAddRemote());
  }

  private renderStdioServerForm(contentEl: HTMLElement): void {
    // Required env vars
    const requiredEnvVars = this.preset.requiredEnvVars || [];
    if (requiredEnvVars.length > 0) {
      const section = contentEl.createDiv({ cls: "mcp-modal-section" });
      section.createEl("h4", { text: "필수 환경변수" });

      for (const envVar of requiredEnvVars) {
        new Setting(section)
          .setName(envVar)
          .addText((text) =>
            text.setPlaceholder(`${envVar} 값 입력`).onChange((value) => {
              this.envValues[envVar] = value;
            })
          );
      }
    }

    // Optional env vars
    if (this.preset.optionalEnvVars && this.preset.optionalEnvVars.length > 0) {
      const section = contentEl.createDiv({ cls: "mcp-modal-section" });
      section.createEl("h4", { text: "선택 환경변수" });

      for (const envVar of this.preset.optionalEnvVars) {
        new Setting(section)
          .setName(envVar)
          .addText((text) =>
            text.setPlaceholder(`${envVar} (선택사항)`).onChange((value) => {
              if (value) {
                this.envValues[envVar] = value;
              } else {
                delete this.envValues[envVar];
              }
            })
          );
      }
    }

    // Args (for filesystem preset which needs path)
    if (this.preset.id === "filesystem") {
      const section = contentEl.createDiv({ cls: "mcp-modal-section" });
      section.createEl("h4", { text: "접근 허용 경로" });

      new Setting(section)
        .setName("경로")
        .setDesc("접근을 허용할 디렉토리 경로")
        .addText((text) =>
          text
            .setPlaceholder("/Users/you/projects")
            .setValue("")
            .onChange((value) => {
              if (value) {
                this.argsValue = `${this.preset.args?.slice(0, -1).join(" ")} ${value}`;
              }
            })
        );
    }

    // Actions
    const actions = contentEl.createDiv({ cls: "mcp-modal-actions" });

    const cancelBtn = actions.createEl("button", { text: "취소", cls: "mcp-btn mcp-btn-secondary" });
    cancelBtn.addEventListener("click", () => this.close());

    const addBtn = actions.createEl("button", { text: "추가", cls: "mcp-btn mcp-btn-primary" });
    addBtn.addEventListener("click", () => this.handleAddStdio());
  }

  private async handleAddRemote(): Promise<void> {
    // Build config for remote server
    const config: MCPServerConfig = {
      type: this.preset.transport as "sse" | "http",
      url: this.preset.url,
    };

    // Save
    const success = await this.envChecker.addMCPServer(this.preset.id, config);

    if (success) {
      new Notice(`${this.preset.name} 서버가 추가되었습니다`);
      if (this.preset.requiresOAuth) {
        new Notice("터미널에서 /mcp 명령으로 인증하세요");
      }
      this.onSuccess();
      this.close();
    } else {
      new Notice("서버 추가에 실패했습니다");
    }
  }

  private async handleAddStdio(): Promise<void> {
    // Validate required env vars
    const requiredEnvVars = this.preset.requiredEnvVars || [];
    for (const envVar of requiredEnvVars) {
      if (!this.envValues[envVar]) {
        new Notice(`${envVar}를 입력해주세요`);
        return;
      }
    }

    // Build config
    const config: MCPServerConfig = {
      type: "stdio",
      command: this.preset.command,
    };

    // Parse args
    if (this.argsValue) {
      config.args = this.argsValue.split(" ").filter(Boolean);
    } else if (this.preset.args) {
      config.args = this.preset.args;
    }

    // Add env vars (merge defaultEnvVars with user-provided envValues)
    const mergedEnv = {
      ...(this.preset.defaultEnvVars || {}),
      ...this.envValues,
    };
    if (Object.keys(mergedEnv).length > 0) {
      config.env = mergedEnv;
    }

    // Save
    const success = await this.envChecker.addMCPServer(this.preset.id, config);

    if (success) {
      new Notice(`${this.preset.name} 서버가 추가되었습니다`);
      this.onSuccess();
      this.close();
    } else {
      new Notice("서버 추가에 실패했습니다");
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Modal for editing existing MCP server
 */
export class MCPServerEditModal extends Modal {
  private serverName: string;
  private config: MCPServerConfig;
  private envChecker: EnvironmentChecker;
  private onSuccess: () => void;

  private editedCommand: string;
  private editedArgs: string;
  private editedEnv: Record<string, string>;

  constructor(app: App, serverName: string, config: MCPServerConfig, onSuccess: () => void, envChecker?: EnvironmentChecker) {
    super(app);
    this.serverName = serverName;
    this.config = config;
    this.envChecker = envChecker || new EnvironmentChecker();
    this.onSuccess = onSuccess;

    this.editedCommand = config.command || "";
    this.editedArgs = config.args?.join(" ") || "";
    this.editedEnv = config.env ? { ...config.env } : {};
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("mcp-modal");

    // Header
    contentEl.createEl("h2", { text: `✏️ ${this.serverName} 편집` });

    // Command
    new Setting(contentEl)
      .setName("Command")
      .setDesc("실행할 명령어")
      .addText((text) =>
        text.setValue(this.editedCommand).onChange((value) => {
          this.editedCommand = value;
        })
      );

    // Args
    new Setting(contentEl)
      .setName("Arguments")
      .setDesc("명령어 인자 (공백으로 구분)")
      .addText((text) =>
        text.setValue(this.editedArgs).onChange((value) => {
          this.editedArgs = value;
        })
      );

    // Env vars section
    const envSection = contentEl.createDiv({ cls: "mcp-modal-section" });
    envSection.createEl("h4", { text: "환경변수" });

    // Existing env vars
    for (const [key, value] of Object.entries(this.editedEnv)) {
      this.renderEnvVarRow(envSection, key, value);
    }

    // Add new env var button
    const addEnvBtn = envSection.createEl("button", {
      text: "+ 환경변수 추가",
      cls: "mcp-btn mcp-btn-secondary mcp-btn-sm",
    });
    addEnvBtn.addEventListener("click", () => {
      const key = prompt("환경변수 이름:");
      if (key) {
        this.editedEnv[key] = "";
        this.renderEnvVarRow(envSection, key, "", addEnvBtn);
      }
    });

    // Actions
    const actions = contentEl.createDiv({ cls: "mcp-modal-actions" });

    const cancelBtn = actions.createEl("button", { text: "취소", cls: "mcp-btn mcp-btn-secondary" });
    cancelBtn.addEventListener("click", () => this.close());

    const saveBtn = actions.createEl("button", { text: "저장", cls: "mcp-btn mcp-btn-primary" });
    saveBtn.addEventListener("click", () => this.handleSave());
  }

  private renderEnvVarRow(container: HTMLElement, key: string, value: string, beforeEl?: HTMLElement): void {
    const row = container.createDiv({ cls: "mcp-env-row" });
    if (beforeEl) {
      container.insertBefore(row, beforeEl);
    }

    row.createSpan({ text: key, cls: "mcp-env-key" });

    const input = row.createEl("input", {
      type: "text",
      cls: "mcp-env-input",
      value: value,
      placeholder: "값 입력...",
    });
    input.addEventListener("change", (e) => {
      this.editedEnv[key] = (e.target as HTMLInputElement).value;
    });

    const deleteBtn = row.createEl("button", { text: "🗑️", cls: "mcp-btn-icon" });
    deleteBtn.addEventListener("click", () => {
      delete this.editedEnv[key];
      row.remove();
    });
  }

  private async handleSave(): Promise<void> {
    if (!this.editedCommand) {
      new Notice("Command를 입력해주세요");
      return;
    }

    const config: MCPServerConfig = {
      type: this.config.type || "stdio",
      command: this.editedCommand,
    };

    if (this.editedArgs) {
      config.args = this.editedArgs.split(" ").filter(Boolean);
    }

    if (Object.keys(this.editedEnv).length > 0) {
      config.env = this.editedEnv;
    }

    const success = await this.envChecker.addMCPServer(this.serverName, config);

    if (success) {
      new Notice(`${this.serverName} 서버가 업데이트되었습니다`);
      this.onSuccess();
      this.close();
    } else {
      new Notice("저장에 실패했습니다");
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Modal for adding custom MCP server
 */
export class MCPServerCustomModal extends Modal {
  private envChecker: EnvironmentChecker;
  private onSuccess: () => void;

  private serverName: string = "";
  private command: string = "";
  private args: string = "";
  private envVars: Record<string, string> = {};

  constructor(app: App, onSuccess: () => void, envChecker?: EnvironmentChecker) {
    super(app);
    this.envChecker = envChecker || new EnvironmentChecker();
    this.onSuccess = onSuccess;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("mcp-modal");

    // Header
    contentEl.createEl("h2", { text: "➕ 커스텀 MCP 서버 추가" });

    contentEl.createEl("p", {
      text: "수동으로 MCP 서버를 구성합니다.",
      cls: "mcp-modal-desc",
    });

    // Server name
    new Setting(contentEl)
      .setName("서버 이름")
      .setDesc("고유한 식별자 (예: my-custom-server)")
      .addText((text) =>
        text.setPlaceholder("server-name").onChange((value) => {
          this.serverName = value;
        })
      );

    // Command
    new Setting(contentEl)
      .setName("Command")
      .setDesc("실행할 명령어 (예: npx, node, python)")
      .addText((text) =>
        text.setPlaceholder("npx").onChange((value) => {
          this.command = value;
        })
      );

    // Args
    new Setting(contentEl)
      .setName("Arguments")
      .setDesc("명령어 인자 (공백으로 구분)")
      .addText((text) =>
        text.setPlaceholder("-y @my/mcp-server").onChange((value) => {
          this.args = value;
        })
      );

    // Env vars section
    const envSection = contentEl.createDiv({ cls: "mcp-modal-section" });
    envSection.createEl("h4", { text: "환경변수" });

    const envContainer = envSection.createDiv({ cls: "mcp-env-container" });

    const addEnvBtn = envSection.createEl("button", {
      text: "+ 환경변수 추가",
      cls: "mcp-btn mcp-btn-secondary mcp-btn-sm",
    });
    addEnvBtn.addEventListener("click", () => {
      const key = prompt("환경변수 이름:");
      if (key) {
        this.envVars[key] = "";
        this.renderEnvVarRow(envContainer, key, "");
      }
    });

    // Actions
    const actions = contentEl.createDiv({ cls: "mcp-modal-actions" });

    const cancelBtn = actions.createEl("button", { text: "취소", cls: "mcp-btn mcp-btn-secondary" });
    cancelBtn.addEventListener("click", () => this.close());

    const addBtn = actions.createEl("button", { text: "추가", cls: "mcp-btn mcp-btn-primary" });
    addBtn.addEventListener("click", () => this.handleAdd());
  }

  private renderEnvVarRow(container: HTMLElement, key: string, value: string): void {
    const row = container.createDiv({ cls: "mcp-env-row" });

    row.createSpan({ text: key, cls: "mcp-env-key" });

    const input = row.createEl("input", {
      type: "text",
      cls: "mcp-env-input",
      value: value,
      placeholder: "값 입력...",
    });
    input.addEventListener("change", (e) => {
      this.envVars[key] = (e.target as HTMLInputElement).value;
    });

    const deleteBtn = row.createEl("button", { text: "🗑️", cls: "mcp-btn-icon" });
    deleteBtn.addEventListener("click", () => {
      delete this.envVars[key];
      row.remove();
    });
  }

  private async handleAdd(): Promise<void> {
    if (!this.serverName) {
      new Notice("서버 이름을 입력해주세요");
      return;
    }

    if (!this.command) {
      new Notice("Command를 입력해주세요");
      return;
    }

    const config: MCPServerConfig = {
      type: "stdio",
      command: this.command,
    };

    if (this.args) {
      config.args = this.args.split(" ").filter(Boolean);
    }

    if (Object.keys(this.envVars).length > 0) {
      config.env = this.envVars;
    }

    const success = await this.envChecker.addMCPServer(this.serverName, config);

    if (success) {
      new Notice(`${this.serverName} 서버가 추가되었습니다`);
      this.onSuccess();
      this.close();
    } else {
      new Notice("서버 추가에 실패했습니다");
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Modal for adding remote MCP server (SSE/HTTP)
 */
export class MCPServerRemoteModal extends Modal {
  private envChecker: EnvironmentChecker;
  private onSuccess: () => void;

  private serverName: string = "";
  private serverUrl: string = "";
  private transport: MCPTransport = "sse";
  private headers: Record<string, string> = {};

  constructor(app: App, onSuccess: () => void, envChecker?: EnvironmentChecker) {
    super(app);
    this.envChecker = envChecker || new EnvironmentChecker();
    this.onSuccess = onSuccess;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("mcp-modal");

    // Header
    contentEl.createEl("h2", { text: "🌐 원격 MCP 서버 추가" });

    contentEl.createEl("p", {
      text: "SSE 또는 HTTP 기반 원격 MCP 서버를 추가합니다.",
      cls: "mcp-modal-desc",
    });

    // Server name
    new Setting(contentEl)
      .setName("서버 이름")
      .setDesc("고유한 식별자 (예: my-remote-server)")
      .addText((text) =>
        text.setPlaceholder("server-name").onChange((value) => {
          this.serverName = value;
        })
      );

    // Transport type
    new Setting(contentEl)
      .setName("Transport")
      .setDesc("연결 방식을 선택합니다")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("sse", "SSE (Server-Sent Events)")
          .addOption("http", "HTTP (Streamable HTTP)")
          .setValue(this.transport)
          .onChange((value) => {
            this.transport = value as MCPTransport;
          })
      );

    // Server URL
    new Setting(contentEl)
      .setName("서버 URL")
      .setDesc("원격 MCP 서버의 전체 URL")
      .addText((text) =>
        text.setPlaceholder("https://mcp.example.com/v1/sse").onChange((value) => {
          this.serverUrl = value;
        })
      );

    // Headers section
    const headerSection = contentEl.createDiv({ cls: "mcp-modal-section" });
    headerSection.createEl("h4", { text: "HTTP 헤더 (선택)" });
    headerSection.createEl("p", {
      text: "인증 토큰 등 추가 헤더가 필요한 경우 입력하세요.",
      cls: "mcp-modal-hint",
    });

    const headerContainer = headerSection.createDiv({ cls: "mcp-header-container" });

    const addHeaderBtn = headerSection.createEl("button", {
      text: "+ 헤더 추가",
      cls: "mcp-btn mcp-btn-secondary mcp-btn-sm",
    });
    addHeaderBtn.addEventListener("click", () => {
      const key = prompt("헤더 이름 (예: Authorization):");
      if (key) {
        this.headers[key] = "";
        this.renderHeaderRow(headerContainer, key, "");
      }
    });

    // Actions
    const actions = contentEl.createDiv({ cls: "mcp-modal-actions" });

    const cancelBtn = actions.createEl("button", { text: "취소", cls: "mcp-btn mcp-btn-secondary" });
    cancelBtn.addEventListener("click", () => this.close());

    const addBtn = actions.createEl("button", { text: "추가", cls: "mcp-btn mcp-btn-primary" });
    addBtn.addEventListener("click", () => this.handleAdd());
  }

  private renderHeaderRow(container: HTMLElement, key: string, value: string): void {
    const row = container.createDiv({ cls: "mcp-header-row" });

    row.createSpan({ text: key, cls: "mcp-header-key" });

    const input = row.createEl("input", {
      type: "text",
      cls: "mcp-header-input",
      value: value,
      placeholder: "값 입력...",
    });
    input.addEventListener("change", (e) => {
      this.headers[key] = (e.target as HTMLInputElement).value;
    });

    const deleteBtn = row.createEl("button", { text: "🗑️", cls: "mcp-btn-icon" });
    deleteBtn.addEventListener("click", () => {
      delete this.headers[key];
      row.remove();
    });
  }

  private async handleAdd(): Promise<void> {
    if (!this.serverName) {
      new Notice("서버 이름을 입력해주세요");
      return;
    }

    if (!this.serverUrl) {
      new Notice("서버 URL을 입력해주세요");
      return;
    }

    // Validate URL
    try {
      new URL(this.serverUrl);
    } catch {
      new Notice("올바른 URL 형식이 아닙니다");
      return;
    }

    const config: MCPServerConfig = {
      type: this.transport,
      url: this.serverUrl,
    };

    if (Object.keys(this.headers).length > 0) {
      config.headers = this.headers;
    }

    const success = await this.envChecker.addMCPServer(this.serverName, config);

    if (success) {
      new Notice(`${this.serverName} 서버가 추가되었습니다`);
      this.onSuccess();
      this.close();
    } else {
      new Notice("서버 추가에 실패했습니다");
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
