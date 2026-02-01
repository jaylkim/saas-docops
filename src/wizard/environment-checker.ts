/**
 * Environment Checker & System Utilities
 *
 * 환경 점검, MCP 설정 관리, SSH 키 관리 유틸리티
 */

import { checkABICompatibility } from "../terminal/electron-bridge";
import {
  checkMCPServerHealth as checkHealth,
  checkAllMCPServersHealth as checkAllHealth,
  MCPHealthResult,
  MCPHealthStatus,
} from "../mcp/health-checker";

export interface CheckResult {
  status: "pass" | "warning" | "fail";
  name: string;
  version?: string;
  message: string;
  installCommand?: string;
}

export interface EnvironmentCheckResults {
  nodejs: CheckResult;
  git: CheckResult;
  claudeCode: CheckResult;
  nodePty: CheckResult;
}

export interface OAuthStatus {
  isLoggedIn: boolean;
  account?: string;
  message: string;
}

export interface MCPServerConfig {
  type: "stdio" | "http" | "sse"; // MCP transport type
  command?: string; // for stdio type
  args?: string[];
  env?: Record<string, string>;
  url?: string; // for http/sse type
  headers?: Record<string, string>; // for http/sse type
  enabled?: boolean; // 기본값 true (plugin-specific, not used by Claude Code)
}

export interface ClaudeSettings {
  mcpServers?: Record<string, MCPServerConfig>;
  [key: string]: unknown;
}

export interface SSHKeyInfo {
  exists: boolean;
  publicKeyPath?: string;
  publicKey?: string;
  message: string;
}

export interface ShellEnvVarInfo {
  found: boolean;
  value?: string;
  source?: string; // 발견된 파일 경로
  maskedValue?: string; // 마스킹된 값 (UI 표시용)
}

export type MCPConfigLevel = "user" | "project";

/**
 * Get extended PATH for command execution
 */
export function getExtendedPath(): string {
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
 * Execute a shell command
 */
export async function execCommand(
  command: string,
  options?: { timeout?: number; cwd?: string }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const { exec } = require("child_process");
    const env = { ...process.env, PATH: getExtendedPath() };

    exec(
      command,
      { timeout: options?.timeout || 15000, env, cwd: options?.cwd },
      (error: Error | null, stdout: string, stderr: string) => {
        resolve({
          stdout: stdout?.trim() || "",
          stderr: stderr?.trim() || "",
          exitCode: error ? 1 : 0,
        });
      }
    );
  });
}

/**
 * Parse version from string
 */
