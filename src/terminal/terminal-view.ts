import { ItemView, WorkspaceLeaf } from "obsidian";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
// WebGL addon disabled - causes rendering issues in Obsidian's Shadow DOM
// import { WebglAddon } from "@xterm/addon-webgl";
import { TERMINAL_VIEW_TYPE } from "../constants";
import type IntegrationAIPlugin from "../main";
import { PTYManager } from "./pty-manager";
import { SessionManager } from "./terminal-session";
import { checkABICompatibility, getDefaultShell } from "./electron-bridge";

// xterm.js CSS (will be injected into Shadow DOM)
const XTERM_CSS = `
.xterm {
  cursor: text;
  position: relative;
  user-select: none;
  -ms-user-select: none;
  -webkit-user-select: none;
}
.xterm.focus, .xterm:focus {
  outline: none;
}
.xterm .xterm-helpers {
  position: absolute;
  top: 0;
  z-index: 5;
}
.xterm .xterm-helper-textarea {
  padding: 0;
  border: 0;
  margin: 0;
  position: absolute;
  opacity: 0;
  left: -9999em;
  top: 0;
  width: 0;
  height: 0;
  z-index: -5;
  white-space: nowrap;
  overflow: hidden;
  resize: none;
}
.xterm .composition-view {
  background: #000;
  color: #FFF;
  display: none;
  position: absolute;
  white-space: nowrap;
  z-index: 1;
}
.xterm .composition-view.active {
  display: block;
}
.xterm .xterm-viewport {
  background-color: #000;
  overflow-y: scroll;
  cursor: default;
  position: absolute;
  right: 0;
  left: 0;
  top: 0;
  bottom: 0;
}
.xterm .xterm-screen {
  position: relative;
}
.xterm .xterm-screen canvas {
  position: absolute;
  left: 0;
  top: 0;
}
.xterm .xterm-scroll-area {
  visibility: hidden;
}
.xterm-char-measure-element {
  display: inline-block;
  visibility: hidden;
  position: absolute;
  top: 0;
  left: -9999em;
  line-height: normal;
}
.xterm.enable-mouse-events {
  cursor: default;
}
.xterm.xterm-cursor-pointer, .xterm .xterm-cursor-pointer {
  cursor: pointer;
}
.xterm.column-select.focus {
  cursor: crosshair;
}
.xterm .xterm-accessibility:not(.debug), .xterm .xterm-message {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
  z-index: 10;
  color: transparent;
  pointer-events: none;
}
.xterm .xterm-accessibility-tree:not(.debug) *::selection {
  color: transparent;
}
.xterm .xterm-accessibility-tree {
  user-select: text;
  white-space: pre;
}
.xterm .live-region {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.xterm-dim {
  opacity: 1 !important;
}
.xterm-underline-1 { text-decoration: underline; }
.xterm-underline-2 { text-decoration: double underline; }
.xterm-underline-3 { text-decoration: wavy underline; }
.xterm-underline-4 { text-decoration: dotted underline; }
.xterm-underline-5 { text-decoration: dashed underline; }
.xterm-overline { text-decoration: overline; }
.xterm-overline.xterm-underline-1 { text-decoration: overline underline; }
.xterm-overline.xterm-underline-2 { text-decoration: overline double underline; }
.xterm-overline.xterm-underline-3 { text-decoration: overline wavy underline; }
.xterm-overline.xterm-underline-4 { text-decoration: overline dotted underline; }
.xterm-overline.xterm-underline-5 { text-decoration: overline dashed underline; }
.xterm-strikethrough { text-decoration: line-through; }
.xterm-screen .xterm-decoration-container .xterm-decoration {
  z-index: 6;
  position: absolute;
}
.xterm-screen .xterm-decoration-container .xterm-decoration.xterm-decoration-top-layer {
  z-index: 7;
}
.xterm-decoration-overview-ruler {
  z-index: 8;
  position: absolute;
  top: 0;
  right: 0;
  pointer-events: none;
}
.xterm-decoration-top {
  z-index: 2;
  position: relative;
}
`;

/**
 * Terminal View
 *
 * xterm.js + node-pty 기반 터미널 뷰.
 * Shadow DOM으로 Obsidian CSS 격리.
 */
