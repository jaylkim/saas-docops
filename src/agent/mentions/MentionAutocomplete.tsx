/**
 * Mention Autocomplete Dropdown
 *
 * Shows search results for @mention autocomplete.
 * Supports keyboard navigation.
 */

import * as React from "react";
import type { NoteSearchResult } from "../../types";

interface MentionAutocompleteProps {
  results: NoteSearchResult[];
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (result: NoteSearchResult) => void;
  onCancel: () => void;
}

export function MentionAutocomplete({
  results,
  selectedIndex,
  position,
  onSelect,
  onCancel,
}: MentionAutocompleteProps): React.ReactElement | null {
  const listRef = React.useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  React.useEffect(() => {
    if (listRef.current && selectedIndex < listRef.current.children.length) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      selectedEl?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (results.length === 0) {
    return (
      <div
        className="mention-autocomplete"
        style={{ top: position.top, left: position.left }}
      >
        <div className="mention-autocomplete-empty">
          검색 결과 없음
        </div>
      </div>
    );
  }

  return (
    <div
      className="mention-autocomplete"
      style={{ top: position.top, left: position.left }}
      role="listbox"
    >
      <div ref={listRef} className="mention-autocomplete-list">
        {results.map((result, index) => (
          <div
            key={result.path}
            className={`mention-autocomplete-item ${index === selectedIndex ? "selected" : ""}`}
            role="option"
            aria-selected={index === selectedIndex}
            onClick={() => onSelect(result)}
            onMouseDown={(e) => e.preventDefault()} // Prevent blur
          >
            <span className="mention-autocomplete-name">{result.name}</span>
            {result.folder && (
              <span className="mention-autocomplete-folder">
                {result.folder}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
