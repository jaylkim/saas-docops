/**
 * Bitbucket SSH Setup Step - Step 6
 *
 * SSH 키 확인/생성 및 Bitbucket 등록 안내
 */

import { setIcon } from "obsidian";
import type { WizardStep, WizardState } from "../setup-wizard-modal";
import { EnvironmentChecker, type SSHKeyInfo } from "../environment-checker";

let sshKeyInfo: SSHKeyInfo | null = null;
let isChecking = false;

export function renderBitbucketSSHStep(
  container: HTMLElement,
  state: WizardState,
  updateState: (updates: Partial<WizardState>) => void
): void {
  container.empty();

  const titleEl = container.createEl("h2", { cls: "wizard-step-title" });
  const titleIcon = titleEl.createSpan({ cls: "wizard-title-icon" });
  setIcon(titleIcon, "lock");
  titleEl.createSpan({ text: " Bitbucket SSH 설정" });
  container.createEl("p", {
    text: "Bitbucket 저장소에 접근하려면 SSH 키가 필요합니다.",
    cls: "wizard-step-desc",
  });

  const checker = new EnvironmentChecker();
  const statusContainer = container.createDiv({ cls: "wizard-ssh-status" });

  // Check SSH key status
  if (!sshKeyInfo && !isChecking) {
    isChecking = true;
    checker.getSSHKeyInfo().then((info) => {
      sshKeyInfo = info;
      isChecking = false;
      if (info.exists) {
        updateState({ sshKeyInfo: info });
      } else {
        // If not exists, ensure state doesn't have it (or has it marked)
        // But for modal completion check, we probably want to only set it if it exists
        updateState({ sshKeyInfo: undefined });
      }
      renderBitbucketSSHStep(container, state, updateState);
    });

    const loadingP = statusContainer.createEl("p");
    const loadingIcon = loadingP.createSpan({ cls: "wizard-loading-icon" });
    setIcon(loadingIcon, "loader");
    loadingP.createSpan({ text: " SSH 키를 확인하고 있습니다..." });
    return;
  }

  if (isChecking) {
    const loadingP = statusContainer.createEl("p");
    const loadingIcon = loadingP.createSpan({ cls: "wizard-loading-icon" });
    setIcon(loadingIcon, "loader");
    loadingP.createSpan({ text: " SSH 키를 확인하고 있습니다..." });
    return;
  }

  if (!sshKeyInfo) return;

  // SSH key exists
  if (sshKeyInfo.exists && sshKeyInfo.publicKey) {
    if (!state.sshKeyInfo) {
      setTimeout(() => updateState({ sshKeyInfo: sshKeyInfo ?? undefined }), 0);
    }
    const successBox = statusContainer.createDiv({ cls: "wizard-status-box status-success" });
    const successIcon = successBox.createEl("div", { cls: "status-icon" });
    setIcon(successIcon, "check-circle");
    const content = successBox.createDiv({ cls: "status-content" });
    content.createEl("h3", { text: "SSH 키가 있습니다" });
    content.createEl("p", { text: sshKeyInfo.message });

    // Show public key
    const keySection = container.createDiv({ cls: "wizard-ssh-key-section" });
    keySection.createEl("h4", { text: "공개 키 (이것을 Bitbucket에 등록하세요)" });

    const keyDisplay = keySection.createDiv({ cls: "wizard-ssh-key-display" });
    const keyText = keyDisplay.createEl("textarea", {
      cls: "wizard-ssh-key-textarea",
    }) as HTMLTextAreaElement;
    keyText.value = sshKeyInfo.publicKey;
    keyText.readOnly = true;
    keyText.rows = 4;

    const copyBtn = keySection.createEl("button", {
      cls: "wizard-btn wizard-btn-primary",
    });
    const copyIcon = copyBtn.createSpan({ cls: "wizard-btn-icon" });
    setIcon(copyIcon, "copy");
    const copyText = copyBtn.createSpan({ text: " 공개 키 복사" });
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(sshKeyInfo!.publicKey!);
      setIcon(copyIcon, "check");
      copyText.setText(" 복사됨!");
      setTimeout(() => {
        setIcon(copyIcon, "copy");
        copyText.setText(" 공개 키 복사");
      }, 2000);
    });

    // Bitbucket registration guide
    renderBitbucketGuide(container);
  } else {
    // No SSH key - need to generate
    const warningBox = statusContainer.createDiv({ cls: "wizard-status-box status-warning" });
    const warningIcon = warningBox.createEl("div", { cls: "status-icon" });
    setIcon(warningIcon, "alert-triangle");
    const content = warningBox.createDiv({ cls: "status-content" });
    content.createEl("h3", { text: "SSH 키가 없습니다" });
    content.createEl("p", { text: "SSH 키를 생성해야 Bitbucket에 접근할 수 있습니다." });

    // Generate key section
    const generateSection = container.createDiv({ cls: "wizard-generate-ssh" });
    generateSection.createEl("h4", { text: "SSH 키 생성" });

    // Email input for SSH key
    const inputGroup = generateSection.createDiv({ cls: "wizard-input-group" });
    inputGroup.createEl("label", { text: "이메일 주소" });
    inputGroup.createEl("p", {
      text: "SSH 키에 포함될 이메일입니다. 회사 이메일을 사용하세요.",
      cls: "wizard-hint",
    });
    const emailInput = inputGroup.createEl("input", {
      type: "email",
      placeholder: "your.email@company.com",
      cls: "wizard-input",
    }) as HTMLInputElement;
    emailInput.value = "";

    // Generate button
    const generateContainer = generateSection.createDiv({ cls: "wizard-generate-container" });
    const generateBtn = generateContainer.createEl("button", {
      cls: "wizard-btn wizard-btn-primary",
    });
    const genIcon = generateBtn.createSpan({ cls: "wizard-btn-icon" });
    setIcon(genIcon, "key");
    generateBtn.createSpan({ text: " SSH 키 생성" });
    const generateStatus = generateContainer.createSpan({ cls: "generate-status" });

    generateBtn.addEventListener("click", async () => {
      const email = emailInput.value.trim();
      if (!email || !email.includes("@")) {
        generateStatus.empty();
        const errorIcon = generateStatus.createSpan({ cls: "generate-status-icon" });
        setIcon(errorIcon, "x-circle");
        generateStatus.createSpan({ text: " 올바른 이메일을 입력해주세요" });
        generateStatus.addClass("error");
        return;
      }

      generateBtn.disabled = true;
      generateBtn.textContent = "생성 중...";
      generateStatus.empty();

      const result = await checker.generateSSHKey(email);

      if (result.success && result.publicKey) {
        generateStatus.empty();
        const successIcon = generateStatus.createSpan({ cls: "generate-status-icon" });
        setIcon(successIcon, "check-circle");
        generateStatus.createSpan({ text: " SSH 키가 생성되었습니다!" });
        generateStatus.removeClass("error");
        generateStatus.addClass("success");

        sshKeyInfo = {
          exists: true,
          publicKey: result.publicKey,
          message: "새로 생성된 ED25519 키",
        };

        // Re-render to show the key
        setTimeout(() => {
          renderBitbucketSSHStep(container, state, updateState);
        }, 1500);
      } else {
        generateStatus.empty();
        const errorIcon = generateStatus.createSpan({ cls: "generate-status-icon" });
        setIcon(errorIcon, "x-circle");
        generateStatus.createSpan({ text: ` ${result.error || "생성 실패"}` });
        generateStatus.addClass("error");
        generateBtn.disabled = false;
        generateBtn.empty();
        const newGenIcon = generateBtn.createSpan({ cls: "wizard-btn-icon" });
        setIcon(newGenIcon, "key");
        generateBtn.createSpan({ text: " SSH 키 생성" });
      }
    });
  }

  // Re-check button
  const actionsRow = container.createDiv({ cls: "wizard-actions-row" });
  const recheckBtn = actionsRow.createEl("button", {
    cls: "wizard-btn wizard-btn-text",
  });
  const recheckIcon = recheckBtn.createSpan({ cls: "wizard-btn-icon" });
  setIcon(recheckIcon, "refresh-cw");
  recheckBtn.createSpan({ text: " 다시 확인" });
  recheckBtn.addEventListener("click", () => {
    sshKeyInfo = null;
    isChecking = false;
    renderBitbucketSSHStep(container, state, updateState);
  });

  // Skip note
  const noteEl = container.createEl("p", { cls: "wizard-note" });
  const noteIcon = noteEl.createSpan({ cls: "wizard-note-icon" });
  setIcon(noteIcon, "lightbulb");
  noteEl.createSpan({ text: " SSH 설정은 선택사항입니다. Bitbucket을 사용하지 않는다면 건너뛰어도 됩니다." });
}

