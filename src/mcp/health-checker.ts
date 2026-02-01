/**
 * MCP Server Health Checker
 *
 * Provides health check functionality for MCP servers.
 * - stdio: Spawns process and checks if it starts successfully
 * - http/sse: Sends HEAD request to check if server is reachable
 */

import type { MCPServerConfig } from "../wizard/environment-checker";

export type MCPHealthStatus = "healthy" | "unhealthy" | "disabled" | "checking";

export interface MCPHealthResult {
  status: MCPHealthStatus;
  message: string;
  lastChecked: number;
  responseTime?: number;
}

// Cache for health check results
const healthCache: Map<string, MCPHealthResult> = new Map();

// Default timeouts
const STDIO_TIMEOUT = 2000; // 2 seconds for stdio process
const HTTP_TIMEOUT = 5000; // 5 seconds for http/sse

/**
 * Get extended PATH for command execution (same as environment-checker.ts)
 */
function getExtendedPath(): string {
  const os = require("os");
  const homeDir = os.homedir();
  const platform = process.platform;

  const paths = [
    `${homeDir}/.local/bin`,
    `${homeDir}/.npm/bin`,
    `${homeDir}/.volta/bin`,
  ];

  if (platform === "darwin") {
    paths.push(
      "/opt/homebrew/bin",
      "/opt/homebrew/sbin",
      "/usr/local/bin",
      "/usr/local/opt/node/bin"
    );
  }

  paths.push("/usr/bin", "/bin", "/usr/sbin", "/sbin");

  const existingPath = process.env.PATH || "";
  return [...paths, existingPath].join(":");
}

/**
 * Check health of a stdio-based MCP server
 * Attempts to spawn the process and checks if it starts without errors
 */
async function checkStdioHealth(
  name: string,
  config: MCPServerConfig
): Promise<MCPHealthResult> {
  return new Promise((resolve) => {
    const { spawn } = require("child_process");
    const startTime = Date.now();

    if (!config.command) {
      resolve({
        status: "unhealthy",
        message: "명령어가 설정되지 않음",
        lastChecked: Date.now(),
      });
      return;
    }

    // Prepare environment with extended PATH
    const env = {
      ...process.env,
      PATH: getExtendedPath(),
      ...(config.env || {}),
    };

    let killed = false;
    let stdout = "";
    let stderr = "";

    try {
      const proc = spawn(config.command, config.args || [], {
        env,
        shell: true,
        timeout: STDIO_TIMEOUT,
      });

      // Set timeout to kill process
      const timeout = setTimeout(() => {
        if (!killed) {
          killed = true;
          proc.kill("SIGTERM");
          // If process didn't crash within timeout, it's likely healthy
          resolve({
            status: "healthy",
            message: "프로세스 시작 성공",
            lastChecked: Date.now(),
            responseTime: Date.now() - startTime,
          });
        }
      }, STDIO_TIMEOUT);

      proc.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("error", (error: Error) => {
        clearTimeout(timeout);
        if (!killed) {
          killed = true;
          resolve({
            status: "unhealthy",
            message: `실행 오류: ${error.message}`,
            lastChecked: Date.now(),
            responseTime: Date.now() - startTime,
          });
        }
      });

      proc.on("exit", (code: number | null) => {
        clearTimeout(timeout);
        if (!killed) {
          killed = true;
          // Exit code 0 or null (killed by us) means success
          // Some MCP servers exit immediately after starting without stdio input
          if (code === null || code === 0) {
            resolve({
              status: "healthy",
              message: "프로세스 정상",
              lastChecked: Date.now(),
              responseTime: Date.now() - startTime,
            });
          } else {
            // Check if it's a known acceptable exit
            // Some servers exit with code 1 when no input is provided
            const errorMsg = stderr.trim() || `종료 코드: ${code}`;
            resolve({
              status: "unhealthy",
              message: errorMsg.substring(0, 100),
              lastChecked: Date.now(),
              responseTime: Date.now() - startTime,
            });
          }
        }
      });
    } catch (error: unknown) {
      const err = error as Error;
      resolve({
        status: "unhealthy",
        message: `스폰 실패: ${err.message}`,
        lastChecked: Date.now(),
        responseTime: Date.now() - startTime,
      });
    }
  });
}

