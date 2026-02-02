/**
 * Repo Selector - 저장소 선택 UI (메인 및 submodule 전환)
 */

import { App, Notice, setIcon } from "obsidian";
import { GitState } from "../git-state";
import { GitViewState, GIT_TERMS, GitSubmoduleInfo } from "../git-types";
import { ICON_NAMES } from "../../shared/icons";
import { AddSubmoduleModal } from "./add-submodule-modal";

/**
 * 저장소 선택 드롭다운 렌더링
 */
export function renderRepoSelector(
  container: HTMLElement,
  state: GitViewState,
  gitState: GitState,
  app: App
): void {
  // Submodule이 없으면 렌더링하지 않음 -> Add Submodule이 있으므로 이제 항상 렌더링해도 되지만, 
  // 디자인상 메인 repo 하나만 있을때는 안보여주고 싶다면 유지. 
  // 하지만 "추가" 기능을 위해 항상 보여주는게 좋을 수도 있음.
  // 일단 기존 로직 유지하되, 만약 submodules가 0개여도 추가 버튼을 위해 보여줄지 결정.
  // 유저 요청은 "submodule까지 관리". 0개일 때 추가하려면 설정에서 하거나 여기서 해야함.
  // 여기서는 일단 기존 submodules > 0 조건 유지하고, 추가되면 보이게 함.
  if (state.submodules.length === 0) {
    // Submodule이 하나도 없어도 '추가' 기능을 위해 selector를 렌더링할 수도 있지만,
    // 현재 UI 부하를 줄이기 위해 숨김 처리 유지. (추후 필요시 변경)
    return;
  }

  const selectorContainer = container.createEl("div", { cls: "git-repo-selector" });

  // 현재 선택된 저장소 표시
  const currentRepo = selectorContainer.createEl("div", { cls: "git-repo-current" });

  // 저장소 아이콘
  const repoIcon = currentRepo.createEl("span", { cls: "git-repo-icon" });
  setIcon(repoIcon, state.activeRepoPath ? ICON_NAMES.folder : ICON_NAMES.home);

  // 저장소 정보
  const repoInfo = currentRepo.createEl("div", { cls: "git-repo-info" });
  const repoLabel = repoInfo.createEl("span", { cls: "git-repo-label" });
  repoLabel.textContent = "저장소:";

  const repoName = repoInfo.createEl("span", { cls: "git-repo-name" });
  if (state.activeRepoPath) {
    const submodule = state.submodules.find(s => s.path === state.activeRepoPath);
    repoName.textContent = submodule?.name || state.activeRepoPath;
  } else {
    repoName.textContent = `${getRepoDisplayName(gitState.getMainRepoPath())} (${GIT_TERMS.mainRepo})`;
  }

  // 드롭다운 화살표
  const dropdownArrow = currentRepo.createEl("span", { cls: "git-repo-arrow" });
  setIcon(dropdownArrow, ICON_NAMES.chevronDown);

  // 드롭다운 메뉴
  const dropdown = selectorContainer.createEl("div", { cls: "git-repo-dropdown" });

  // 메인 저장소 옵션
  const mainOption = dropdown.createEl("div", {
    cls: `git-repo-option ${state.activeRepoPath === null ? "git-repo-option-active" : ""}`,
  });

  const mainIcon = mainOption.createEl("span", { cls: "git-repo-option-icon" });
  setIcon(mainIcon, ICON_NAMES.home);

  const mainInfo = mainOption.createEl("div", { cls: "git-repo-option-info" });
  mainInfo.createEl("span", {
    cls: "git-repo-option-name",
    text: getRepoDisplayName(gitState.getMainRepoPath()),
  });
  mainInfo.createEl("span", {
    cls: "git-repo-option-badge git-badge-main",
    text: GIT_TERMS.mainRepo,
  });

  mainOption.addEventListener("click", async () => {
    if (state.activeRepoPath !== null) {
      dropdown.removeClass("git-repo-dropdown-open");
      await gitState.switchRepo(null);
    }
  });

  // Submodule 옵션들
  for (const submodule of state.submodules) {
    const option = dropdown.createEl("div", {
      cls: `git-repo-option ${state.activeRepoPath === submodule.path ? "git-repo-option-active" : ""} ${!submodule.isInitialized ? "git-repo-option-disabled" : ""}`,
    });

    const optionIcon = option.createEl("span", { cls: "git-repo-option-icon" });
    setIcon(optionIcon, submodule.isInitialized ? ICON_NAMES.folder : ICON_NAMES.folderClosed);

    const optionInfo = option.createEl("div", { cls: "git-repo-option-info" });
    const nameData = optionInfo.createEl("div", { cls: "git-repo-option-header" });

    nameData.createEl("span", {
      cls: "git-repo-option-name",
      text: submodule.name,
    });

    // 상태 뱃지
    if (submodule.status === "out-of-sync") {
      const badge = nameData.createEl("span", { cls: "git-badge git-badge-warning", text: "불일치" });
      badge.title = "현재 커밋이 메인 저장소가 가리키는 커밋과 다릅니다.";
    } else if (submodule.status === "modified") {
      const badge = nameData.createEl("span", { cls: "git-badge git-badge-danger", text: "수정됨" });
      badge.title = "하위 저장소 내부에 수정된 사항이 있습니다.";
    }

    optionInfo.createEl("span", {
      cls: "git-repo-option-path",
      text: submodule.path,
    });

    if (!submodule.isInitialized) {
      // 초기화되지 않은 submodule
      const initBadge = optionInfo.createEl("span", {
        cls: "git-repo-option-badge git-badge-warning",
        text: GIT_TERMS.uninitializedSubmodule,
      });

      // 초기화 버튼
      const initBtn = option.createEl("button", {
        cls: "git-btn git-btn-sm git-btn-primary git-repo-init-btn",
        text: "초기화",
      });

      initBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        initBtn.disabled = true;
        initBtn.addClass("git-btn-loading");

        const result = await gitState.initSubmodule(submodule.path);

        initBtn.removeClass("git-btn-loading");
        initBtn.disabled = false;

        new Notice(result.message);
      });
    } else {
      option.addEventListener("click", async () => {
        if (state.activeRepoPath !== submodule.path) {
          dropdown.removeClass("git-repo-dropdown-open");
          await gitState.switchRepo(submodule.path);
        }
      });
    }
  }

  // 구분선
  dropdown.createEl("div", { cls: "git-repo-separator" });

  // 하위 저장소 추가 버튼
  const addBtn = dropdown.createEl("div", { cls: "git-repo-option git-repo-add-option" });
  const addIcon = addBtn.createEl("span", { cls: "git-repo-option-icon" });
  setIcon(addIcon, ICON_NAMES.plus);

  addBtn.createEl("span", { text: "새 하위 저장소 추가..." });

  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.removeClass("git-repo-dropdown-open");
    new AddSubmoduleModal(app, gitState).open();
  });


  // 모든 submodule 초기화 버튼 (미초기화 submodule이 있을 때만)
  const uninitializedCount = state.submodules.filter(s => !s.isInitialized).length;
  if (uninitializedCount > 0) {
    const initAllContainer = dropdown.createEl("div", { cls: "git-repo-init-all" });
    const initAllBtn = initAllContainer.createEl("button", {
      cls: "git-btn git-btn-sm git-btn-secondary",
    });

    const initAllIcon = initAllBtn.createEl("span", { cls: "git-btn-icon" });
    setIcon(initAllIcon, ICON_NAMES.download);
    initAllBtn.createEl("span", { text: `모든 하위 저장소 초기화 (${uninitializedCount}개)` });

    initAllBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      initAllBtn.disabled = true;
      initAllBtn.addClass("git-btn-loading");

      const result = await gitState.initAllSubmodules();

      initAllBtn.removeClass("git-btn-loading");
      initAllBtn.disabled = false;

      new Notice(result.message);
    });
  }

  // 드롭다운 토글
  currentRepo.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.toggleClass("git-repo-dropdown-open", !dropdown.hasClass("git-repo-dropdown-open"));
  });

  // 외부 클릭 시 드롭다운 닫기
  document.addEventListener("click", (e) => {
    if (!selectorContainer.contains(e.target as Node)) {
      dropdown.removeClass("git-repo-dropdown-open");
    }
  });
}

