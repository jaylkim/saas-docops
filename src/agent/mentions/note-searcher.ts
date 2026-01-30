/**
 * Note Searcher
 *
 * Searches vault for notes matching a query.
 * Uses fuzzy matching with scoring.
 */

import type { Vault, TFile } from "obsidian";
import type { NoteSearchResult } from "../../types";

const MAX_RESULTS = 10;

export class NoteSearcher {
  private vault: Vault;
  private cachedFiles: TFile[] | null = null;

  constructor(vault: Vault) {
    this.vault = vault;
  }

  /**
   * Search for notes matching query
   */
  search(query: string, limit: number = MAX_RESULTS): NoteSearchResult[] {
    if (!query) return [];

    const files = this.getFiles();
    const lowerQuery = query.toLowerCase();

    const results: NoteSearchResult[] = [];

    for (const file of files) {
      const name = file.basename;
      const lowerName = name.toLowerCase();

      let score = 0;

      // Exact match
      if (lowerName === lowerQuery) {
        score = 100;
      }
      // Starts with query
      else if (lowerName.startsWith(lowerQuery)) {
        score = 80;
      }
      // Contains query
      else if (lowerName.includes(lowerQuery)) {
        score = 60;
      }
      // Fuzzy: all chars in order
      else if (this.fuzzyMatch(lowerQuery, lowerName)) {
        score = 40;
      }

      if (score > 0) {
        results.push({
          path: file.path,
          name: file.basename,
          folder: file.parent?.path || "",
          score,
        });
      }
    }

    // Sort by score descending, then alphabetically
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name);
    });

    return results.slice(0, limit);
  }

  /**
   * Simple fuzzy match - all chars of query appear in order in target
   */
  private fuzzyMatch(query: string, target: string): boolean {
    let queryIdx = 0;
    for (let i = 0; i < target.length && queryIdx < query.length; i++) {
      if (target[i] === query[queryIdx]) {
        queryIdx++;
      }
    }
    return queryIdx === query.length;
  }

  /**
   * Get cached markdown files
   */
  private getFiles(): TFile[] {
    if (!this.cachedFiles) {
      this.cachedFiles = this.vault.getMarkdownFiles();
    }
    return this.cachedFiles;
  }

  /**
   * Clear cache (call when vault changes)
   */
  clearCache(): void {
    this.cachedFiles = null;
  }

  /**
   * Find a specific note by name
   */
  findByName(name: string): TFile | null {
    const files = this.getFiles();
    const lowerName = name.toLowerCase();

    // Exact basename match
    let found = files.find((f) => f.basename.toLowerCase() === lowerName);
    if (found) return found;

    // Match with path
    found = files.find((f) => f.path.toLowerCase() === lowerName);
    if (found) return found;

    // Match with .md extension
    if (!lowerName.endsWith(".md")) {
      found = files.find(
        (f) => f.path.toLowerCase() === lowerName + ".md"
      );
      if (found) return found;
    }

    return null;
  }
}