export class TerminalView extends ItemView {
  plugin: IntegrationAIPlugin;
  private terminal: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  private sessionId: string | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isInitialized = false;

  // Data batching for performance optimization
  private writeBuffer: string[] = [];
  private flushScheduled = false;

  constructor(leaf: WorkspaceLeaf, plugin: IntegrationAIPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return TERMINAL_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "터미널";
  }

  getIcon(): string {
    return "terminal";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("integration-terminal-container");

    // Check ABI compatibility first
    const abiCheck = checkABICompatibility();
    if (!abiCheck.compatible) {
      this.renderError(container, abiCheck.message);
      return;
    }

    // Initialize terminal
    await this.initializeTerminal(container);
  }

  async onClose(): Promise<void> {
    this.cleanup();
  }

  private cleanup(): void {
    // Stop resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clear resize timeout
    if (this.resizeTimeoutId) {
      clearTimeout(this.resizeTimeoutId);
      this.resizeTimeoutId = null;
    }

    // Clear write buffer
    this.writeBuffer = [];
    this.flushScheduled = false;

    // Destroy PTY
    if (this.sessionId) {
      const ptyManager = PTYManager.getInstance();
      ptyManager.destroyPTY(this.sessionId);

      const sessionManager = SessionManager.getInstance();
      sessionManager.removeSession(this.sessionId);

      this.sessionId = null;
    }

    // Dispose terminal
    if (this.terminal) {
      this.terminal.dispose();
      this.terminal = null;
    }

    this.fitAddon = null;
    this.shadowRoot = null;
    this.isInitialized = false;
  }

