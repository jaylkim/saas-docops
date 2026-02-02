/**
 * Git State - 반응형 상태 관리
 */

import * as path from "path";
import { GitService } from "./git-service";
import { GitStatus, GitBranch, GitViewState, GitOperationResult, GitCommitInfo, GitSubmoduleInfo } from "./git-types";

type StateListener = (state: GitViewState) => void;

export class GitState {
  private service: GitService;
  private listeners: Set<StateListener> = new Set();
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private mainRepoPath: string;  // 메인 저장소 경로 (submodule 전환용)

  private state: GitViewState = {
    loading: true,
    error: null,
    status: null,
    branches: [],
    selectedFiles: new Set(),
    commitMessage: "",
    activePanel: "status",
    commits: [],
    commitsLoaded: false,
    isDetachedHead: false,
    commitPage: 0,
    expandedCommit: null,
    detailLoading: false,
    submodules: [],
    activeRepoPath: null,
  };

  constructor(repoPath: string) {
    this.mainRepoPath = repoPath;
    this.service = new GitService(repoPath);
  }

  /**
   * 상태 리스너 등록
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    // 즉시 현재 상태 전달
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 상태 업데이트 및 리스너 알림
   */
  private setState(partial: Partial<GitViewState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  /**
   * 현재 상태 조회
   */
  getState(): GitViewState {
    return this.state;
  }

  /**
   * GitService 접근
   */
  getService(): GitService {
    return this.service;
  }

  /**
   * 저장소 경로 반환
   */
  getRepoPath(): string {
    return this.service.getRepoPath();
  }

  // ===== 상태 업데이트 =====

  /**
   * Git 상태 새로고침
   */
  async refresh(): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      const [status, branches, isDetachedHead] = await Promise.all([
        this.service.getStatus(),
        this.service.getBranches(),
        this.service.isDetachedHead(),
      ]);

      // 메인 저장소일 때만 submodule 목록 조회
      let submodules: GitSubmoduleInfo[] = this.state.submodules;
      if (this.state.activeRepoPath === null) {
        submodules = await this.service.getSubmoduleList();
      }

      this.setState({
        loading: false,
        status,
        branches,
        isDetachedHead,
        submodules,
        error: status.isRepo ? null : "Git 저장소가 아닙니다",
      });
    } catch (error) {
      this.setState({
        loading: false,
        error: error instanceof Error ? error.message : "상태 조회 실패",
      });
    }
  }

  /**
   * 자동 새로고침 시작
   */
  startAutoRefresh(intervalMs = 30000): void {
    this.stopAutoRefresh();
    this.refreshTimer = setInterval(() => this.refresh(), intervalMs);
  }

  /**
   * 자동 새로고침 중지
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ===== 파일 선택 =====

  /**
   * 파일 선택 토글
   */
  toggleFileSelection(filePath: string): void {
    const newSelection = new Set(this.state.selectedFiles);
    if (newSelection.has(filePath)) {
      newSelection.delete(filePath);
    } else {
      newSelection.add(filePath);
    }
    this.setState({ selectedFiles: newSelection });
  }

  /**
   * 모든 파일 선택
   */
  selectAllFiles(): void {
    if (!this.state.status) return;
    const allPaths = this.state.status.files.map((f) => f.path);
    this.setState({ selectedFiles: new Set(allPaths) });
  }

  /**
   * 모든 파일 선택 해제
   */
  clearSelection(): void {
    this.setState({ selectedFiles: new Set() });
  }

  // ===== 커밋 메시지 =====

  /**
   * 커밋 메시지 업데이트 (리렌더링 없이 상태만 저장)
   * 리렌더링하면 textarea가 새로 생성되어 IME 조합이 깨짐
   */
  setCommitMessage(message: string): void {
    this.state = { ...this.state, commitMessage: message };
  }

  /**
   * 커밋 메시지 초기화
   */
  clearCommitMessage(): void {
    this.setState({ commitMessage: "" });
  }

  // ===== 패널 전환 =====

  /**
   * 활성 패널 변경
   */
  setActivePanel(panel: GitViewState["activePanel"]): void {
    this.setState({ activePanel: panel });
  }

  // ===== Git 작업 =====

  /**
   * Pull 실행
   */
  async pull(): Promise<GitOperationResult> {
    this.setState({ loading: true });
    const result = await this.service.pull();
    await this.refresh();
    return result;
  }

  /**
   * Push 실행
   */
  async push(): Promise<GitOperationResult> {
    this.setState({ loading: true });
    const result = await this.service.push();
    await this.refresh();
    return result;
  }

  /**
   * 선택한 파일 Stage
   */
  async stageSelected(): Promise<GitOperationResult> {
    const files = Array.from(this.state.selectedFiles);
    if (files.length === 0) {
      return { success: false, message: "선택된 파일이 없습니다" };
    }

    const result = await this.service.stageFiles(files);
    if (result.success) {
      this.clearSelection();
    }
    await this.refresh();
    return result;
  }

  /**
   * 모든 파일 Stage
   */
  async stageAll(): Promise<GitOperationResult> {
    const result = await this.service.stageAll();
    await this.refresh();
    return result;
  }

  /**
   * 커밋 실행
   */
  async commit(): Promise<GitOperationResult> {
    const result = await this.service.commit(this.state.commitMessage);
    if (result.success) {
      this.clearCommitMessage();
    }
    await this.refresh();
    return result;
  }

  /**
   * 커밋 & 푸시
   */
  async commitAndPush(): Promise<GitOperationResult> {
    const result = await this.service.commitAndPush(this.state.commitMessage);
    if (result.success) {
      this.clearCommitMessage();
    }
    await this.refresh();
    return result;
  }

  /**
   * 브랜치 생성
   */
  async createBranch(name: string, fromMain = true): Promise<GitOperationResult> {
    const result = await this.service.createBranch(name, fromMain);
    await this.refresh();
    return result;
  }

  /**
   * 브랜치 전환
   */
  async switchBranch(name: string): Promise<GitOperationResult> {
    const result = await this.service.switchBranch(name);
    await this.refresh();
    return result;
  }

  /**
   * PR 링크 생성
   */
  async generatePRLink() {
    return this.service.generatePRLink();
  }

  /**
   * 충돌 해결
   */
  async resolveConflict(
    file: string,
    resolution: "ours" | "theirs"
  ): Promise<GitOperationResult> {
    const result = await this.service.resolveConflict(file, resolution);
    await this.refresh();
    return result;
  }

  /**
   * Git 저장소 초기화
   */
  async init(): Promise<GitOperationResult> {
    const result = await this.service.init();
    await this.refresh();
    return result;
  }

  /**
   * .gitignore 생성 또는 업데이트
   */
  async createOrUpdateGitignore(): Promise<GitOperationResult> {
    const result = await this.service.createOrUpdateGitignore();
    await this.refresh();
    return result;
  }

  /**
   * .gitignore 존재 여부
   */
  hasGitignore(): boolean {
    return this.service.hasGitignore();
  }

  /**
   * 원격 저장소 연결
   */
  async addRemote(url: string, name = "origin"): Promise<GitOperationResult> {
    const result = await this.service.addRemote(url, name);
    await this.refresh();
    return result;
  }

  /**
   * 원격 저장소 URL 변경
   */
  async setRemoteUrl(url: string, name = "origin"): Promise<GitOperationResult> {
    const result = await this.service.setRemoteUrl(url, name);
    await this.refresh();
    return result;
  }

  /**
   * 원격 저장소 연결 해제
   */
  async removeRemote(name = "origin"): Promise<GitOperationResult> {
    const result = await this.service.removeRemote(name);
    await this.refresh();
    return result;
  }

  /**
   * Git diff 가져오기 (AI 커밋 메시지 생성용)
   * @param files 특정 파일들만 diff할 경우 파일 경로 배열
   */
  async getDiff(files?: string[]): Promise<{ diff: string; hasStagedChanges: boolean }> {
    return this.service.getDiff(files);
  }

  // ===== 커밋 히스토리 =====

  /**
   * 커밋 히스토리 로드
   */
  /**
   * 커밋 히스토리 로드
   */
  async loadCommitHistory(search?: string): Promise<void> {
    this.setState({ loading: true, commitPage: 0 }); // Reset pagination
    try {
      const commits = await this.service.getCommitLog(50, 0, search);
      this.setState({ loading: false, commits, commitsLoaded: true });
    } catch (error) {
      this.setState({
        loading: false,
        error: error instanceof Error ? error.message : "커밋 이력 조회 실패",
      });
    }
  }

  /**
   * 더 많은 커밋 로드 (페이지네이션)
   */
  async loadMoreCommits(search?: string): Promise<void> {
    const nextPage = this.state.commitPage + 1;
    const limit = 50;
    const skip = nextPage * limit;

    try {
      const newCommits = await this.service.getCommitLog(limit, skip, search);

      if (newCommits.length === 0) {
        return; // No more commits
      }

      this.setState({
        commitPage: nextPage,
        commits: [...this.state.commits, ...newCommits],
      });
    } catch (error) {
      // Error handling (maybe show notice?)
      console.error("Failed to load more commits", error);
    }
  }

  /**
   * 커밋 상세 정보 토글
   */
  async toggleCommitDetails(hash: string): Promise<void> {
    // 이미 펼쳐져 있으면 닫기
    if (this.state.expandedCommit === hash) {
      this.setState({ expandedCommit: null });
      return;
    }

    this.setState({ expandedCommit: hash, detailLoading: true });

    // 해당 커밋 찾기
    const commitIndex = this.state.commits.findIndex((c) => c.hash === hash);
    if (commitIndex === -1) {
      this.setState({ detailLoading: false });
      return;
    }

    const commit = this.state.commits[commitIndex];

    // 이미 파일 정보가 있으면 바로 표시
    if (commit.files) {
      this.setState({ detailLoading: false });
      return;
    }

    // 파일 정보 로드
    try {
      const files = await this.service.getCommitDetails(hash);

      // 상태 업데이트 (커밋 객체에 파일 목록 추가)
      const newCommits = [...this.state.commits];
      newCommits[commitIndex] = { ...commit, files };

      this.setState({
        commits: newCommits,
        detailLoading: false,
      });
    } catch (error) {
      this.setState({
        detailLoading: false,
        error: "상세 정보 로드 실패",
      });
    }
  }

  /**
   * 특정 커밋으로 이동
   */
  async checkoutCommit(hash: string): Promise<GitOperationResult> {
    this.setState({ loading: true });
    const result = await this.service.checkoutCommit(hash);
    await this.refresh();
    if (result.success) {
      await this.loadCommitHistory();
    }
    return result;
  }

  /**
   * 최신 버전으로 복귀
   */
  async returnToLatest(): Promise<GitOperationResult> {
    this.setState({ loading: true });
    const result = await this.service.returnToLatest();
    await this.refresh();
    if (result.success) {
      await this.loadCommitHistory();
    }
    return result;
  }

  // ===== Submodule 지원 =====

  /**
   * 메인 저장소 경로 반환
   */
  getMainRepoPath(): string {
    return this.mainRepoPath;
  }

  /**
   * 현재 활성 저장소 경로 (submodule 포함) 반환
   */
  getActiveRepoPath(): string | null {
    return this.state.activeRepoPath;
  }

  /**
   * 저장소 전환 (메인 또는 submodule)
   * @param submodulePath submodule 상대 경로 또는 null(메인으로 복귀)
   */
  async switchRepo(submodulePath: string | null): Promise<void> {
    const targetPath = submodulePath
      ? path.join(this.mainRepoPath, submodulePath)
      : this.mainRepoPath;

    // GitService 인스턴스 교체
    this.service = new GitService(targetPath);

    // 상태 초기화 (커밋 이력 등 리셋)
    this.setState({
      activeRepoPath: submodulePath,
      commits: [],
      commitsLoaded: false,
      commitPage: 0,
      expandedCommit: null,
      selectedFiles: new Set(),
      commitMessage: "",
    });

    // 새로고침
    await this.refresh();
  }

  /**
   * Submodule 추가
   */
  async addSubmodule(url: string, path: string): Promise<GitOperationResult> {
    const mainService = new GitService(this.mainRepoPath);
    const result = await mainService.addSubmodule(url, path);

    if (result.success) {
      const submodules = await mainService.getSubmoduleList();
      this.setState({ submodules });
    }

    return result;
  }

  /**
   * 특정 Submodule 초기화
   */
  async initSubmodule(submodulePath: string): Promise<GitOperationResult> {
    // 메인 저장소의 service 사용
    const mainService = new GitService(this.mainRepoPath);
    const result = await mainService.initSubmodule(submodulePath);

    if (result.success) {
      // submodule 목록 다시 로드
      const submodules = await mainService.getSubmoduleList();
      this.setState({ submodules });
    }

    return result;
  }

  /**
   * 모든 Submodule 초기화
   */
  async initAllSubmodules(): Promise<GitOperationResult> {
    // 메인 저장소의 service 사용
    const mainService = new GitService(this.mainRepoPath);
    const result = await mainService.initAllSubmodules();

    if (result.success) {
      // submodule 목록 다시 로드
      const submodules = await mainService.getSubmoduleList();
      this.setState({ submodules });
    }

    return result;
  }

  /**
   * Submodule 존재 여부
   */
  hasSubmodules(): boolean {
    return this.state.submodules.length > 0;
  }

  /**
   * 리소스 정리
   */
  destroy(): void {
    this.stopAutoRefresh();
    this.listeners.clear();
  }
}
