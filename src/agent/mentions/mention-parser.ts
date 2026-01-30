/**
 * Mention Parser
 *
 * Parses @notename mentions from text input.
 * Supports both @notename and @[[notename]] syntax.
 */

import type { MentionMatch } from "../../types";

// Match @word or @[[text with spaces]]
const MENTION_REGEX = /@(\[\[([^\]]+)\]\]|[\w가-힣-]+)/g;

/**
 * Find all mentions in text
 */
export function findMentions(text: string): MentionMatch[] {
  const matches: MentionMatch[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const fullMatch = match[0];
    const query = match[2] || match[1]; // Prefer [[...]] content, fallback to plain

    matches.push({
      query,
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
      isComplete: true,
    });
  }

  return matches;
}

/**
 * Get the mention being typed at cursor position (for autocomplete)
 */
export function getMentionAtCursor(
  text: string,
  cursorPos: number
): MentionMatch | null {
  // Find @ before cursor
  const textBeforeCursor = text.slice(0, cursorPos);
  const lastAtIndex = textBeforeCursor.lastIndexOf("@");

  if (lastAtIndex === -1) return null;

  // Check if we're still in a mention (no space/newline after @)
  const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);

  // If there's a space or newline, mention is complete
  if (/[\s\n]/.test(textAfterAt)) return null;

  // Check for [[...]] syntax
  if (textAfterAt.startsWith("[[")) {
    // Incomplete [[...]] mention
    const query = textAfterAt.slice(2); // Remove [[
    return {
      query,
      startIndex: lastAtIndex,
      endIndex: cursorPos,
      isComplete: false,
    };
  }

  // Plain @mention
  return {
    query: textAfterAt,
    startIndex: lastAtIndex,
    endIndex: cursorPos,
    isComplete: false,
  };
}

/**
 * Replace a mention with the full note name
 */
export function replaceMention(
  text: string,
  match: MentionMatch,
  noteName: string
): string {
  const before = text.slice(0, match.startIndex);
  const after = text.slice(match.endIndex);

  // Use [[...]] syntax for names with spaces, plain @name otherwise
  const replacement = noteName.includes(" ")
    ? `@[[${noteName}]] `
    : `@${noteName} `;

  return before + replacement + after;
}

/**
 * Extract just the note names from mentions (for display)
 */
export function extractMentionNames(text: string): string[] {
  return findMentions(text).map((m) => m.query);
}
