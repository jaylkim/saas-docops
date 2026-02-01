/**
 * Setup Wizard Modal
 *
 * 플러그인 첫 실행 시 환경 설정을 안내하는 Modal 마법사
 */

import { Modal, App, Notice } from "obsidian";
import type IntegrationAIPlugin from "../main";
import type { EnvironmentCheckResults, SSHKeyInfo } from "./environment-checker";
import type { MCPConfigLevel } from "../constants";

// Step imports
import { welcomeStep } from "./steps/welcome-step";
import { environmentCheckStep, resetEnvironmentCheckResults } from "./steps/environment-check-step";
import { claudeLoginStep, resetClaudeLoginStatus } from "./steps/claude-login-step";
import { mcpConfigStep, resetMcpConfigStatus } from "./steps/mcp-config-step";
import { slackSetupStep, resetSlackSetupStatus } from "./steps/slack-setup-step";
import { atlassianSetupStep, resetAtlassianSetupStatus } from "./steps/atlassian-setup-step";
import { bitbucketSSHStep, resetBitbucketSSHStatus } from "./steps/bitbucket-ssh-step";
import { completeStep } from "./steps/complete-step";

export interface WizardState {
  // Environment
  environmentChecks?: EnvironmentCheckResults;

  // API Key
  apiKeyConfigured?: boolean;

  // MCP Config
  mcpConfigLevel?: MCPConfigLevel;

  // MCP Servers
  slackBotToken?: string;

  // SSH
  sshKeyInfo?: SSHKeyInfo;
}

export interface WizardStep {
  id: string;
  title: string;
  render: (
    container: HTMLElement,
    state: WizardState,
    updateState: (updates: Partial<WizardState>) => void,
    callbacks?: WizardCallbacks
  ) => void;
}

export interface WizardCallbacks {
  onRunCommand?: (command: string) => void;
  onOpenTerminal?: () => void;
  plugin?: IntegrationAIPlugin;
  vaultPath?: string;
}

export class SetupWizardModal extends Modal {
  private plugin: IntegrationAIPlugin;
  private currentStep: number = 0;
  private steps: WizardStep[];
  private state: WizardState;

  private stepContentEl!: HTMLElement;
  private footerEl!: HTMLElement;
  private progressEl!: HTMLElement;

  constructor(app: App, plugin: IntegrationAIPlugin) {
    super(app);
    this.plugin = plugin;

    this.steps = [
      welcomeStep,
      environmentCheckStep,
      claudeLoginStep,
      mcpConfigStep,
      slackSetupStep,
      atlassianSetupStep,
      bitbucketSSHStep,
      completeStep,
    ];

    this.state = {
      mcpConfigLevel: plugin.settings.mcpConfigLevel,
    };
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("saas-docops-wizard");

    // Reset cached data
    this.resetAllStepStates();

    // Create structure
    this.createModalStructure();
    this.renderCurrentStep();
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  private resetAllStepStates(): void {
    resetEnvironmentCheckResults();
    resetClaudeLoginStatus();
    resetMcpConfigStatus();
    resetSlackSetupStatus();
    resetAtlassianSetupStatus();
    resetBitbucketSSHStatus();
  }

  private createModalStructure(): void {
    const { contentEl } = this;
    contentEl.empty();

    // Header
    const header = contentEl.createDiv({ cls: "wizard-header" });
    header.createEl("h1", { text: "SaaS DocOps 설정" });

    // Progress
    this.progressEl = header.createDiv({ cls: "wizard-progress" });
    this.updateProgressIndicator();

    // Content
    this.stepContentEl = contentEl.createDiv({ cls: "wizard-content" });

    // Footer
    this.footerEl = contentEl.createDiv({ cls: "wizard-footer" });
  }

  private updateProgressIndicator(): void {
    this.progressEl.empty();

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      const isActive = i === this.currentStep;
      const isCompleted = i < this.currentStep;

      const dot = this.progressEl.createDiv({
        cls: `wizard-progress-dot ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`,
      });
      dot.setAttribute("title", step.title);
      dot.setAttribute("data-step", String(i));

      // Clickable for completed steps
      if (isCompleted) {
        dot.addClass("clickable");
        dot.addEventListener("click", () => {
          this.currentStep = i;
          this.renderCurrentStep();
        });
      }

      dot.createSpan({ text: String(i + 1), cls: "dot-number" });
    }
  }

