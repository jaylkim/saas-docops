/**
 * Complete Step - Step 7
 *
 * 설정 요약 및 다음 단계 안내
 */

import { setIcon } from "obsidian";
import type { WizardStep, WizardState } from "../setup-wizard-modal";

export function renderCompleteStep(
  container: HTMLElement,
  state: WizardState,
  _updateState: (updates: Partial<WizardState>) => void
): void {
  container.empty();

  // Hero
  const hero = container.createDiv({ cls: "wizard-complete-hero" });
  const heroIcon = hero.createEl("div", { cls: "complete-icon" });
  setIcon(heroIcon, "check-circle-2");
  hero.createEl("h2", { text: "설정이 완료되었습니다!" });

  // Summary
  const summary = container.createDiv({ cls: "wizard-complete-summary" });
  summary.createEl("h3", { text: "설정 요약" });

  const summaryList = summary.createDiv({ cls: "complete-summary-list" });

  // Environment
  if (state.environmentChecks) {
    const checks = state.environmentChecks;
    const passed = [checks.nodejs, checks.git, checks.claudeCode, checks.nodePty]
      .filter((c) => c.status === "pass").length;
    addSummaryItem(summaryList, "환경 점검", `${passed}/4 통과`, passed >= 3 ? "success" : "warning");
  }

  // API Key
  addSummaryItem(
    summaryList,
    "API 키",
    state.apiKeyConfigured ? "설정됨" : "미설정",
    state.apiKeyConfigured ? "success" : "neutral"
  );

  // Slack
  addSummaryItem(
    summaryList,
    "Slack 연동",
    state.slackConfigured ? "설정됨" : "건너뜀",
    state.slackConfigured ? "success" : "neutral"
  );

  // Atlassian
  addSummaryItem(
    summaryList,
    "Atlassian 연동",
    state.atlassianConfigured ? "설정됨" : "건너뜀",
    state.atlassianConfigured ? "success" : "neutral"
  );

  // SSH
  addSummaryItem(
    summaryList,
    "Bitbucket SSH",
    state.sshKeyInfo?.exists ? "설정됨" : "건너뜀",
    state.sshKeyInfo?.exists ? "success" : "neutral"
  );

  // Next steps
  const nextSteps = container.createDiv({ cls: "wizard-next-steps" });
  nextSteps.createEl("h3", { text: "다음 단계" });

  const steps = nextSteps.createDiv({ cls: "wizard-numbered-steps" });
  const nextStepItems = [
    "사이드바에서 터미널 아이콘을 클릭하세요",
    "터미널에서 claude 명령으로 Claude Code를 시작하세요",
    "질문이 있으면 claude /help 를 입력하세요",
  ];

  nextStepItems.forEach((text, i) => {
    const stepEl = steps.createDiv({ cls: "numbered-step" });
    stepEl.createSpan({ text: String(i + 1), cls: "step-number" });
    stepEl.createSpan({ text, cls: "step-text" });
  });

  // Tips
  const tips = container.createDiv({ cls: "wizard-tips" });
  const tipsHeader = tips.createEl("h4");
  const tipsIcon = tipsHeader.createSpan({ cls: "wizard-tips-icon" });
  setIcon(tipsIcon, "lightbulb");
  tipsHeader.createSpan({ text: " 팁" });
  const tipsList = tips.createEl("ul");
  tipsList.createEl("li", { text: "Cmd/Ctrl + P → 'SaaS DocOps' 검색으로 빠르게 터미널을 열 수 있습니다" });
  tipsList.createEl("li", { text: "설정 탭에서 언제든지 API 키나 연동 설정을 변경할 수 있습니다" });
  tipsList.createEl("li", { text: "마법사는 설정 탭에서 다시 실행할 수 있습니다" });

  // Completion note
  const noteEl = container.createEl("p", { cls: "wizard-note wizard-complete-note" });
  const noteIcon = noteEl.createSpan({ cls: "wizard-note-icon" });
  setIcon(noteIcon, "sparkles");
  noteEl.createSpan({ text: " \"완료\" 버튼을 클릭하면 설정이 저장되고 터미널이 열립니다." });
}

function addSummaryItem(
  container: HTMLElement,
  label: string,
  value: string,
  status: "success" | "warning" | "neutral"
): void {
  const item = container.createDiv({ cls: `summary-item status-${status}` });
  item.createSpan({ text: label, cls: "summary-label" });
  item.createSpan({ text: value, cls: "summary-value" });
}

export const completeStep: WizardStep = {
  id: "complete",
  title: "완료",
  render: renderCompleteStep,
};
