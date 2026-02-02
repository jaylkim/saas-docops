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
  sync: "refresh-cw", // refresh alias

  // Git
  home: "home",
  branch: "git-branch",
  commit: "save",
  gitCommit: "git-commit", // timeline dot
  pull: "download",
  push: "upload",
  conflict: "alert-triangle",
  file: "file",
  folder: "folder",
  modified: "edit-2", // updated to match history panel preference
  added: "plus-circle", // updated to match history panel preference
  deleted: "trash-2",
  moved: "move",
  renamed: "file-edit",

  inbox: "inbox", // empty state
  lightbulb: "lightbulb", // help
  history: "history",
  clock: "clock",
  list: "list",

  // Navigation & Actions
  arrowLeft: "arrow-left",
  arrowRight: "arrow-right",

  // MCP
  bot: "bot",
  user: "user",
  slack: "message-square",
  atlassian: "file-text",
  github: "github",
  database: "database",
  memory: "brain",
  plug: "plug",
  cloudOff: "cloud-off",
  cloudUpload: "cloud-upload",
  unlink: "unlink",
  pullRequest: "file-edit",
  kanban: "folder-kanban",
  wand: "wand",
  activity: "activity",
  zap: "zap",
  play: "play",
  gitlab: "gitlab",
  bitbucket: "box",
  cloud: "cloud",
  users: "users",

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
  chevronDown: "chevron-down",
  chevronUp: "chevron-up",
  folderClosed: "folder-closed",
  download: "download",
  plus: "plus",
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