/**
 * 경로에서 저장소 표시 이름 추출
 */
function getRepoDisplayName(repoPath: string): string {
  const parts = repoPath.split(/[/\\]/);
  return parts[parts.length - 1] || "저장소";
}

/**
 * 초기화되지 않은 submodule 안내 메시지 렌더링
 */
export function renderUninitializedSubmoduleMessage(
  container: HTMLElement,
  state: GitViewState,
  gitState: GitState
): void {
  // 현재 선택된 repo가 초기화되지 않은 submodule인지 확인
  if (!state.activeRepoPath) return;

  const submodule = state.submodules.find(s => s.path === state.activeRepoPath);
  if (!submodule || submodule.isInitialized) return;

  const messageContainer = container.createEl("div", { cls: "git-uninitialized-message" });

  const icon = messageContainer.createEl("div", { cls: "git-uninitialized-icon" });
  setIcon(icon, ICON_NAMES.warning);

  const content = messageContainer.createEl("div", { cls: "git-uninitialized-content" });
  content.createEl("h3", { text: "하위 저장소 초기화 필요" });
  content.createEl("p", {
    text: "이 하위 저장소는 아직 초기화되지 않았습니다. 초기화하면 파일과 히스토리를 확인할 수 있습니다.",
  });

  const actions = content.createEl("div", { cls: "git-uninitialized-actions" });

  const initBtn = actions.createEl("button", { cls: "git-btn git-btn-primary" });
  const initBtnIcon = initBtn.createEl("span", { cls: "git-btn-icon" });
  setIcon(initBtnIcon, ICON_NAMES.download);
  initBtn.createEl("span", { text: "초기화하기" });

  initBtn.addEventListener("click", async () => {
    initBtn.disabled = true;
    initBtn.addClass("git-btn-loading");

    const result = await gitState.initSubmodule(state.activeRepoPath!);

    initBtn.removeClass("git-btn-loading");
    initBtn.disabled = false;

    new Notice(result.message);

    if (result.success) {
      // 다시 해당 repo로 전환하여 새로고침
      await gitState.switchRepo(state.activeRepoPath);
    }
  });

  const backBtn = actions.createEl("button", { cls: "git-btn git-btn-secondary" });
  const backBtnIcon = backBtn.createEl("span", { cls: "git-btn-icon" });
  setIcon(backBtnIcon, ICON_NAMES.home);
  backBtn.createEl("span", { text: "메인 저장소로 돌아가기" });

  backBtn.addEventListener("click", async () => {
    await gitState.switchRepo(null);
  });
}