function renderBitbucketGuide(container: HTMLElement): void {
  const guide = container.createDiv({ cls: "wizard-setup-guide" });
  guide.createEl("h4", { text: "Bitbucket에 SSH 키 등록하기" });

  const step1 = guide.createDiv({ cls: "wizard-guide-step" });
  step1.createDiv({ cls: "guide-step-header" }).innerHTML = `
    <span class="guide-step-number">1</span>
    <span class="guide-step-title">Bitbucket 설정 열기</span>
  `;
  const step1Content = step1.createDiv({ cls: "guide-step-content" });
  const openBtn = step1Content.createEl("button", {
    text: "Bitbucket SSH 키 설정 열기 ↗",
    cls: "wizard-btn wizard-btn-secondary",
  });
  openBtn.addEventListener("click", () => {
    window.open("https://bitbucket.org/account/settings/ssh-keys/", "_blank");
  });

  const step2 = guide.createDiv({ cls: "wizard-guide-step" });
  step2.createDiv({ cls: "guide-step-header" }).innerHTML = `
    <span class="guide-step-number">2</span>
    <span class="guide-step-title">SSH 키 추가</span>
  `;
  const step2Content = step2.createDiv({ cls: "guide-step-content" });
  step2Content.innerHTML = `
    <ol>
      <li>"Add key" 버튼 클릭</li>
      <li>Label 입력 (예: "Work Laptop")</li>
      <li>위에서 복사한 공개 키를 Key 필드에 붙여넣기</li>
      <li>"Add key" 클릭하여 저장</li>
    </ol>
  `;

  const step3 = guide.createDiv({ cls: "wizard-guide-step" });
  step3.createDiv({ cls: "guide-step-header" }).innerHTML = `
    <span class="guide-step-number">3</span>
    <span class="guide-step-title">연결 테스트</span>
  `;
  const step3Content = step3.createDiv({ cls: "guide-step-content" });
  step3Content.createEl("p", { text: "터미널에서 다음 명령어로 연결을 테스트할 수 있습니다:" });
  const cmdDisplay = step3Content.createDiv({ cls: "wizard-cmd-display" });
  cmdDisplay.createEl("code", { text: "ssh -T git@bitbucket.org" });
}

export function resetBitbucketSSHStatus(): void {
  sshKeyInfo = null;
  isChecking = false;
}

export const bitbucketSSHStep: WizardStep = {
  id: "bitbucket-ssh",
  title: "Bitbucket SSH",
  render: renderBitbucketSSHStep,
};
