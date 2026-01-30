/**
 * Mention Resolver
 *
 * Resolves note mentions to their content.
 * Handles truncation and error cases.
 */

import type { Vault } from "obsidian";
import type { ResolvedMention } from "../../types";
import { NoteSearcher } from "./note-searcher";
import { findMentions } from "./mention-parser";

const MAX_CONTENT_LENGTH = 10000;

export class MentionResolver {
  private vault: Vault;
  private searcher: NoteSearcher;

  constructor(vault: Vault) {
    this.vault = vault;
    this.searcher = new NoteSearcher(vault);
  }

  /**
   * Resolve a single mention to its content
   */
  async resolve(noteName: string): Promise<ResolvedMention> {
    const file = this.searcher.findByName(noteName);

    if (!file) {
      return {
        noteName,
        path: "",
        content: "",
        truncated: false,
        error: `Note not found: ${noteName}`,
      };
    }

    try {
      let content = await this.vault.cachedRead(file);
      let truncated = false;

      if (content.length > MAX_CONTENT_LENGTH) {
        content = content.slice(0, MAX_CONTENT_LENGTH) + "\n\n... [truncated]";
        truncated = true;
      }

      return {
        noteName,
        path: file.path,
        content,
        truncated,
      };
    } catch (err) {
      return {
        noteName,
        path: file.path,
        content: "",
        truncated: false,
        error: `Failed to read: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Resolve multiple mentions
   */
  async resolveMultiple(noteNames: string[]): Promise<ResolvedMention[]> {
    return Promise.all(noteNames.map((name) => this.resolve(name)));
  }

  /**
   * Parse input text and resolve all mentions
   */
  async resolveFromText(text: string): Promise<{
    resolvedMentions: ResolvedMention[];
    contextPrefix: string;
  }> {
    const mentions = findMentions(text);
    const noteNames = mentions.map((m) => m.query);

    if (noteNames.length === 0) {
      return { resolvedMentions: [], contextPrefix: "" };
    }

    const resolved = await this.resolveMultiple(noteNames);
    const contextPrefix = this.formatContext(resolved);

    return { resolvedMentions: resolved, contextPrefix };
  }

  /**
   * Format resolved mentions as context for Claude
   */
  formatContext(mentions: ResolvedMention[]): string {
    const validMentions = mentions.filter((m) => !m.error && m.content);

    if (validMentions.length === 0) {
      return "";
    }

    let context = "Context from referenced notes:\n\n";

    for (const mention of validMentions) {
      context += `## ${mention.path}\n`;
      context += "```\n";
      context += mention.content;
      context += "\n```\n\n";
    }

    context += "---\n\n";

    return context;
  }

  /**
   * Clear internal caches
   */
  clearCache(): void {
    this.searcher.clearCache();
  }
}
