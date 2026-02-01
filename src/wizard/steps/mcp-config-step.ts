/**
 * MCP Config Level Step - Step 4
 *
 * MCP 서버 설정 저장 위치 선택 (사용자/프로젝트)
 */

import type { WizardStep, WizardState } from "../setup-wizard-modal";
import type IntegrationAIPlugin from "../../main";
import { MCPConfigLevel } from "../../constants";

let selectedLevel: MCPConfigLevel | null = null;

export function renderMcpConfigStep(
  container: HTMLElement,
  state: WizardState,
  updateState: (updates: Partial<WizardState>) => void,
  callbacks?: { plugin?: IntegrationAIPlugin; vaultPath?: string }
): void {
  container.empty();

  container.createEl("h2", { text: "📁 MCP 설정 위치", cls: "wizard-step-title" });
  container.createEl("p", {
    text: "MCP 서버 설정을 어디에 저장할지 선택합니다.",
    cls: "wizard-step-desc",
  });

  const vaultPath = callbacks?.vaultPath || "(vault 경로)";

  // Options
  const optionsContainer = container.createDiv({ cls: "wizard-config-options" });

  // User level option
  const userOption = optionsContainer.createDiv({ cls: "wizard-config-option" });
  const userRadio = userOption.createEl("input", {
    type: "radio",
    attr: { name: "mcp-config-level", value: "user", id: "mcp-level-user" },
  }) as HTMLInputElement;

  const userLabel = userOption.createEl("label", { attr: { for: "mcp-level-user" } });
  userLabel.createEl("strong", { text: "사용자 레벨" });
  userLabel.createEl("span", { text: " (~/.claude.json)" });
  userOption.createEl("p", {
    text: "모든 프로젝트에서 공통으로 사용됩니다. 개인 설정에 적합합니다.",
    cls: "wizard-config-desc",
  });

  // Project level option
  const projectOption = optionsContainer.createDiv({ cls: "wizard-config-option" });
  const projectRadio = projectOption.createEl("input", {
    type: "radio",
    attr: { name: "mcp-config-level", value: "project", id: "mcp-level-project" },
  }) as HTMLInputElement;

  const projectLabel = projectOption.createEl("label", { attr: { for: "mcp-level-project" } });
  projectLabel.createEl("strong", { text: "프로젝트 레벨" });
  projectLabel.createEl("span", { text: ` (${vaultPath}/.mcp.json)` });
  projectOption.createEl("p", {
    text: "이 vault에서만 사용됩니다. Git으로 팀과 공유할 수 있습니다.",
    cls: "wizard-config-desc",
  });

  // Set initial selection
  const currentLevel = selectedLevel || callbacks?.plugin?.settings.mcpConfigLevel || "user";
  if (currentLevel === "user") {
    userRadio.checked = true;
    userOption.addClass("selected");
  } else {
    projectRadio.checked = true;
    projectOption.addClass("selected");
  }
  selectedLevel = currentLevel;

  // Event handlers
  userRadio.addEventListener("change", () => {
    if (userRadio.checked) {
      selectedLevel = "user";
      userOption.addClass("selected");
      projectOption.removeClass("selected");
      updateState({ mcpConfigLevel: "user" });
      if (callbacks?.plugin) {
        callbacks.plugin.settings.mcpConfigLevel = "user";
        callbacks.plugin.saveSettings();
      }
    }
  });

  projectRadio.addEventListener("change", () => {
    if (projectRadio.checked) {
      selectedLevel = "project";
      projectOption.addClass("selected");
      userOption.removeClass("selected");
      updateState({ mcpConfigLevel: "project" });
      if (callbacks?.plugin) {
        callbacks.plugin.settings.mcpConfigLevel = "project";
        callbacks.plugin.saveSettings();
      }
    }
  });

  // Comparison table
  const comparisonSection = container.createDiv({ cls: "wizard-comparison" });
  comparisonSection.createEl("h4", { text: "비교" });

  const table = comparisonSection.createEl("table", { cls: "wizard-comparison-table" });

  const thead = table.createEl("thead");
  const headerRow = thead.createEl("tr");
  headerRow.createEl("th", { text: "특성" });
  headerRow.createEl("th", { text: "사용자" });
  headerRow.createEl("th", { text: "프로젝트" });

  const tbody = table.createEl("tbody");

  const rows = [
    ["저장 위치", "~/.claude.json", ".mcp.json"],
    ["적용 범위", "모든 프로젝트", "현재 vault만"],
    ["팀 공유", "불가 (개인 설정)", "Git으로 공유 가능"],
    ["권장 용도", "개인 API 키", "팀 공유 설정"],
  ];

  for (const [feature, user, project] of rows) {
    const row = tbody.createEl("tr");
    row.createEl("td", { text: feature });
    row.createEl("td", { text: user });
    row.createEl("td", { text: project });
  }

  // Note
  container.createEl("p", {
    text: "💡 나중에 설정 탭에서 변경할 수 있습니다.",
    cls: "wizard-note",
  });
}

export function resetMcpConfigStatus(): void {
  selectedLevel = null;
}

export function getMcpConfigLevel(): MCPConfigLevel {
  return selectedLevel || "user";
}

export const mcpConfigStep: WizardStep = {
  id: "mcp-config",
  title: "MCP 설정 위치",
  render: renderMcpConfigStep,
};
