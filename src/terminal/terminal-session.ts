/**
 * Terminal Session Manager
 *
 * Manages terminal sessions:
 * - Session ID generation
 * - Session Map management
 * - Active session tracking
 */

import type { TerminalSession } from "../types";

/**
 * SessionManager - Singleton for managing terminal sessions
 */
export class SessionManager {
  private static instance: SessionManager;
  private sessions: Map<string, TerminalSession> = new Map();
  private counter = 0;
  private activeSessionId: string | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Generate a unique session ID
   */
  generateId(): string {
    this.counter++;
    return `terminal-${Date.now()}-${this.counter}`;
  }

  /**
   * Create a new session
   */
  createSession(
    id: string,
    pid: number,
    cwd: string,
    shell: string
  ): TerminalSession {
    const session: TerminalSession = {
      id,
      pid,
      cwd,
      shell,
      isActive: true,
      createdAt: Date.now(),
    };

    this.sessions.set(id, session);
    this.activeSessionId = id;

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(id: string): TerminalSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * Get the active session
   */
  getActiveSession(): TerminalSession | undefined {
    if (!this.activeSessionId) {
      return undefined;
    }
    return this.sessions.get(this.activeSessionId);
  }

  /**
   * Set the active session
   */
  setActiveSession(id: string): boolean {
    if (!this.sessions.has(id)) {
      return false;
    }
    this.activeSessionId = id;
    return true;
  }

  /**
   * Mark a session as inactive
   */
  deactivateSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) {
      return false;
    }

    session.isActive = false;

    if (this.activeSessionId === id) {
      this.activeSessionId = null;
    }

    return true;
  }

  /**
   * Remove a session
   */
  removeSession(id: string): boolean {
    if (!this.sessions.has(id)) {
      return false;
    }

    this.sessions.delete(id);

    if (this.activeSessionId === id) {
      this.activeSessionId = null;
    }

    return true;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): TerminalSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.isActive);
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Clear all sessions
   */
  clearAll(): void {
    this.sessions.clear();
    this.activeSessionId = null;
  }
}
