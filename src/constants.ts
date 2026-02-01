/**
 * SaaS DocOps Constants
 */

// View Types
export const TERMINAL_VIEW_TYPE = "integration-terminal-view";
export const GIT_VIEW_TYPE = "integration-git-view";
export const EXPLORER_VIEW_TYPE = "integration-explorer-view";

// Plugin Info
export const PLUGIN_ID = "saas-docops";
export const PLUGIN_NAME = "SaaS DocOps";

// MCP Config Level Type
export type MCPConfigLevel = "user" | "project";

// Default Settings
export const DEFAULT_SETTINGS = {
  // Wizard State
  wizardCompleted: false,

  // Terminal Settings
  terminalShell: "",
  terminalFontSize: 14,
  terminalFontFamily: "monospace",

  // MCP Settings
  mcpConfigLevel: "user" as MCPConfigLevel, // "user" = ~/.claude.json, "project" = vault/.mcp.json
  mcpServers: {} as Record<string, MCPServerConfig>,
};

// MCP Server Config Type
export interface MCPServerConfig {
  type: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

// Plugin Settings Type
export type IntegrationSettings = typeof DEFAULT_SETTINGS;

// Icon Names (Lucide icon names)
export const ICONS = {
  terminal: "terminal-square",
  settings: "settings",
  sync: "refresh-cw",
  slack: "message-square",
  confluence: "file-text",
  git: "users",
  explorer: "folder-tree",
} as const;
