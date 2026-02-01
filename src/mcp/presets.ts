/**
 * MCP Server Presets
 *
 * 자주 사용되는 MCP 서버 프리셋 정의
 * - stdio: 로컬 프로세스 실행 (command + args)
 * - sse/http: 원격 MCP 서버 연결 (url)
 */

export type MCPTransport = "stdio" | "http" | "sse";

export interface MCPPreset {
  id: string;
  name: string;
  iconName: string; // Lucide icon name
  description: string;
  transport: MCPTransport;
  // stdio transport
  command?: string;
  args?: string[];
  requiredEnvVars?: string[];
  optionalEnvVars?: string[];
  defaultEnvVars?: Record<string, string>; // 자동으로 설정되는 환경변수
  // http/sse transport
  url?: string;
  requiresOAuth?: boolean;
}

export const MCP_PRESETS: MCPPreset[] = [
  {
    id: "slack-bot",
    name: "Slack Bot",
    iconName: "bot",
    description: "Slack Bot Token (xoxb-) 사용",
    transport: "stdio",
    command: "npx",
    args: ["-y", "slack-mcp-server@latest", "--transport", "stdio"],
    requiredEnvVars: ["SLACK_MCP_XOXB_TOKEN"],
    defaultEnvVars: { SLACK_MCP_ADD_MESSAGE_TOOL: "true" },
  },
  {
    id: "slack-personal",
    name: "Slack Personal",
    iconName: "user",
    description: "Slack User Token (xoxp-) 사용",
    transport: "stdio",
    command: "npx",
    args: ["-y", "slack-mcp-server@latest", "--transport", "stdio"],
    requiredEnvVars: ["SLACK_MCP_XOXP_TOKEN"],
    defaultEnvVars: { SLACK_MCP_ADD_MESSAGE_TOOL: "true" },
  },
  {
    id: "atlassian",
    name: "Atlassian",
    iconName: "file-text",
    description: "Confluence, Jira 연동 (공식 OAuth)",
    transport: "http",
    url: "https://mcp.atlassian.com/v1/mcp",
    requiresOAuth: true,
  },
];

/**
 * Get preset by ID
 */
export function getPresetById(id: string): MCPPreset | undefined {
  return MCP_PRESETS.find((p) => p.id === id);
}

/**
 * Get all presets
 */
export function getAllPresets(): MCPPreset[] {
  return MCP_PRESETS;
}
