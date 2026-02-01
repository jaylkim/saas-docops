/**
 * Welcome Step - Step 1
 *
 * 플러그인 소개 및 설정 과정 안내
 */

import { setIcon } from "obsidian";
import type { WizardStep, WizardState } from "../setup-wizard-modal";

export function renderWelcomeStep(
  container: HTMLElement,
  _state: WizardState,
  _updateState: (updates: Partial<WizardState>) => void
): void {
  container.empty();
  container.addClass("wizard-step-welcome");

  // Hero section
  const hero = container.createDiv({ cls: "wizard-hero" });
  const heroIcon = hero.createEl("div", { cls: "wizard-hero-icon" });
  setIcon(heroIcon, "rocket");
  hero.createEl("h2", { text: "SaaS DocOps 설정을 시작합니다" });
  hero.createEl("p", {
    text: "비개발자도 Claude Code의 모든 기능을 쉽게 사용할 수 있도록 도와드립니다.",
    cls: "wizard-hero-desc",
  });

  // What we'll set up
  const setup = container.createDiv({ cls: "wizard-setup-list" });
  setup.createEl("h3", { text: "설정할 내용" });

  const items = [
    { iconName: "wrench", title: "환경 점검", desc: "필수 도구 설치 확인" },
    { iconName: "key", title: "API 키 설정", desc: "Claude Code 인증" },
    { iconName: "message-square", title: "Slack 연동", desc: "Slack 메시지 읽기/쓰기" },
    { iconName: "file-text", title: "Atlassian 연동", desc: "Confluence/Jira 연동" },
    { iconName: "lock", title: "Bitbucket SSH", desc: "Git 저장소 접근 설정" },
  ];

  const list = setup.createDiv({ cls: "wizard-setup-items" });
  for (const item of items) {
    const el = list.createDiv({ cls: "wizard-setup-item" });
    const iconEl = el.createSpan({ cls: "setup-icon" });
    setIcon(iconEl, item.iconName);
    const text = el.createDiv({ cls: "setup-text" });
    text.createEl("strong", { text: item.title });
    text.createEl("span", { text: item.desc });
  }

  // MCP Config Level Selection (Moved from separate step)
  const configSection = container.createDiv({ cls: "wizard-config-selection" });
  configSection.createEl("h4", { text: "설정 저장 위치" });

  const options = configSection.createDiv({ cls: "wizard-config-options-mini" });

  // User Level
  const userOpt = options.createDiv({ cls: "config-option-mini" });
  const userRadio = userOpt.createEl("input", {
    type: "radio",
    attr: { name: "mcp-level", id: "mcp-user" },
  });
  const userLabel = userOpt.createEl("label", { attr: { for: "mcp-user" } });
  userLabel.createSpan({ text: "사용자 (~/.claude.json)", cls: "option-label" });

  // Project Level
  const projOpt = options.createDiv({ cls: "config-option-mini" });
  const projRadio = projOpt.createEl("input", {
    type: "radio",
    attr: { name: "mcp-level", id: "mcp-project" },
  });
  const projLabel = projOpt.createEl("label", { attr: { for: "mcp-project" } });
  projLabel.createSpan({ text: "프로젝트 (.mcp.json)", cls: "option-label" });

  // Init state
  // Assuming default is 'user' if not set
  userRadio.checked = true;

  // Handlers
  // Note: We need access to updateState or plugin to save this. 
  // Since welcomeStep signature has _updateState, we'll use it.

  userRadio.addEventListener("change", () => {
    if (userRadio.checked) {
      _updateState({ mcpConfigLevel: "user" });
    }
  });

  projRadio.addEventListener("change", () => {
    if (projRadio.checked) {
      _updateState({ mcpConfigLevel: "project" });
    }
  });


  // Note
  const noteEl = container.createEl("p", { cls: "wizard-note" });
  const noteIcon = noteEl.createSpan({ cls: "wizard-note-icon" });
  setIcon(noteIcon, "lightbulb");
  noteEl.createSpan({ text: " 각 단계는 선택사항입니다. 필요한 것만 설정하고 나머지는 건너뛸 수 있습니다." });
}

export const welcomeStep: WizardStep = {
  id: "welcome",
  title: "시작",
  render: renderWelcomeStep,
};
