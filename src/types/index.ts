/**
 * Type Definitions for SaaS DocOps
 */

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