  private async initializeTerminal(container: HTMLElement): Promise<void> {
    // Create Shadow DOM for CSS isolation
    const shadowHost = container.createDiv({ cls: "terminal-shadow-host" });
    this.shadowRoot = shadowHost.attachShadow({ mode: "open" });

    // Inject xterm CSS into Shadow DOM
    const style = document.createElement("style");
    style.textContent = XTERM_CSS + `
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      }
      .terminal-container {
        flex: 1;
        width: 100%;
        height: 100%;
        background: #1e1e1e;
      }
      .xterm {
        height: 100%;
        padding: 8px;
      }
    `;
    this.shadowRoot.appendChild(style);

    // Create terminal container
    const terminalContainer = document.createElement("div");
    terminalContainer.className = "terminal-container";
    this.shadowRoot.appendChild(terminalContainer);

    // Initialize xterm.js
    this.terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: this.plugin.settings.terminalFontSize || 14,
      fontFamily:
        this.plugin.settings.terminalFontFamily ||
        "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#aeafad",
        cursorAccent: "#1e1e1e",
        selectionBackground: "#264f78",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#ffffff",
      },
      allowProposedApi: true,
    });

    // Load addons
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    const webLinksAddon = new WebLinksAddon();
    this.terminal.loadAddon(webLinksAddon);

    // Open terminal in container
    this.terminal.open(terminalContainer);

    // WebGL renderer disabled - causes rendering issues in Obsidian's Shadow DOM
    // TODO: Investigate WebGL compatibility with Shadow DOM
    // The canvas renderer provides sufficient performance with data batching
    console.log("[TerminalView] Using canvas renderer");

    // Initial fit
    this.fitAddon.fit();

    // Create PTY and connect
    await this.createPTYSession();

    // Set up resize handling
    this.setupResizeHandler(shadowHost);

    this.isInitialized = true;
  }

  private async createPTYSession(): Promise<void> {
    if (!this.terminal) {
      console.error("[TerminalView] Terminal not initialized");
      return;
    }

    const sessionManager = SessionManager.getInstance();
    const ptyManager = PTYManager.getInstance();

    // Generate session ID
    this.sessionId = sessionManager.generateId();

    // Get working directory (vault path)
    const vaultPath = (this.app.vault.adapter as { basePath?: string }).basePath;
    const cwd = vaultPath || process.cwd();

    // Get shell
    const shell = this.plugin.settings.terminalShell || getDefaultShell();

    // Get environment variables from plugin (MCP config + shell config)
    const pluginEnv = await this.plugin.getEnvironmentVariables();

    // Create PTY
    const pty = ptyManager.createPTY(
      this.sessionId,
      {
        shell,
        cwd,
        env: pluginEnv,
        cols: this.terminal.cols,
        rows: this.terminal.rows,
      },
      {
        onData: (data) => {
          // PTY → Terminal (batched for performance)
          this.handlePTYData(data);
        },
        onExit: (exitCode, signal) => {
          console.log(
            `[TerminalView] PTY exited: code=${exitCode}, signal=${signal}`
          );
          this.terminal?.write(
            `\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`
          );

          if (this.sessionId) {
            sessionManager.deactivateSession(this.sessionId);
          }
        },
      }
    );

    if (!pty) {
      this.terminal.write(
        "\x1b[31mFailed to create terminal session.\x1b[0m\r\n"
      );
      this.terminal.write(
        "\x1b[33mTry running: npm run rebuild:electron\x1b[0m\r\n"
      );
      return;
    }

    // Create session record
    sessionManager.createSession(this.sessionId, pty.pid, cwd, shell);

    // Terminal → PTY
    this.terminal.onData((data) => {
      if (this.sessionId) {
        ptyManager.write(this.sessionId, data);
      }
    });

    // Handle terminal resize
    this.terminal.onResize(({ cols, rows }) => {
      if (this.sessionId) {
        ptyManager.resize(this.sessionId, cols, rows);
      }
    });

    console.log(
      `[TerminalView] Session ${this.sessionId} connected (PID: ${pty.pid})`
    );
  }

  private setupResizeHandler(container: HTMLElement): void {
    // Use ResizeObserver for container size changes with debouncing
    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeTimeoutId) {
        clearTimeout(this.resizeTimeoutId);
      }
      this.resizeTimeoutId = setTimeout(() => {
        this.fitTerminal();
        this.resizeTimeoutId = null;
      }, 100);
    });
    this.resizeObserver.observe(container);
  }

  /**
   * Handle PTY data with batching for performance optimization.
   * Multiple data chunks are collected and flushed together
   * using requestAnimationFrame to reduce rendering overhead.
   */
  private handlePTYData(data: string): void {
    this.writeBuffer.push(data);
    if (!this.flushScheduled) {
      this.flushScheduled = true;
      // Use requestAnimationFrame for batching, with fallback
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(() => this.flushBuffer());
      } else {
        setTimeout(() => this.flushBuffer(), 16);
      }
    }
  }

  /**
   * Flush the write buffer to the terminal.
   * Combines all buffered data into a single write operation.
   */
  private flushBuffer(): void {
    this.flushScheduled = false;
    if (!this.terminal || this.writeBuffer.length === 0) {
      return;
    }
    const data = this.writeBuffer.join("");
    this.writeBuffer = [];
    this.terminal.write(data);
  }

  private fitTerminal(): void {
    if (this.fitAddon && this.terminal && this.isInitialized) {
      try {
        this.fitAddon.fit();
      } catch (error) {
        // Ignore fit errors (can happen during close)
        console.debug("[TerminalView] Fit error:", error);
      }
    }
  }

  private renderError(container: HTMLElement, message: string): void {
    const errorDiv = container.createDiv({
      cls: "integration-terminal-error",
    });

    errorDiv.innerHTML = `
      <div style="text-align: center; padding: 24px;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px; color: var(--text-error);">
          터미널 초기화 실패
        </div>
        <div style="font-size: 14px; color: var(--text-muted); margin-bottom: 16px;">
          ${message}
        </div>
        <div style="font-size: 12px; color: var(--text-faint);">
          다음 명령어를 실행해보세요:<br>
          <code style="background: var(--background-secondary); padding: 4px 8px; border-radius: 4px; margin-top: 8px; display: inline-block;">
            npm run rebuild:electron
          </code>
        </div>
      </div>
    `;
  }

  /**
   * Focus the terminal
   */
  focus(): void {
    if (this.terminal) {
      this.terminal.focus();
    }
  }

  /**
   * Write data to terminal (for external use)
   */
  writeToTerminal(data: string): void {
    if (this.sessionId) {
      PTYManager.getInstance().write(this.sessionId, data);
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }
}
