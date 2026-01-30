/**
 * SaaS DocOps Constants
 */

// View Types
export const TERMINAL_VIEW_TYPE = "integration-terminal-view";
export const AGENT_VIEW_TYPE = "integration-agent-view";

// Plugin Info
export const PLUGIN_ID = "saas-docops";
export const PLUGIN_NAME = "SaaS DocOps";

// Default Settings
export const DEFAULT_SETTINGS = {
  // API Keys (stored securely)
  anthropicApiKey: "",
  slackBotToken: "",
  atlassianApiToken: "",

  // Terminal Settings
  terminalShell: "",
  terminalFontSize: 14,
  terminalFontFamily: "monospace",

  // Agent Settings
  defaultModel: "claude-sonnet-4-20250514",
  maxTokens: 4096,

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
  agent: "message-square",
  settings: "settings",
  sync: "refresh-cw",
  slack: "send",
  confluence: "file-text",
} as const;