/**
 * Check health of an HTTP/SSE-based MCP server
 * Sends a HEAD request and checks response status
 */
async function checkHttpHealth(
  name: string,
  config: MCPServerConfig
): Promise<MCPHealthResult> {
  const startTime = Date.now();

  if (!config.url) {
    return {
      status: "unhealthy",
      message: "URL이 설정되지 않음",
      lastChecked: Date.now(),
    };
  }

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT);

    const headers: Record<string, string> = {
      ...(config.headers || {}),
    };

    const response = await fetch(config.url, {
      method: "HEAD",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;

    // 2xx, 401, 403 are considered healthy (server is responding)
    // 401/403 means auth required but server is up
    if (
      response.ok ||
      response.status === 401 ||
      response.status === 403
    ) {
      return {
        status: "healthy",
        message: response.ok ? "연결됨" : `인증 필요 (${response.status})`,
        lastChecked: Date.now(),
        responseTime,
      };
    }

    return {
      status: "unhealthy",
      message: `HTTP ${response.status}`,
      lastChecked: Date.now(),
      responseTime,
    };
  } catch (error: unknown) {
    const err = error as Error;
    let message = err.message;

    if (err.name === "AbortError") {
      message = "타임아웃";
    } else if (message.includes("ECONNREFUSED")) {
      message = "연결 거부됨";
    } else if (message.includes("ENOTFOUND")) {
      message = "호스트를 찾을 수 없음";
    } else if (message.includes("certificate")) {
      message = "SSL 인증서 오류";
    }

    return {
      status: "unhealthy",
      message,
      lastChecked: Date.now(),
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Check health of an MCP server
 */
export async function checkMCPServerHealth(
  name: string,
  config: MCPServerConfig
): Promise<MCPHealthResult> {
  // Check if disabled
  if (config.enabled === false) {
    return {
      status: "disabled",
      message: "비활성화됨",
      lastChecked: Date.now(),
    };
  }

  const transportType = config.type || "stdio";

  if (transportType === "sse" || transportType === "http") {
    return checkHttpHealth(name, config);
  }

  return checkStdioHealth(name, config);
}

/**
 * Check health of all MCP servers
 */
export async function checkAllMCPServersHealth(
  servers: Record<string, MCPServerConfig>
): Promise<Record<string, MCPHealthResult>> {
  const results: Record<string, MCPHealthResult> = {};
  const serverNames = Object.keys(servers);

  // Check all servers in parallel
  const checks = serverNames.map(async (name) => {
    const result = await checkMCPServerHealth(name, servers[name]);
    results[name] = result;
    healthCache.set(name, result);
  });

  await Promise.all(checks);

  return results;
}

/**
 * Get cached health result for a server
 */
export function getCachedHealth(name: string): MCPHealthResult | undefined {
  return healthCache.get(name);
}

/**
 * Clear cached health results
 */
export function clearHealthCache(): void {
  healthCache.clear();
}

/**
 * Get status icon for health status (emoji - deprecated, use getHealthStatusIconName)
 */
export function getHealthStatusIcon(status: MCPHealthStatus): string {
  switch (status) {
    case "healthy":
      return "✅";
    case "unhealthy":
      return "❌";
    case "disabled":
      return "⏸️";
    case "checking":
      return "🔄";
    default:
      return "❓";
  }
}

/**
 * Get Lucide icon name for health status
 */
export function getHealthStatusIconName(status: MCPHealthStatus): string {
  switch (status) {
    case "healthy":
      return "check-circle";
    case "unhealthy":
      return "x-circle";
    case "disabled":
      return "pause";
    case "checking":
      return "loader";
    default:
      return "help-circle";
  }
}

/**
 * Get display text for health status
 */
export function getHealthStatusText(status: MCPHealthStatus): string {
  switch (status) {
    case "healthy":
      return "연결됨";
    case "unhealthy":
      return "오류";
    case "disabled":
      return "비활성";
    case "checking":
      return "점검 중";
    default:
      return "알 수 없음";
  }
}
