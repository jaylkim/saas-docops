/**
 * PTY Manager
 *
 * Manages PTY process lifecycle:
 * - Create/destroy PTY instances
 * - Handle input/output
 * - Resize terminal
 * - Graceful cleanup
 */

import type { PTYOptions, PTYEventHandlers, IDisposable } from "../types";
import {
  getNodePty,
  getDefaultShell,
  getShellArgs,
  type IPty,
} from "./electron-bridge";

interface ManagedPTY {
  pty: IPty;
  disposables: IDisposable[];
  shell: string;
  cwd: string;
  createdAt: number;
}

/**
 * PTYManager - Singleton for managing PTY instances
 */
export class PTYManager {
  private static instance: PTYManager;
  private ptyMap: Map<string, ManagedPTY> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): PTYManager {
    if (!PTYManager.instance) {
      PTYManager.instance = new PTYManager();
    }
    return PTYManager.instance;
  }

  /**
   * Create a new PTY instance
   */
  createPTY(
    id: string,
    options: PTYOptions,
    handlers: PTYEventHandlers
  ): IPty | null {
    // Check if PTY already exists
    if (this.ptyMap.has(id)) {
      console.warn(`[PTYManager] PTY ${id} already exists, destroying first`);
      this.destroyPTY(id);
    }

    const nodePty = getNodePty();
    if (!nodePty) {
      console.error("[PTYManager] node-pty not available");
      return null;
    }

    // Determine shell
    const shell = options.shell || getDefaultShell();
    const args = getShellArgs(shell);

    // Default terminal size
    const cols = options.cols || 80;
    const rows = options.rows || 24;

    // Working directory
    const cwd = options.cwd || process.cwd();

    // Environment variables
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      ...options.env,
      LANG: process.env.LANG || "en_US.UTF-8",
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
    };

    try {
      const pty = nodePty.spawn(shell, args, {
        name: "xterm-256color",
        cols,
        rows,
        cwd,
        env,
        useConpty: process.platform === "win32",
      });

      const disposables: IDisposable[] = [];

      // Set up event handlers
      if (handlers.onData) {
        const dataDisposable = pty.onData(handlers.onData);
        disposables.push(dataDisposable);
      }

      if (handlers.onExit) {
        const exitDisposable = pty.onExit((e) => {
          handlers.onExit?.(e.exitCode, e.signal);
          // Auto-cleanup on exit
          this.ptyMap.delete(id);
        });
        disposables.push(exitDisposable);
      }

      // Store managed PTY
      this.ptyMap.set(id, {
        pty,
        disposables,
        shell,
        cwd,
        createdAt: Date.now(),
      });

      console.log(`[PTYManager] Created PTY ${id} (PID: ${pty.pid})`);
      return pty;
    } catch (error) {
      console.error(`[PTYManager] Failed to create PTY ${id}:`, error);
      return null;
    }
  }

  /**
   * Destroy a PTY instance
   */
  destroyPTY(id: string): boolean {
    const managed = this.ptyMap.get(id);
    if (!managed) {
      return false;
    }

    try {
      // Dispose event handlers
      for (const disposable of managed.disposables) {
        disposable.dispose();
      }

      // Kill the PTY process
      managed.pty.kill();

      // Remove from map
      this.ptyMap.delete(id);

      console.log(`[PTYManager] Destroyed PTY ${id}`);
      return true;
    } catch (error) {
      console.error(`[PTYManager] Error destroying PTY ${id}:`, error);
      this.ptyMap.delete(id);
      return false;
    }
  }

  /**
   * Write data to a PTY
   */
  write(id: string, data: string): boolean {
    const managed = this.ptyMap.get(id);
    if (!managed) {
      console.warn(`[PTYManager] PTY ${id} not found for write`);
      return false;
    }

    try {
      managed.pty.write(data);
      return true;
    } catch (error) {
      console.error(`[PTYManager] Error writing to PTY ${id}:`, error);
      return false;
    }
  }

  /**
   * Resize a PTY
   */
  resize(id: string, cols: number, rows: number): boolean {
    const managed = this.ptyMap.get(id);
    if (!managed) {
      console.warn(`[PTYManager] PTY ${id} not found for resize`);
      return false;
    }

    try {
      managed.pty.resize(cols, rows);
      return true;
    } catch (error) {
      console.error(`[PTYManager] Error resizing PTY ${id}:`, error);
      return false;
    }
  }

  /**
   * Get PTY info
   */
  getPTYInfo(id: string): { pid: number; shell: string; cwd: string } | null {
    const managed = this.ptyMap.get(id);
    if (!managed) {
      return null;
    }

    return {
      pid: managed.pty.pid,
      shell: managed.shell,
      cwd: managed.cwd,
    };
  }

  /**
   * Check if PTY exists
   */
  hasPTY(id: string): boolean {
    return this.ptyMap.has(id);
  }

  /**
   * Get all PTY IDs
   */
  getAllPTYIds(): string[] {
    return Array.from(this.ptyMap.keys());
  }

  /**
   * Destroy all PTY instances
   */
  destroyAll(): void {
    for (const id of this.ptyMap.keys()) {
      this.destroyPTY(id);
    }
  }
}
