/**
 * Type Definitions for SaaS DocOps
 */

// Message Types for Agent Panel
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

// Disposable pattern for resource cleanup
export interface IDisposable {
  dispose(): void;
}

// Terminal Session
export interface TerminalSession {
  id: string;
  pid: number;
  cwd: string;
  isActive: boolean;
  shell: string;
  createdAt: number;
}

// PTY Options
export interface PTYOptions {
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

// ABI Check Result for node-pty compatibility
export interface ABICheckResult {
  compatible: boolean;
  electronABI: string;
  nodeABI: string;
  message: string;
}

// PTY Event Handlers
export interface PTYEventHandlers {
  onData?: (data: string) => void;
  onExit?: (exitCode: number, signal?: number) => void;
}

// Agent Connection State
export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

// Mention System Types
export interface MentionMatch {
  query: string;
  startIndex: number;
  endIndex: number;
  isComplete: boolean;
}

export interface NoteSearchResult {
  path: string;
  name: string;
  folder: string;
  score: number;
}

export interface ResolvedMention {
  noteName: string;
  path: string;
  content: string;
  truncated: boolean;
  error?: string;
}

// Claude Streaming Types
export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: string) => void;
}

// Message History Persistence
export interface MessageHistory {
  messages: ChatMessage[];
  updatedAt: number;
}

// MCP Tool Definition
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// Quick Action Definition
export interface QuickAction {
  id: string;
  name: string;
  icon: string;
  description: string;
  command: string;
  args?: string[];
}

// Re-export settings types
export type { IntegrationSettings, MCPServerConfig } from "../constants";
