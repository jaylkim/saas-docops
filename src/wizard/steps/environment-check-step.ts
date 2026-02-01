/**
 * Environment Check Step - Step 2
 *
 * Node.js, Git, Claude Code 점검 및 설치 지원
 */

import type { WizardStep, WizardState } from "../setup-wizard-modal";
import { EnvironmentChecker, type CheckResult, type EnvironmentCheckResults } from "../environment-checker";

let checkResults: EnvironmentCheckResults | null = null;
let isChecking = false;

function getStatusIcon(status: CheckResult["status"]): string {
  switch (status) {
    case "pass": return "✅";
    case "warning": return "⚠️";
    case "fail": return "❌";
  }
}

function renderCheckItem(
  container: HTMLElement,
  result: CheckResult,
  onInstall?: (command: string) => void
): void {
  const item = container.createDiv({ cls: `wizard-env-item status-${result.status}` });

  const header = item.createDiv({ cls: "env-item-header" });
  header.createSpan({ text: getStatusIcon(result.status), cls: "env-status-icon" });

  const info = header.createDiv({ cls: "env-item-info" });
  const titleRow = info.createDiv({ cls: "env-title-row" });
  titleRow.createEl("strong", { text: result.name });
  if (result.version) {
    titleRow.createSpan({ text: result.version, cls: "env-version" });
  }
  info.createEl("span", { text: result.message, cls: "env-message" });

  // Install button for failed items
  if (result.status === "fail" && result.installCommand && onInstall) {
    const actions = item.createDiv({ cls: "env-item-actions" });

    const installBtn = actions.createEl("button", {
      text: "터미널에서 설치",
      cls: "wizard-btn wizard-btn-primary wizard-btn-sm",
    });
    installBtn.addEventListener("click", () => {
      onInstall(result.installCommand!);
    });

    // Copy command button
    const copyBtn = actions.createEl("button", {
      text: "명령어 복사",
      cls: "wizard-btn wizard-btn-secondary wizard-btn-sm",
    });
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(result.installCommand!);
      copyBtn.setText("✓ 복사됨");
      setTimeout(() => copyBtn.setText("명령어 복사"), 2000);
    });

    // Show the command
    const cmdDisplay = item.createDiv({ cls: "env-cmd-display" });
    cmdDisplay.createEl("code", { text: result.installCommand });
  }
}

export function renderEnvironmentCheckStep(
  container: HTMLElement,
  state: WizardState,
  updateState: (updates: Partial<WizardState>) => void,
  callbacks?: {
    onRunCommand?: (command: string) => void;
    onOpenTerminal?: () => void;
  }
): void {
  container.empty();

  container.createEl("h2", { text: "🔧 환경 점검", cls: "wizard-step-title" });
  container.createEl("p", {
    text: "Claude Code 사용에 필요한 도구들을 확인합니다.",
    cls: "wizard-step-desc",
  });

  const checksContainer = container.createDiv({ cls: "wizard-env-checks" });

  // Loading state
  if (!checkResults && !isChecking) {
    isChecking = true;
    checksContainer.createDiv({ cls: "wizard-loading" }).createEl("p", {
      text: "⏳ 환경을 점검하고 있습니다...",
    });

    const checker = new EnvironmentChecker();
    checker.checkAll().then((results) => {
      checkResults = results;
      isChecking = false;
      updateState({ environmentChecks: results });
      renderEnvironmentCheckStep(container, state, updateState, callbacks);
    });
    return;
  }

  if (isChecking) {
    checksContainer.createDiv({ cls: "wizard-loading" }).createEl("p", {
      text: "⏳ 환경을 점검하고 있습니다...",
    });
    return;
  }

  if (!checkResults) return;

  // Render each check
  const checks = [
    checkResults.nodejs,
    checkResults.git,
    checkResults.claudeCode,
    checkResults.nodePty,
  ];

  for (const check of checks) {
    renderCheckItem(checksContainer, check, (command) => {
      if (callbacks?.onRunCommand) {
        callbacks.onRunCommand(command);
      }
    });
  }

  // Summary
  const failCount = checks.filter((c) => c.status === "fail").length;
  const summary = container.createDiv({ cls: "wizard-env-summary" });

  if (failCount > 0) {
    summary.addClass("summary-warning");
    summary.createEl("p", {
      text: `⚠️ ${failCount}개 항목이 설치되어 있지 않습니다.`,
    });
    summary.createEl("p", {
      text: "\"터미널에서 설치\" 버튼을 클릭하거나, 명령어를 복사해서 터미널에 붙여넣으세요.",
      cls: "summary-hint",
    });

    // Open terminal button
    if (callbacks?.onOpenTerminal) {
      const terminalBtn = summary.createEl("button", {
        text: "💻 터미널 열기",
        cls: "wizard-btn wizard-btn-secondary",
      });
      terminalBtn.addEventListener("click", () => {
        callbacks.onOpenTerminal!();
      });
    }
  } else {
    summary.addClass("summary-success");
    summary.createEl("p", { text: "✅ 모든 환경 점검을 통과했습니다!" });
  }

  // Re-check button
  const actionsRow = container.createDiv({ cls: "wizard-actions-row" });
  const recheckBtn = actionsRow.createEl("button", {
    text: "🔄 다시 점검",
    cls: "wizard-btn wizard-btn-text",
  });
  recheckBtn.addEventListener("click", () => {
    checkResults = null;
    isChecking = false;
    renderEnvironmentCheckStep(container, state, updateState, callbacks);
  });
}

export function resetEnvironmentCheckResults(): void {
  checkResults = null;
  isChecking = false;
}

export const environmentCheckStep: WizardStep = {
  id: "environment-check",
  title: "환경 점검",
  render: renderEnvironmentCheckStep,
};