  private renderCurrentStep(): void {
    this.stepContentEl.empty();
    this.footerEl.empty();

    const step = this.steps[this.currentStep];

    // Callbacks for terminal interaction and plugin access
    const vaultPath = (this.app.vault.adapter as { basePath?: string }).basePath || "";
    const callbacks: WizardCallbacks = {
      onRunCommand: (command: string) => {
        this.runCommandInTerminal(command);
      },
      onOpenTerminal: () => {
        this.openTerminal();
      },
      plugin: this.plugin,
      vaultPath,
    };

    // Render step
    step.render(this.stepContentEl, this.state, this.updateState.bind(this), callbacks);

    // Navigation
    this.renderNavigation();
    this.updateProgressIndicator();
  }

  private renderNavigation(): void {
    const isFirst = this.currentStep === 0;
    const isLast = this.currentStep === this.steps.length - 1;

    // Left: Previous button
    if (!isFirst) {
      const prevBtn = this.footerEl.createEl("button", {
        text: "← 이전",
        cls: "wizard-btn wizard-btn-secondary",
      });
      prevBtn.addEventListener("click", () => this.prevStep());
    } else {
      this.footerEl.createDiv(); // Spacer
    }

    // Center: Step indicator
    const stepIndicator = this.footerEl.createDiv({ cls: "wizard-step-indicator" });
    stepIndicator.setText(`${this.currentStep + 1} / ${this.steps.length}`);

    // Right: Skip or Next/Complete
    const rightActions = this.footerEl.createDiv({ cls: "wizard-right-actions" });

    // Skip button for optional steps (3-5)
    if (this.currentStep >= 2 && this.currentStep <= 5) {
      const skipBtn = rightActions.createEl("button", {
        text: "건너뛰기",
        cls: "wizard-btn wizard-btn-text",
      });
      skipBtn.addEventListener("click", () => this.nextStep());
    }

    if (isLast) {
      const completeBtn = rightActions.createEl("button", {
        text: "완료 ✓",
        cls: "wizard-btn wizard-btn-primary",
      });
      completeBtn.addEventListener("click", () => this.complete());
    } else {
      const nextBtn = rightActions.createEl("button", {
        text: "다음 →",
        cls: "wizard-btn wizard-btn-primary",
      });
      nextBtn.addEventListener("click", () => this.nextStep());
    }
  }

  private updateState(updates: Partial<WizardState>): void {
    this.state = { ...this.state, ...updates };
  }

  private nextStep(): void {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this.renderCurrentStep();
    }
  }

  private prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.renderCurrentStep();
    }
  }

  private async complete(): Promise<void> {
    // Save wizard completion status
    // API 키와 MCP 서버 설정은 각 단계에서 직접 저장됨
    this.plugin.settings.wizardCompleted = true;
    await this.plugin.saveSettings();

    // Close and open terminal
    this.close();

    new Notice("🎉 SaaS DocOps 설정이 완료되었습니다!");

    // Open terminal after a short delay
    setTimeout(() => {
      this.plugin.activateView("integration-terminal-view");
    }, 500);
  }

  private runCommandInTerminal(command: string): void {
    // Close wizard
    this.close();

    // Open terminal and run command
    new Notice(`터미널에서 실행: ${command}`);

    this.plugin.activateView("integration-terminal-view").then(() => {
      // Give terminal time to initialize
      setTimeout(() => {
        // Send command to terminal (this requires terminal view to expose a method)
        const event = new CustomEvent("saas-docops:run-command", {
          detail: { command },
        });
        window.dispatchEvent(event);
      }, 1000);
    });
  }

  private openTerminal(): void {
    this.close();
    this.plugin.activateView("integration-terminal-view");
  }
}
