/**
 * SaaS DocOps Constants
 */

// View Types
export const TERMINAL_VIEW_TYPE = "integration-terminal-view";
export const GIT_VIEW_TYPE = "integration-git-view";

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

// Icon Names
export const ICONS = {
  terminal: "terminal",
  settings: "settings",
  sync: "refresh-cw",
  slack: "send",
  confluence: "file-text",
  git: "users",
} as const;
