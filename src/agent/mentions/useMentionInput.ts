/**
 * useMentionInput Hook
 *
 * Orchestrates @mention autocomplete for text input.
 * Handles keyboard navigation, debounced search, text replacement.
 */

import * as React from "react";
import type { Vault } from "obsidian";
import type { NoteSearchResult, MentionMatch } from "../../types";
import { getMentionAtCursor, replaceMention } from "./mention-parser";
import { NoteSearcher } from "./note-searcher";

const DEBOUNCE_MS = 150;

interface MentionInputState {
  showAutocomplete: boolean;
  results: NoteSearchResult[];
  selectedIndex: number;
  position: { top: number; left: number };
  activeMention: MentionMatch | null;
}

const INITIAL_STATE: MentionInputState = {
  showAutocomplete: false,
  results: [],
  selectedIndex: 0,
  position: { top: 0, left: 0 },
  activeMention: null,
};

interface UseMentionInputReturn {
  state: MentionInputState;
  handleInputChange: (
    value: string,
    cursorPos: number,
    inputEl: HTMLTextAreaElement
  ) => void;
  handleKeyDown: (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    currentValue: string,
    setValue: (value: string) => void
  ) => boolean; // Returns true if event was handled
  handleSelect: (
    result: NoteSearchResult,
    currentValue: string,
    setValue: (value: string) => void
  ) => void;
  handleCancel: () => void;
}

export function useMentionInput(vault: Vault): UseMentionInputReturn {
  const searcherRef = React.useRef<NoteSearcher | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = React.useState<MentionInputState>(INITIAL_STATE);

  // Track mounted state to prevent state updates after unmount
  const isMountedRef = React.useRef(true);

  // Initialize searcher and cleanup
  React.useEffect(() => {
    isMountedRef.current = true;
    searcherRef.current = new NoteSearcher(vault);

    return () => {
      isMountedRef.current = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      searcherRef.current = null;
    };
  }, [vault]);

  // Calculate dropdown position from cursor in textarea
  const calculatePosition = (
    inputEl: HTMLTextAreaElement,
    cursorPos: number
  ): { top: number; left: number } => {
    // Create a mirror div to measure cursor position
    const mirror = document.createElement("div");
    const style = window.getComputedStyle(inputEl);

    mirror.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: ${style.fontFamily};
      font-size: ${style.fontSize};
      line-height: ${style.lineHeight};
      padding: ${style.padding};
      width: ${inputEl.clientWidth}px;
    `;

    const textBeforeCursor = inputEl.value.slice(0, cursorPos);
    mirror.textContent = textBeforeCursor;

    const span = document.createElement("span");
    span.textContent = "|";
    mirror.appendChild(span);

    document.body.appendChild(mirror);

    try {
      const spanRect = span.getBoundingClientRect();
      const mirrorRect = mirror.getBoundingClientRect();
      const lineHeight = parseInt(style.lineHeight) || 20;

      // Position relative to input
      const top = spanRect.top - mirrorRect.top + lineHeight;
      const left = spanRect.left - mirrorRect.left;

      return {
        top: Math.min(top, inputEl.clientHeight - 200), // Keep in bounds
        left: Math.min(left, inputEl.clientWidth - 200),
      };
    } finally {
      document.body.removeChild(mirror);
    }
  };

  const handleInputChange = (
    value: string,
    cursorPos: number,
    inputEl: HTMLTextAreaElement
  ) => {
    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Check for active mention
    const mention = getMentionAtCursor(value, cursorPos);

    if (!mention || mention.query.length === 0) {
      setState((prev) => ({
        ...prev,
        showAutocomplete: false,
        results: [],
        activeMention: null,
      }));
      return;
    }

    // Debounce search
    debounceRef.current = setTimeout(() => {
      // Don't update state if unmounted or searcher not available
      if (!isMountedRef.current || !searcherRef.current) return;

      const results = searcherRef.current.search(mention.query);
      const position = calculatePosition(inputEl, cursorPos);

      setState({
        showAutocomplete: true,
        results,
        selectedIndex: 0,
        position,
        activeMention: mention,
      });
    }, DEBOUNCE_MS);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    currentValue: string,
    setValue: (value: string) => void
  ): boolean => {
    if (!state.showAutocomplete) return false;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setState((prev) => ({
          ...prev,
          selectedIndex:
            prev.selectedIndex < prev.results.length - 1
              ? prev.selectedIndex + 1
              : 0,
        }));
        return true;

      case "ArrowUp":
        e.preventDefault();
        setState((prev) => ({
          ...prev,
          selectedIndex:
            prev.selectedIndex > 0
              ? prev.selectedIndex - 1
              : prev.results.length - 1,
        }));
        return true;

      case "Enter":
      case "Tab":
        if (state.results.length > 0) {
          e.preventDefault();
          handleSelect(
            state.results[state.selectedIndex],
            currentValue,
            setValue
          );
          return true;
        }
        break;

      case "Escape":
        e.preventDefault();
        handleCancel();
        return true;
    }

    return false;
  };

  const handleSelect = (
    result: NoteSearchResult,
    currentValue: string,
    setValue: (value: string) => void
  ) => {
    if (!state.activeMention) return;

    const newValue = replaceMention(
      currentValue,
      state.activeMention,
      result.name
    );
    setValue(newValue);
    setState(INITIAL_STATE);
  };

  const handleCancel = () => {
    setState(INITIAL_STATE);
  };

  return {
    state,
    handleInputChange,
    handleKeyDown,
    handleSelect,
    handleCancel,
  };
}
