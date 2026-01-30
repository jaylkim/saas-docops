/**
 * SaaS DocOps Constants
 */

// View Types
export const TERMINAL_VIEW_TYPE = "integration-terminal-view";

// Plugin Info
export const PLUGIN_ID = "saas-docops";
export const PLUGIN_NAME = "SaaS DocOps";

// Default Settings
export const DEFAULT_SETTINGS = {
  // API Keys (터미널에서 환경변수로 주입)
  anthropicApiKey: "",
  slackBotToken: "",
  atlassianApiToken: "",

  // Terminal Settings
  terminalShell: "",
  terminalFontSize: 14,
  terminalFontFamily: "monospace",

  // MCP Settings
  mcpServers: {} as Record<string, MCPServerConfig>,
};

// MCP Server Config Type
export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
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
} as const;
