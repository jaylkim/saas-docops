/**
 * Review Panel - 검토 요청 (PR) 패널
 */

import { Notice, setIcon } from "obsidian";
import { GitState } from "../git-state";
import { GitViewState, GIT_ICON_NAMES, PRLinkInfo } from "../git-types";

export function renderReviewPanel(
  container: HTMLElement,
  state: GitViewState,
  gitState: GitState
): void {
  container.empty();
  container.addClass("git-review-panel");

  const status = state.status;
  if (!status || !status.isRepo) {
    container.createEl("div", {
      cls: "git-panel-empty",
      text: "Git 저장소가 아닙니다"
    });
    return;
  }

  // 메인 브랜치에서는 PR 불가
  if (status.isMainBranch) {
    const infoBox = container.createEl("div", { cls: "git-info-box" });
    const infoIcon = infoBox.createEl("span", { cls: "git-info-icon" });
    setIcon(infoIcon, GIT_ICON_NAMES.info);
    infoBox.createEl("span", {
      text: "메인 브랜치에서는 검토 요청을 할 수 없습니다. 먼저 새 작업 공간을 만드세요."
    });
    return;
  }

  // 변경사항이 없으면 안내
  if (status.ahead === 0 && status.staged.length === 0 && status.modified.length === 0) {
    const infoBox = container.createEl("div", { cls: "git-info-box" });
    const infoIcon = infoBox.createEl("span", { cls: "git-info-icon" });
    setIcon(infoIcon, GIT_ICON_NAMES.info);
    infoBox.createEl("span", {
      text: "검토 요청할 변경사항이 없습니다. 작업을 저장하고 올린 후 다시 시도하세요."
    });
    return;
  }

  // 헤더
  const header = container.createEl("div", { cls: "git-review-header" });
  const reviewIcon = header.createEl("span", { cls: "git-review-icon" });
  setIcon(reviewIcon, GIT_ICON_NAMES.pullRequest);
  header.createEl("span", { cls: "git-review-title", text: "검토 요청 만들기" });

  // 현재 상태 요약
  const summary = container.createEl("div", { cls: "git-review-summary" });

  const summaryItems = [
    { label: "내 작업 공간", value: status.currentBranch },
    { label: "올릴 저장점", value: `${status.ahead}개` }
  ];

  for (const item of summaryItems) {
    const row = summary.createEl("div", { cls: "git-summary-row" });
    row.createEl("span", { cls: "git-summary-label", text: item.label });
    row.createEl("span", { cls: "git-summary-value", text: item.value });
  }

  // 올리지 않은 커밋이 있으면 경고
  if (status.ahead > 0) {
    // OK - 검토 요청 가능
  } else if (status.staged.length > 0 || status.modified.length > 0) {
    const warning = container.createEl("div", { cls: "git-warning-box" });
    const warningIcon = warning.createEl("span", { cls: "git-warning-icon" });
    setIcon(warningIcon, GIT_ICON_NAMES.warning);
    warning.createEl("span", {
      text: "먼저 변경사항을 '저장 & 올리기' 해야 검토 요청을 할 수 있습니다."
    });
    return;
  }

  // 안내 메시지
  const guide = container.createEl("div", { cls: "git-review-guide" });
  guide.createEl("p", {
    text: "검토 요청을 생성하면 팀원들이 내 작업을 확인하고 메인에 합칠 수 있습니다."
  });

  // PR 링크 생성 버튼
  const actions = container.createEl("div", { cls: "git-review-actions" });

  const createPRBtn = actions.createEl("button", {
    cls: "git-btn git-btn-primary git-btn-large"
  });
  const prIcon = createPRBtn.createEl("span", { cls: "git-btn-icon" });
  setIcon(prIcon, GIT_ICON_NAMES.pullRequest);
  createPRBtn.createEl("span", { text: "검토 요청 페이지 열기" });

  createPRBtn.onclick = async () => {
    createPRBtn.disabled = true;
    createPRBtn.addClass("git-btn-loading");

    try {
      const prLink = await gitState.generatePRLink();

      if (prLink) {
        // 브라우저에서 열기
        window.open(prLink.url, "_blank");

        new Notice("검토 요청 페이지를 열었습니다");

        // PR 링크 정보 표시
        showPRLinkInfo(container, prLink);
      } else {
        new Notice("PR 링크를 생성할 수 없습니다");
      }
    } catch (error) {
      new Notice(`오류 발생: ${error}`);
    } finally {
      createPRBtn.removeClass("git-btn-loading");
      createPRBtn.disabled = false;
    }
  };

  // 도움말
  const helpBox = container.createEl("div", { cls: "git-help-box" });
  const helpTitle = helpBox.createEl("div", { cls: "git-help-title" });
  const helpIcon = helpTitle.createEl("span");
  setIcon(helpIcon, "lightbulb");
  helpTitle.createEl("span", { text: " 검토 요청이란?" });
  helpBox.createEl("div", {
    cls: "git-help-text",
    text: "검토 요청(Pull Request)은 내 작업을 팀에게 보여주고 피드백을 받은 후, 승인되면 메인에 합치는 과정입니다. 코드 품질을 유지하고 실수를 방지하는 중요한 단계입니다."
  });
}

function showPRLinkInfo(container: HTMLElement, prLink: PRLinkInfo): void {
  // 기존 링크 정보 제거
  const existing = container.querySelector(".git-pr-link-info");
  if (existing) existing.remove();

  const linkInfo = container.createEl("div", { cls: "git-pr-link-info" });

  linkInfo.createEl("div", { cls: "git-pr-link-title", text: "검토 요청 정보" });

  const details = linkInfo.createEl("div", { cls: "git-pr-link-details" });

  const rows = [
    { label: "제공자", value: getProviderName(prLink.provider) },
    { label: "소스 브랜치", value: prLink.sourceBranch },
    { label: "대상 브랜치", value: prLink.targetBranch }
  ];

  for (const row of rows) {
    const rowEl = details.createEl("div", { cls: "git-pr-detail-row" });
    rowEl.createEl("span", { cls: "git-pr-detail-label", text: row.label });
    rowEl.createEl("span", { cls: "git-pr-detail-value", text: row.value });
  }

  // URL 복사 버튼
  const copyBtn = linkInfo.createEl("button", {
    cls: "git-btn git-btn-sm",
    text: "링크 복사"
  });

  copyBtn.onclick = async () => {
    await navigator.clipboard.writeText(prLink.url);
    new Notice("링크가 복사되었습니다");
  };
}

function getProviderName(provider: string): string {
  switch (provider) {
    case "bitbucket":
      return "Bitbucket";
    case "github":
      return "GitHub";
    case "gitlab":
      return "GitLab";
    default:
      return provider;
  }
}
