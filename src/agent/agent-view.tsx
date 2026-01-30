import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import * as React from "react";
import { AGENT_VIEW_TYPE } from "../constants";
import type IntegrationAIPlugin from "../main";
import type { ChatMessage } from "../types";
import { ClaudeManager } from "./claude-manager";
import { MentionAutocomplete, useMentionInput } from "./mentions";

/**
 * Agent View
 *
 * React 기반 채팅 UI.
 * Claude Code CLI를 통한 스트리밍 응답 지원.
 *
 * 기능:
 * - Claude Code CLI 연동
 * - @notename 멘션 시스템
 * - 스트리밍 응답
 * - 메시지 히스토리
 */
export class AgentView extends ItemView {
  plugin: IntegrationAIPlugin;
  private root: Root | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: IntegrationAIPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return AGENT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "에이전트";
  }

  getIcon(): string {
    return "message-square";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("integration-agent-container");

    // React 루트 생성
    this.root = createRoot(container);
    this.root.render(<AgentPanel plugin={this.plugin} />);
  }

  async onClose(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

/**
 * Agent Panel React Component
 */
interface AgentPanelProps {
  plugin: IntegrationAIPlugin;
}

function AgentPanel({ plugin }: AgentPanelProps): React.ReactElement {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [streamingText, setStreamingText] = React.useState("");
  const [isInitialized, setIsInitialized] = React.useState(false);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const claudeManagerRef = React.useRef<ClaudeManager | null>(null);

  // Initialize ClaudeManager
  React.useEffect(() => {
    claudeManagerRef.current = new ClaudeManager(plugin);

    // Load history
    claudeManagerRef.current.loadHistory().then((history) => {
      if (history.length === 0) {
        // Add welcome message if no history
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: "안녕하세요! SaaS DocOps입니다. 무엇을 도와드릴까요?\n\n💡 @노트이름으로 노트를 참조할 수 있습니다.",
            timestamp: Date.now(),
          },
        ]);
      } else {
        setMessages(history);
      }
      setIsInitialized(true);
    });

    return () => {
      claudeManagerRef.current?.destroy();
    };
  }, [plugin]);

  // Mention input hook
  const mentionInput = useMentionInput(plugin.app.vault);

  // Auto-scroll on new messages
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Handle input change with mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    if (textareaRef.current) {
      mentionInput.handleInputChange(
        value,
        textareaRef.current.selectionStart,
        textareaRef.current
      );
    }
  };

  // Handle key down (mention nav + send)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Let mention handler try first
    const handled = mentionInput.handleKeyDown(e, input, setInput);
    if (handled) return;

    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle mention selection
  const handleMentionSelect = (result: { name: string; path: string; folder: string; score: number }) => {
    mentionInput.handleSelect(result, input, setInput);
    textareaRef.current?.focus();
  };

  // Send message
  const handleSend = async () => {
    if (!input.trim() || isLoading || !claudeManagerRef.current) return;

    const userContent = input.trim();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userContent,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingText("");
    mentionInput.handleCancel();

    // Send to Claude
    claudeManagerRef.current.sendMessage(userContent, {
      onChunk: (text) => {
        setStreamingText((prev) => prev + text);
      },
      onComplete: (fullText) => {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: fullText,
          timestamp: Date.now(),
        };

        setMessages((prev) => {
          const newMessages = [...prev, assistantMessage];
          // Save history with the complete message array
          claudeManagerRef.current?.saveHistory(newMessages);
          return newMessages;
        });

        setStreamingText("");
        setIsLoading(false);
      },
      onError: (error) => {
        // Show error as system message
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "system",
          content: `⚠️ ${error}`,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, errorMessage]);
        setStreamingText("");
        setIsLoading(false);
      },
    });
  };

  // Stop generation
  const handleStop = () => {
    claudeManagerRef.current?.stopGeneration();
    setIsLoading(false);

    // If there was partial streaming text, save it
    if (streamingText) {
      const partialMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: streamingText + "\n\n*[응답 중단됨]*",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, partialMessage]);
      setStreamingText("");
    }
  };

  const hasApiKey = !!plugin.settings.anthropicApiKey;

  return (
    <>
      {/* Header */}
      <div className="integration-agent-header">
        <span style={{ fontSize: "18px" }}>🤖</span>
        <h4>Agent Panel</h4>
        <span
          className={`integration-status-indicator ${hasApiKey ? "connected" : "disconnected"}`}
          style={{ marginLeft: "auto" }}
        >
          <span className="integration-status-dot" />
          {hasApiKey ? "준비됨" : "API 키 필요"}
        </span>
      </div>

      {/* Messages */}
      <div className="integration-agent-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`integration-agent-message ${msg.role}`}
          >
            {msg.content}
          </div>
        ))}

        {/* Streaming response */}
        {isLoading && streamingText && (
          <div className="integration-agent-message assistant streaming">
            {streamingText}
            <span className="integration-streaming-cursor">▋</span>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !streamingText && (
          <div className="integration-agent-message assistant">
            <span className="integration-thinking">생각 중...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="integration-agent-input-container">
        <div className="integration-agent-input-wrapper">
          <textarea
            ref={textareaRef}
            className="integration-agent-input"
            placeholder="메시지를 입력하세요... (@로 노트 참조)"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={!isInitialized}
          />

          {/* Mention Autocomplete */}
          {mentionInput.state.showAutocomplete && (
            <MentionAutocomplete
              results={mentionInput.state.results}
              selectedIndex={mentionInput.state.selectedIndex}
              position={mentionInput.state.position}
              onSelect={handleMentionSelect}
              onCancel={mentionInput.handleCancel}
            />
          )}
        </div>

        {isLoading ? (
          <button
            className="integration-agent-send-btn integration-agent-stop-btn"
            onClick={handleStop}
          >
            중지
          </button>
        ) : (
          <button
            className="integration-agent-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || !isInitialized}
          >
            전송
          </button>
        )}
      </div>
    </>
  );
}
