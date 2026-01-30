/**
 * Electron Bridge for node-pty
 *
 * Obsidian runs on Electron, so we need to load node-pty through
 * Electron's native module system. This module handles:
 * - Loading node-pty via @electron/remote
 * - ABI compatibility checking
 * - Platform-specific shell detection
 */

import type { ABICheckResult } from "../types";

// node-pty types (minimal interface)
export interface IPty {
  pid: number;
  cols: number;
  rows: number;
  process: string;
  onData: (callback: (data: string) => void) => { dispose: () => void };
  onExit: (
    callback: (e: { exitCode: number; signal?: number }) => void
  ) => { dispose: () => void };
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
}

export interface IPtyForkOptions {
  name?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: Record<string, string>;
  useConpty?: boolean;
}

export interface INodePty {
  spawn(
    file: string,
    args: string[],
    options: IPtyForkOptions
  ): IPty;
}

let nodePtyModule: INodePty | null = null;
let pluginPath: string | null = null;

/**
 * Initialize the electron bridge with the plugin's base path
 * Must be called before using getNodePty()
 */
export function initElectronBridge(basePath: string): void {
  pluginPath = basePath;
  console.log("[ElectronBridge] Initialized with path:", basePath);
}

/**
 * Get node-pty module
 * Loads via require() with absolute path to plugin's node_modules
 */
export function getNodePty(): INodePty | null {
  if (nodePtyModule) {
    return nodePtyModule;
  }

  try {
    // Try loading from plugin's node_modules first
    if (pluginPath) {
      const path = require("path");
      const nodePtyPath = path.join(pluginPath, "node_modules", "node-pty");
      console.log("[ElectronBridge] Loading node-pty from:", nodePtyPath);
      nodePtyModule = require(nodePtyPath) as INodePty;
      return nodePtyModule;
    }

    // Fallback to standard require
    nodePtyModule = require("node-pty") as INodePty;
    return nodePtyModule;
  } catch (error) {
    console.error("[ElectronBridge] Failed to load node-pty:", error);
    return null;
  }
}

/**
 * Check ABI compatibility
 * node-pty must be compiled for the same Electron ABI version
 */
export function checkABICompatibility(): ABICheckResult {
  const electronABI = process.versions.modules || "unknown";
  const nodeABI = process.versions.node || "unknown";

  try {
    const pty = getNodePty();
    if (pty) {
      return {
        compatible: true,
        electronABI,
        nodeABI,
        message: "node-pty loaded successfully",
      };
    } else {
      return {
        compatible: false,
        electronABI,
        nodeABI,
        message: "node-pty failed to load - run 'npm run rebuild:electron'",
      };
    }
  } catch (error) {
    return {
      compatible: false,
      electronABI,
      nodeABI,
      message: `ABI mismatch: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Get default shell for the current platform
 */
export function getDefaultShell(): string {
  const platform = process.platform;

  if (platform === "win32") {
    // Windows: prefer PowerShell, fallback to cmd
    return process.env.COMSPEC || "C:\\Windows\\System32\\cmd.exe";
  }

  // macOS/Linux: use SHELL env var or fallback to common shells
  if (process.env.SHELL) {
    return process.env.SHELL;
  }

  // Common fallbacks
  if (platform === "darwin") {
    return "/bin/zsh"; // macOS default since Catalina
  }

  return "/bin/bash"; // Linux default
}

/**
 * Validate shell path exists
 */
export async function validateShell(shellPath: string): Promise<boolean> {
  try {
    // Use Node's fs module to check if shell exists
    const fs = require("fs");
    return fs.existsSync(shellPath);
  } catch {
    return false;
  }
}

/**
 * Get shell arguments for different shells
 */
export function getShellArgs(shell: string): string[] {
  const basename = shell.split(/[/\\]/).pop()?.toLowerCase() || "";

  switch (basename) {
    case "bash":
    case "zsh":
    case "fish":
    case "sh":
      // Login shell for proper environment
      return ["-l"];
    case "powershell.exe":
    case "pwsh.exe":
    case "pwsh":
      return ["-NoLogo"];
    case "cmd.exe":
      return [];
    default:
      return [];
  }
}
