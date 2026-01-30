/**
 * Claude Manager
 *
 * Spawns Claude Code CLI and manages streaming conversations.
 * Uses node-pty for process management with streaming output.
 */

import type IntegrationAIPlugin from "../main";
import type { ChatMessage, StreamCallbacks, MessageHistory } from "../types";
import { getNodePty, type IPty } from "../terminal/electron-bridge";
import { MentionResolver } from "./mentions/mention-resolver";

const HISTORY_KEY = "agent-chat-history";
const MAX_HISTORY_MESSAGES = 100;

export class ClaudeManager {
  private plugin: IntegrationAIPlugin;
  private mentionResolver: MentionResolver;
  private currentPty: IPty | null = null;
  private currentBuffer = "";
  private sessionId = 0;

  constructor(plugin: IntegrationAIPlugin) {
    this.plugin = plugin;
    this.mentionResolver = new MentionResolver(plugin.app.vault);
  }

  /**
   * Send a message to Claude and stream the response
   *
   * Authentication: Claude CLI handles auth automatically.
   * - OAuth login (Claude Max subscription) - recommended
   * - API key via ANTHROPIC_API_KEY env var - optional
   */
  async sendMessage(
    userInput: string,
    callbacks: StreamCallbacks
  ): Promise<void> {
    // Stop any existing request
    this.stopGeneration();

    // Resolve @mentions and build full prompt
    const { contextPrefix } = await this.mentionResolver.resolveFromText(userInput);
    const fullPrompt = contextPrefix + userInput;

    // Get node-pty
    const nodePty = getNodePty();
    if (!nodePty) {
      callbacks.onError("터미널을 초기화할 수 없습니다. 플러그인을 다시 로드해 주세요.");
      return;
    }

    // Build command arguments
    const args = this.buildClaudeArgs(fullPrompt);

    // Get vault path for cwd
    const vaultPath = this.getVaultPath();

    // Environment with API key
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ...this.plugin.getEnvironmentVariables(),
      LANG: process.env.LANG || "en_US.UTF-8",
      TERM: "xterm-256color",
    };

    this.sessionId++;
    const currentSession = this.sessionId;
    this.currentBuffer = "";

    try {
      // Spawn claude CLI
      this.currentPty = nodePty.spawn("claude", args, {
        name: "xterm-256color",
        cols: 120,
        rows: 40,
        cwd: vaultPath,
        env,
      });

      // Handle output data
      this.currentPty.onData((data: string) => {
        if (currentSession !== this.sessionId) return;

        // Strip ANSI escape codes for clean text
        const cleanText = this.stripAnsiCodes(data);
        if (cleanText) {
          this.currentBuffer += cleanText;
          callbacks.onChunk(cleanText);
        }
      });

      // Handle exit
      this.currentPty.onExit((e: { exitCode: number; signal?: number }) => {
        if (currentSession !== this.sessionId) return;

        this.currentPty = null;

        if (e.exitCode === 0) {
          callbacks.onComplete(this.currentBuffer.trim());
        } else {
          // Check for common errors
          const errorMsg = this.parseErrorFromBuffer(this.currentBuffer, e.exitCode);
          callbacks.onError(errorMsg);
        }
      });
    } catch (error) {
      this.currentPty = null;
      const errMsg = error instanceof Error ? error.message : "Unknown error";

      if (errMsg.includes("ENOENT") || errMsg.includes("not found")) {
        callbacks.onError("Claude CLI를 찾을 수 없습니다. `npm install -g @anthropic-ai/claude-code`로 설치하세요.");
      } else {
        callbacks.onError(`Claude 실행 오류: ${errMsg}`);
      }
    }
  }

  /**
   * Build Claude CLI arguments
   */
  private buildClaudeArgs(prompt: string): string[] {
    const args: string[] = [];

    // Add print flag for non-interactive mode
    args.push("--print");

    // Add model if specified
    if (this.plugin.settings.defaultModel) {
      args.push("--model", this.plugin.settings.defaultModel);
    }

    // Add max tokens
    if (this.plugin.settings.maxTokens) {
      args.push("--max-tokens", String(this.plugin.settings.maxTokens));
    }

    // Add the prompt
    args.push(prompt);

    return args;
  }

  /**
   * Get vault base path
   */
  private getVaultPath(): string {
    const adapter = this.plugin.app.vault.adapter as { basePath?: string };
    return adapter.basePath || process.cwd();
  }

  /**
   * Strip ANSI escape codes from text
   */
  private stripAnsiCodes(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
  }

  /**
   * Parse error message from output buffer
   */
  private parseErrorFromBuffer(buffer: string, exitCode: number): string {
    const lower = buffer.toLowerCase();

    if (lower.includes("api key") || lower.includes("unauthorized") || lower.includes("authentication")) {
      return "인증이 필요합니다. 터미널에서 `claude` 실행 후 OAuth 로그인하거나, 설정에서 API 키를 입력하세요.";
    }

    if (lower.includes("rate limit") || lower.includes("429")) {
      return "API 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.";
    }

    if (lower.includes("network") || lower.includes("connection")) {
      return "네트워크 오류가 발생했습니다. 인터넷 연결을 확인하세요.";
    }

    if (lower.includes("model") && lower.includes("not found")) {
      return "지정된 모델을 찾을 수 없습니다. 설정에서 모델명을 확인하세요.";
    }

    // Generic error
    return `Claude 오류 (코드: ${exitCode}): ${buffer.slice(0, 200)}`;
  }

  /**
   * Stop current generation
   */
  stopGeneration(): void {
    if (this.currentPty) {
      try {
        this.currentPty.kill();
      } catch (e) {
        // Ignore kill errors
      }
      this.currentPty = null;
    }
    this.sessionId++;
  }

  /**
   * Load message history from plugin data
   */
  async loadHistory(): Promise<ChatMessage[]> {
    try {
      const data = await this.plugin.loadData();
      const history = data?.[HISTORY_KEY] as MessageHistory | undefined;
      return history?.messages || [];
    } catch {
      return [];
    }
  }

  /**
   * Save message history to plugin data
   */
  async saveHistory(messages: ChatMessage[]): Promise<void> {
    try {
      // Limit history size
      const trimmedMessages = messages.slice(-MAX_HISTORY_MESSAGES);

      const history: MessageHistory = {
        messages: trimmedMessages,
        updatedAt: Date.now(),
      };

      const data = (await this.plugin.loadData()) || {};
      data[HISTORY_KEY] = history;
      await this.plugin.saveData(data);
    } catch (error) {
      console.error("[ClaudeManager] Failed to save history:", error);
    }
  }

  /**
   * Clear mention cache (call when vault changes)
   */
  clearCache(): void {
    this.mentionResolver.clearCache();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopGeneration();
  }
}
