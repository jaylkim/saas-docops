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
  icon: string;
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
    icon: "🤖",
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
    icon: "👤",
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
    icon: "📄",
    description: "Confluence, Jira 연동 (공식 OAuth)",
    transport: "http",
    url: "https://mcp.atlassian.com/v1/mcp",
    requiresOAuth: true,
  },
  {
    id: "github",
    name: "GitHub",
    icon: "🐙",
    description: "GitHub 리포지토리, 이슈, PR 연동",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-server-github"],
    requiredEnvVars: ["GITHUB_TOKEN"],
  },
  {
    id: "filesystem",
    name: "Filesystem",
    icon: "📁",
    description: "파일 시스템 접근",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-server-filesystem", "/path/to/allowed/directory"],
    requiredEnvVars: [],
  },
  {
    id: "memory",
    name: "Memory",
    icon: "🧠",
    description: "대화 기억 저장",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-server-memory"],
    requiredEnvVars: [],
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    icon: "🐘",
    description: "PostgreSQL 데이터베이스 연동",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-server-postgres"],
    requiredEnvVars: ["DATABASE_URL"],
  },
  {
    id: "sqlite",
    name: "SQLite",
    icon: "💾",
    description: "SQLite 데이터베이스 연동",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@anthropic-ai/mcp-server-sqlite"],
    requiredEnvVars: ["SQLITE_PATH"],
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