function parseVersion(output: string): string | null {
  const match = output.match(/v?(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

/**
 * Compare semver
 */
function isVersionAtLeast(version: string, minVersion: string): boolean {
  const v1 = version.split(".").map(Number);
  const v2 = minVersion.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    if ((v1[i] || 0) > (v2[i] || 0)) return true;
    if ((v1[i] || 0) < (v2[i] || 0)) return false;
  }
  return true;
}

export class EnvironmentChecker {
  private configLevel: MCPConfigLevel = "user";
  private vaultPath: string | null = null;

  /**
   * Set MCP configuration level
   * @param level "user" for ~/.claude.json, "project" for vault/.claude/settings.json
   * @param vaultPath Required when level is "project"
   */
  setConfigLevel(level: MCPConfigLevel, vaultPath?: string): void {
    this.configLevel = level;
    if (vaultPath) {
      this.vaultPath = vaultPath;
    }
  }

  /**
   * Get current MCP configuration level
   */
  getConfigLevel(): MCPConfigLevel {
    return this.configLevel;
  }

  /**
   * Check Node.js
   */
  async checkNodeJs(): Promise<CheckResult> {
    const result = await execCommand("node --version");

    if (result.exitCode !== 0) {
      const platform = process.platform;
      return {
        status: "fail",
        name: "Node.js",
        message: "Node.js가 설치되어 있지 않습니다",
        installCommand: platform === "darwin" ? "brew install node" : "sudo apt install nodejs npm",
      };
    }

    const version = parseVersion(result.stdout);
    if (!version) {
      return {
        status: "warning",
        name: "Node.js",
        version: result.stdout,
        message: "버전 확인 불가",
      };
    }

    if (!isVersionAtLeast(version, "18.0.0")) {
      return {
        status: "warning",
        name: "Node.js",
        version,
        message: `Node.js 18 이상 권장`,
        installCommand: "brew upgrade node",
      };
    }

    return {
      status: "pass",
      name: "Node.js",
      version,
      message: "설치됨",
    };
  }

  /**
   * Check Git
   */
  async checkGit(): Promise<CheckResult> {
    const result = await execCommand("git --version");

    if (result.exitCode !== 0) {
      const platform = process.platform;
      return {
        status: "fail",
        name: "Git",
        message: "Git이 설치되어 있지 않습니다",
        installCommand: platform === "darwin" ? "xcode-select --install" : "sudo apt install git",
      };
    }

    const version = parseVersion(result.stdout);
    return {
      status: "pass",
      name: "Git",
      version: version || "installed",
      message: "설치됨",
    };
  }

  /**
   * Check Claude Code CLI
   */
  async checkClaudeCode(): Promise<CheckResult> {
    const result = await execCommand("claude --version");

    if (result.exitCode !== 0) {
      return {
        status: "fail",
        name: "Claude Code",
        message: "Claude Code가 설치되어 있지 않습니다",
        installCommand: "npm install -g @anthropic-ai/claude-code",
      };
    }

    const version = parseVersion(result.stdout) || result.stdout;
    return {
      status: "pass",
      name: "Claude Code",
      version,
      message: "설치됨",
    };
  }

  /**
   * Check node-pty
   */
  async checkNodePty(): Promise<CheckResult> {
    const abiResult = checkABICompatibility();

    if (abiResult.compatible) {
      return {
        status: "pass",
        name: "터미널 엔진",
        message: "정상",
      };
    }

    return {
      status: "fail",
      name: "터미널 엔진",
      message: abiResult.message,
    };
  }

  /**
   * Check OAuth status
   */
  async checkOAuthStatus(): Promise<OAuthStatus> {
    const result = await execCommand("claude auth status");
    const output = result.stdout + result.stderr;

    if (output.toLowerCase().includes("logged in") || output.toLowerCase().includes("authenticated")) {
      const accountMatch = output.match(/([^\s]+@[^\s]+)/);
      return {
        isLoggedIn: true,
        account: accountMatch?.[1],
        message: "로그인됨",
      };
    }

    return {
      isLoggedIn: false,
      message: "로그인되지 않음",
    };
  }

  /**
   * Run all checks
   */
  async checkAll(): Promise<EnvironmentCheckResults> {
    const [nodejs, git, claudeCode, nodePty] = await Promise.all([
      this.checkNodeJs(),
      this.checkGit(),
      this.checkClaudeCode(),
      this.checkNodePty(),
    ]);

    return { nodejs, git, claudeCode, nodePty };
  }

  /**
   * Get Claude MCP settings file path based on configuration level
   *
   * User level: ~/.claude.json (applies to all projects)
   * Project level: vault/.mcp.json (project-specific, shared via git)
   *
   * Note: Project-level MCP uses .mcp.json, NOT .claude/settings.json
   * See: https://code.claude.com/docs/en/settings
   */
  getClaudeSettingsPath(): string {
    const os = require("os");
    const path = require("path");

    if (this.configLevel === "project" && this.vaultPath) {
      // Project level: vault/.mcp.json
      return path.join(this.vaultPath, ".mcp.json");
    }

    // User level: ~/.claude.json
    return path.join(os.homedir(), ".claude.json");
  }

  /**
   * Get the display name for current configuration level
   */
  getConfigLevelDisplayName(): string {
    if (this.configLevel === "project") {
      return `프로젝트 (${this.vaultPath}/.mcp.json)`;
    }
    const os = require("os");
    return `사용자 (${os.homedir()}/.claude.json)`;
  }

  /**
   * Read Claude settings from ~/.claude.json
   */
  async readClaudeSettings(): Promise<ClaudeSettings> {
    const fs = require("fs");
    const filePath = this.getClaudeSettingsPath();

    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(content);
      }
    } catch (e) {
      console.error("[EnvironmentChecker] Failed to read settings:", e);
    }

    return { mcpServers: {} };
  }

  /**
   * Write Claude settings to ~/.claude.json
   * Preserves existing settings and only updates mcpServers
   */
  async writeClaudeSettings(settings: ClaudeSettings): Promise<boolean> {
    const fs = require("fs");
    const filePath = this.getClaudeSettingsPath();

    try {
      // Read existing settings to preserve other fields
      let existingSettings: Record<string, unknown> = {};
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        existingSettings = JSON.parse(content);
      }

      // Merge mcpServers into existing settings
      const mergedSettings = {
        ...existingSettings,
        mcpServers: settings.mcpServers,
      };

      fs.writeFileSync(filePath, JSON.stringify(mergedSettings, null, 2), "utf-8");
      return true;
    } catch (e) {
      console.error("[EnvironmentChecker] Failed to write settings:", e);
      return false;
    }
  }

  /**
   * Add MCP server to settings
   */
  async addMCPServer(name: string, config: MCPServerConfig): Promise<boolean> {
    const settings = await this.readClaudeSettings();

    if (!settings.mcpServers) {
      settings.mcpServers = {};
    }

    settings.mcpServers[name] = config;
    return this.writeClaudeSettings(settings);
  }

  /**
   * Check if MCP server exists
   */
  async hasMCPServer(name: string): Promise<boolean> {
    const settings = await this.readClaudeSettings();
    return !!(settings.mcpServers && settings.mcpServers[name]);
  }

  /**
   * Get all MCP servers
   */
  async getAllMCPServers(): Promise<Record<string, MCPServerConfig>> {
    const settings = await this.readClaudeSettings();
    return settings.mcpServers || {};
  }

  /**
   * Remove MCP server from settings
   */
  async removeMCPServer(name: string): Promise<boolean> {
    const settings = await this.readClaudeSettings();

    if (!settings.mcpServers || !settings.mcpServers[name]) {
      return false;
    }

    delete settings.mcpServers[name];
    return this.writeClaudeSettings(settings);
  }

  /**
   * Toggle MCP server enabled state
   */
  async toggleMCPServer(name: string, enabled: boolean): Promise<boolean> {
    const settings = await this.readClaudeSettings();

    if (!settings.mcpServers || !settings.mcpServers[name]) {
      return false;
    }

    settings.mcpServers[name].enabled = enabled;
    return this.writeClaudeSettings(settings);
  }

  /**
   * Get SSH key info
   */
  async getSSHKeyInfo(): Promise<SSHKeyInfo> {
    const fs = require("fs");
    const path = require("path");
    const os = require("os");

    const sshDir = path.join(os.homedir(), ".ssh");
    const privateKeyPath = path.join(sshDir, "id_ed25519");
    const publicKeyPath = path.join(sshDir, "id_ed25519.pub");

    // Also check for RSA keys
    const rsaPrivatePath = path.join(sshDir, "id_rsa");
    const rsaPublicPath = path.join(sshDir, "id_rsa.pub");

    try {
      // Prefer ed25519
      if (fs.existsSync(publicKeyPath)) {
        const publicKey = fs.readFileSync(publicKeyPath, "utf-8").trim();
        return {
          exists: true,
          publicKeyPath,
          publicKey,
          message: "ED25519 키 존재",
        };
      }

      // Fallback to RSA
      if (fs.existsSync(rsaPublicPath)) {
        const publicKey = fs.readFileSync(rsaPublicPath, "utf-8").trim();
        return {
          exists: true,
          publicKeyPath: rsaPublicPath,
          publicKey,
          message: "RSA 키 존재",
        };
      }

      return {
        exists: false,
        message: "SSH 키가 없습니다",
      };
    } catch (e) {
      return {
        exists: false,
        message: "SSH 키 확인 실패",
      };
    }
  }

  /**
   * Get shell config file paths to check
   */
  getShellConfigPaths(): string[] {
    const os = require("os");
    const path = require("path");
    const homeDir = os.homedir();

    // 우선순위: zsh -> bash
    return [
      path.join(homeDir, ".zshrc"),
      path.join(homeDir, ".zshenv"),
      path.join(homeDir, ".bash_profile"),
      path.join(homeDir, ".bashrc"),
      path.join(homeDir, ".profile"),
    ];
  }

  /**
   * Get the preferred shell config file for writing
   */
  getPreferredShellConfigPath(): string {
    const os = require("os");
    const path = require("path");
    const fs = require("fs");
    const homeDir = os.homedir();

    // Check current shell
    const shell = process.env.SHELL || "/bin/bash";

    if (shell.includes("zsh")) {
      return path.join(homeDir, ".zshrc");
    } else {
      // For bash, prefer .bash_profile on macOS, .bashrc on Linux
      const bashProfile = path.join(homeDir, ".bash_profile");
      if (process.platform === "darwin" || fs.existsSync(bashProfile)) {
        return bashProfile;
      }
      return path.join(homeDir, ".bashrc");
    }
  }

  /**
   * Find environment variable in shell config files
   */
  async findShellEnvVar(varName: string): Promise<ShellEnvVarInfo> {
    const fs = require("fs");
    const configPaths = this.getShellConfigPaths();

    // export VAR_NAME= 또는 export VAR_NAME=" 패턴 검색
    const patterns = [
      new RegExp(`^\\s*export\\s+${varName}=["']?([^"'\\n]+)["']?`, "m"),
      new RegExp(`^\\s*export\\s+${varName}="([^"]*)"`, "m"),
      new RegExp(`^\\s*export\\s+${varName}='([^']*)'`, "m"),
    ];

    for (const configPath of configPaths) {
      try {
        if (!fs.existsSync(configPath)) continue;

        const content = fs.readFileSync(configPath, "utf-8");

        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match && match[1]) {
            const value = match[1].trim();
            return {
              found: true,
              value,
              source: configPath,
              maskedValue: this.maskValue(value),
            };
          }
        }
      } catch (e) {
        console.error(`[EnvironmentChecker] Failed to read ${configPath}:`, e);
      }
    }

    return { found: false };
  }

  /**
   * Save environment variable to shell config file
   */
  async saveShellEnvVar(varName: string, value: string): Promise<{ success: boolean; path?: string; error?: string }> {
    const fs = require("fs");
    const configPath = this.getPreferredShellConfigPath();

    try {
      let content = "";

      // Read existing content if file exists
      if (fs.existsSync(configPath)) {
        content = fs.readFileSync(configPath, "utf-8");

        // Check if variable already exists and update it
        const patterns = [
          new RegExp(`^(\\s*export\\s+${varName}=).*$`, "gm"),
        ];

        let found = false;
        for (const pattern of patterns) {
          if (pattern.test(content)) {
            content = content.replace(pattern, `export ${varName}="${value}"`);
            found = true;
            break;
          }
        }

        if (!found) {
          // Append new export line
          if (!content.endsWith("\n")) {
            content += "\n";
          }
          content += `\n# Added by SaaS DocOps\nexport ${varName}="${value}"\n`;
        }
      } else {
        // Create new file
        content = `# Shell configuration\n\n# Added by SaaS DocOps\nexport ${varName}="${value}"\n`;
      }

      fs.writeFileSync(configPath, content, "utf-8");

      return {
        success: true,
        path: configPath,
      };
    } catch (e) {
      console.error(`[EnvironmentChecker] Failed to save to ${configPath}:`, e);
      return {
        success: false,
        error: `${configPath} 저장 실패`,
      };
    }
  }

  /**
   * Check Anthropic API key availability
   * Searches in shell config files where Claude Code would find it
   */
  async checkAnthropicApiKey(): Promise<ShellEnvVarInfo> {
    return this.findShellEnvVar("ANTHROPIC_API_KEY");
  }

  /**
   * Save Anthropic API key to shell config
   */
  async saveAnthropicApiKey(apiKey: string): Promise<{ success: boolean; path?: string; error?: string }> {
    return this.saveShellEnvVar("ANTHROPIC_API_KEY", apiKey);
  }

  /**
   * Mask sensitive value for display
   */
  private maskValue(value: string): string {
    if (value.length <= 8) {
      return "••••••••";
    }
    const prefix = value.substring(0, 7);
    const suffix = value.substring(value.length - 4);
    return `${prefix}••••${suffix}`;
  }

  /**
   * Check health of a single MCP server
   */
  async checkMCPServerHealth(name: string): Promise<MCPHealthResult> {
    const servers = await this.getAllMCPServers();
    const config = servers[name];

    if (!config) {
      return {
        status: "unhealthy",
        message: "서버가 존재하지 않음",
        lastChecked: Date.now(),
      };
    }

    return checkHealth(name, config);
  }

  /**
   * Check health of all MCP servers
   */
  async checkAllMCPServersHealth(): Promise<Record<string, MCPHealthResult>> {
    const servers = await this.getAllMCPServers();
    return checkAllHealth(servers);
  }

  /**
   * Generate SSH key
   */
  async generateSSHKey(email: string): Promise<{ success: boolean; publicKey?: string; error?: string }> {
    const fs = require("fs");
    const path = require("path");
    const os = require("os");

    const sshDir = path.join(os.homedir(), ".ssh");
    const keyPath = path.join(sshDir, "id_ed25519");

    // Create .ssh directory if needed
    if (!fs.existsSync(sshDir)) {
      fs.mkdirSync(sshDir, { mode: 0o700 });
    }

    // Generate key
    const result = await execCommand(
      `ssh-keygen -t ed25519 -C "${email}" -f "${keyPath}" -N ""`,
      { timeout: 30000 }
    );

    if (result.exitCode !== 0) {
      return {
        success: false,
        error: result.stderr || "SSH 키 생성 실패",
      };
    }

    // Read the public key
    try {
      const publicKey = fs.readFileSync(`${keyPath}.pub`, "utf-8").trim();
      return {
        success: true,
        publicKey,
      };
    } catch (e) {
      return {
        success: false,
        error: "공개 키 읽기 실패",
      };
    }
  }
}
