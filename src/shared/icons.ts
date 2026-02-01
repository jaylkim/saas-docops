/**
 * Icon Utilities - Lucide 아이콘 사용
 *
 * Obsidian의 setIcon API를 사용하여 일관된 아이콘 렌더링
 */

import { setIcon } from "obsidian";

export const ICON_NAMES = {
  // 상태
  success: "check-circle",
  error: "x-circle",
  warning: "alert-triangle",
  loading: "loader",
  refresh: "refresh-cw",

  // Git
  home: "home",
  branch: "git-branch",
  commit: "save",
  pull: "download",
  push: "upload",
  conflict: "alert-triangle",
  file: "file",
  folder: "folder",
  modified: "edit",
  added: "plus",
  deleted: "trash-2",

  // MCP
  bot: "bot",
  user: "user",
  slack: "message-square",
  atlassian: "file-text",
  github: "github",
  database: "database",
  memory: "brain",
  plug: "plug",

  // 일반
  terminal: "terminal-square",
  settings: "wrench",
  key: "key",
  lock: "lock",
  search: "search",
  copy: "copy",
  eye: "eye",
  eyeOff: "eye-off",
  shield: "shield",
  info: "info",
  help: "help-circle",
} as const;

export type IconName = keyof typeof ICON_NAMES;

/**
 * Render a Lucide icon into an element
 */
export function renderIcon(el: HTMLElement, iconName: string): void {
  setIcon(el, iconName);
}

/**
 * Create an icon element with the specified icon
 */
export function createIconEl(
  parent: HTMLElement,
  iconName: string,
  cls?: string
): HTMLElement {
  const iconEl = parent.createEl("span", { cls: cls || "saas-docops-icon" });
  setIcon(iconEl, iconName);
  return iconEl;
}
