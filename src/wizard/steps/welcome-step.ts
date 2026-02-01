/**
 * Welcome Step - Step 1
 *
 * 플러그인 소개 및 설정 과정 안내
 */

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
  hero.createEl("div", { text: "🚀", cls: "wizard-hero-icon" });
  hero.createEl("h2", { text: "SaaS DocOps 설정을 시작합니다" });
  hero.createEl("p", {
    text: "비개발자도 Claude Code의 모든 기능을 쉽게 사용할 수 있도록 도와드립니다.",
    cls: "wizard-hero-desc",
  });

  // What we'll set up
  const setup = container.createDiv({ cls: "wizard-setup-list" });
  setup.createEl("h3", { text: "설정할 내용" });

  const items = [
    { icon: "🔧", title: "환경 점검", desc: "필수 도구 설치 확인" },
    { icon: "🔑", title: "API 키 설정", desc: "Claude Code 인증" },
    { icon: "💬", title: "Slack 연동", desc: "Slack 메시지 읽기/쓰기" },
    { icon: "📄", title: "Atlassian 연동", desc: "Confluence/Jira 연동" },
    { icon: "🔑", title: "Bitbucket SSH", desc: "Git 저장소 접근 설정" },
  ];

  const list = setup.createDiv({ cls: "wizard-setup-items" });
  for (const item of items) {
    const el = list.createDiv({ cls: "wizard-setup-item" });
    el.createSpan({ text: item.icon, cls: "setup-icon" });
    const text = el.createDiv({ cls: "setup-text" });
    text.createEl("strong", { text: item.title });
    text.createEl("span", { text: item.desc });
  }

  // Note
  container.createEl("p", {
    text: "💡 각 단계는 선택사항입니다. 필요한 것만 설정하고 나머지는 건너뛸 수 있습니다.",
    cls: "wizard-note",
  });
}

export const welcomeStep: WizardStep = {
  id: "welcome",
  title: "시작",
  render: renderWelcomeStep,
};
