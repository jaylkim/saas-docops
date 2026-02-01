/**
 * Git Service - simple-git 래퍼
 *
 * 비개발자 친화 인터페이스로 Git 작업 수행
 */

import simpleGit, { SimpleGit, StatusResult, BranchSummary } from "simple-git";
import * as fs from "fs";
import * as path from "path";
import {
  GitStatus,
  GitFile,
  GitFileStatus,
  GitBranch,
  GitOperationResult,
  PRLinkInfo,
  GitProvider,
  GitConflict,
  ConflictResolution,
} from "./git-types";

export class GitService {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * 저장소 경로 반환
   */
  getRepoPath(): string {
    return this.repoPath;
  }

  /**
   * Git 저장소 여부 확인
   */
  async isGitRepo(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Git 저장소 초기화
   */
  async init(): Promise<GitOperationResult> {
    try {
      await this.git.init();

      // .gitignore 생성
      await this.createDefaultGitignore();

      return {
        success: true,
        message: "Git 저장소가 생성되었습니다!",
      };
    } catch (error) {
      return {
        success: false,
        message: "Git 저장소 생성 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * .gitignore 존재 여부 확인
   */
  hasGitignore(): boolean {
    const gitignorePath = path.join(this.repoPath, ".gitignore");
    return fs.existsSync(gitignorePath);
  }

  /**
   * 기본 .gitignore 생성 또는 업데이트 (Obsidian vault용)
   */
  async createOrUpdateGitignore(): Promise<GitOperationResult> {
    try {
      const gitignorePath = path.join(this.repoPath, ".gitignore");
      const defaultContent = this.getDefaultGitignoreContent();

      if (fs.existsSync(gitignorePath)) {
        // 기존 파일이 있으면 누락된 항목만 추가
        const existingContent = await fs.promises.readFile(gitignorePath, "utf-8");
        const mergedContent = this.mergeGitignore(existingContent, defaultContent);

        if (mergedContent === existingContent) {
          return {
            success: true,
            message: "이미 모든 권장 항목이 포함되어 있습니다.",
          };
        }

        await fs.promises.writeFile(gitignorePath, mergedContent, "utf-8");
        return {
          success: true,
          message: ".gitignore가 업데이트되었습니다!",
        };
      } else {
        // 새로 생성
        await fs.promises.writeFile(gitignorePath, defaultContent, "utf-8");
        return {
          success: true,
          message: ".gitignore가 생성되었습니다!",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: ".gitignore 생성 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 기존 .gitignore에 누락된 항목 병합
   */
  private mergeGitignore(existing: string, defaults: string): string {
    const existingLines = new Set(
      existing.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#"))
    );

    const defaultLines = defaults.split("\n");
    const newEntries: string[] = [];
    let currentSection = "";

    for (const line of defaultLines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("#")) {
        currentSection = trimmed;
      } else if (trimmed && !existingLines.has(trimmed)) {
        // 섹션 헤더 추가 (처음 추가되는 항목인 경우)
        if (currentSection && !newEntries.includes(currentSection)) {
          newEntries.push("");
          newEntries.push(currentSection);
        }
        newEntries.push(trimmed);
      }
    }

    if (newEntries.length === 0) {
      return existing;
    }

    // 기존 내용 끝에 새 항목 추가
    const result = existing.trimEnd() + "\n" + newEntries.join("\n") + "\n";
    return result;
  }

  /**
   * 기본 .gitignore 내용
   */
  private getDefaultGitignoreContent(): string {
    return `# Obsidian
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/plugins/*/data.json
.trash/

# 환경설정 및 민감한 파일 (절대 커밋 금지!)
.env
.env.*
.env.local
.env.*.local
*.secret
*.secrets
secrets.json
credentials.json
config.local.*

# API 키 및 인증 정보
.claude.json
.mcp.json
.anthropic*
*.pem
*.key
*.p12
*.pfx
id_rsa*
id_ed25519*
*.keystore

# 시스템 파일
.DS_Store
Thumbs.db
desktop.ini
._*

# 임시 파일
*.tmp
*.temp
*~
*.swp
*.swo

# 로그 파일
*.log
logs/

# Node.js (플러그인 개발용)
node_modules/
npm-debug.log*

# 백업 파일
*.bak
*.backup
*.orig
`;
  }

  /**
   * git init 시 호출되는 내부 메서드
   */
  private async createDefaultGitignore(): Promise<void> {
    await this.createOrUpdateGitignore();
  }

  /**
   * 현재 상태 조회
   */
  async getStatus(): Promise<GitStatus> {
    try {
      const isRepo = await this.isGitRepo();
      if (!isRepo) {
        return this.getEmptyStatus();
      }

      const [status, branchInfo, remoteInfo] = await Promise.all([
        this.git.status(),
        this.getCurrentBranchInfo(),
        this.getRemoteInfo(),
      ]);

      const files = this.parseFiles(status);
      const currentBranch = status.current || "main";
      const isMainBranch = this.isMainBranch(currentBranch);

      // 원격은 있지만 추적 브랜치가 없는지 확인 (첫 push 필요 여부)
      const needsInitialPush = await this.checkNeedsInitialPush(
        remoteInfo.hasRemote,
        currentBranch
      );

      return {
        isRepo: true,
        currentBranch,
        isMainBranch,
        files,
        staged: files.filter((f) => f.staged),
        modified: files.filter((f) => !f.staged && f.status !== "untracked"),
        untracked: files.filter((f) => f.status === "untracked"),
        conflicted: files.filter((f) => f.status === "conflicted"),
        ahead: branchInfo.ahead,
        behind: branchInfo.behind,
        hasRemote: remoteInfo.hasRemote,
        remoteUrl: remoteInfo.url,
        lastFetch: null,
        needsInitialPush,
      };
    } catch (error) {
      console.error("Git status error:", error);
      return this.getEmptyStatus();
    }
  }

  /**
   * 원격 저장소는 있지만 추적 브랜치가 없는지 확인
   * (빈 원격 저장소에 첫 push가 필요한 경우)
   */
  private async checkNeedsInitialPush(
    hasRemote: boolean,
    currentBranch: string
  ): Promise<boolean> {
    if (!hasRemote) return false;

    try {
      // 현재 브랜치의 upstream 설정 확인
      const trackingBranch = await this.git.raw([
        "config",
        "--get",
        `branch.${currentBranch}.remote`,
      ]);

      // upstream이 설정되어 있으면 false
      if (trackingBranch.trim()) {
        return false;
      }

      // 커밋이 있는지 확인 (커밋이 없으면 push할 것도 없음)
      const hasCommits = await this.hasAnyCommits();
      return hasCommits;
    } catch {
      // config가 없으면 upstream이 없다는 의미
      // 커밋이 있는지 확인
      try {
        const hasCommits = await this.hasAnyCommits();
        return hasCommits;
      } catch {
        return false;
      }
    }
  }

  /**
   * 커밋이 하나라도 있는지 확인
   */
  private async hasAnyCommits(): Promise<boolean> {
    try {
      await this.git.raw(["rev-parse", "HEAD"]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 빈 상태 반환
   */
  private getEmptyStatus(): GitStatus {
    return {
      isRepo: false,
      currentBranch: "",
      isMainBranch: false,
      files: [],
      staged: [],
      modified: [],
      untracked: [],
      conflicted: [],
      ahead: 0,
      behind: 0,
      hasRemote: false,
      remoteUrl: null,
      lastFetch: null,
      needsInitialPush: false,
    };
  }

  /**
   * main/master 브랜치 여부 확인
   */
  private isMainBranch(branchName: string): boolean {
    return ["main", "master"].includes(branchName.toLowerCase());
  }

  /**
   * 현재 브랜치 ahead/behind 정보
   */
  private async getCurrentBranchInfo(): Promise<{
    ahead: number;
    behind: number;
  }> {
    try {
      const status = await this.git.status();
      return {
        ahead: status.ahead || 0,
        behind: status.behind || 0,
      };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  /**
   * 원격 저장소 정보
   */
  private async getRemoteInfo(): Promise<{ hasRemote: boolean; url: string | null }> {
    try {
      const remotes = await this.git.getRemotes(true);
      const origin = remotes.find((r) => r.name === "origin");
      return {
        hasRemote: !!origin,
        url: origin?.refs?.fetch || origin?.refs?.push || null,
      };
    } catch {
      return { hasRemote: false, url: null };
    }
  }

  /**
   * StatusResult를 GitFile 배열로 변환
   */
  private parseFiles(status: StatusResult): GitFile[] {
    const files: GitFile[] = [];

    // Staged files
    for (const file of status.staged) {
      files.push(this.createGitFile(file, "added", true));
    }

    // Modified (staged)
    for (const file of status.modified) {
      const existing = files.find((f) => f.path === file);
      if (!existing) {
        files.push(this.createGitFile(file, "modified", false));
      }
    }

    // Deleted
    for (const file of status.deleted) {
      files.push(this.createGitFile(file, "deleted", false));
    }

    // Renamed
    for (const file of status.renamed) {
      files.push(this.createGitFile(file.to, "renamed", true));
    }

    // Untracked
    for (const file of status.not_added) {
      files.push(this.createGitFile(file, "untracked", false));
    }

    // Conflicted
    for (const file of status.conflicted) {
      files.push(this.createGitFile(file, "conflicted", false));
    }

    return files;
  }

  /**
   * GitFile 객체 생성
   */
  private createGitFile(
    path: string,
    status: GitFileStatus,
    staged: boolean
  ): GitFile {
    const parts = path.split("/");
    return {
      path,
      status,
      staged,
      displayName: parts[parts.length - 1],
    };
  }

  /**
   * 현재 브랜치 이름
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const status = await this.git.status();
      return status.current || "main";
    } catch {
      return "main";
    }
  }

  /**
   * 모든 브랜치 목록
   */
  async getBranches(): Promise<GitBranch[]> {
    try {
      const summary: BranchSummary = await this.git.branch(["-a", "-v"]);
      const branches: GitBranch[] = [];

      for (const [name, data] of Object.entries(summary.branches)) {
        // Skip remote tracking branches for cleaner UI
        if (name.startsWith("remotes/")) continue;

        branches.push({
          name,
          current: data.current,
          isMain: this.isMainBranch(name),
          remote: undefined,
          ahead: 0,
          behind: 0,
        });
      }

      return branches;
    } catch {
      return [];
    }
  }

  // ===== 동기화 작업 =====

  /**
   * 최신 내용 가져오기 (Pull)
   */
  async pull(): Promise<GitOperationResult> {
    try {
      const result = await this.git.pull();
      const summary = result.summary;

      if (summary.changes === 0 && summary.insertions === 0 && summary.deletions === 0) {
        return {
          success: true,
          message: "이미 최신 상태입니다.",
        };
      }

      return {
        success: true,
        message: `${summary.changes}개 파일 업데이트됨`,
        details: `추가: ${summary.insertions}, 삭제: ${summary.deletions}`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // 충돌 감지
      if (errorMsg.includes("conflict") || errorMsg.includes("CONFLICT")) {
        return {
          success: false,
          message: "충돌이 발생했습니다",
          error: "같은 파일을 수정한 경우 충돌이 발생합니다. 충돌을 해결해주세요.",
        };
      }

      return {
        success: false,
        message: "가져오기 실패",
        error: errorMsg,
      };
    }
  }

  /**
   * 내 작업 올리기 (Push)
   */
  async push(): Promise<GitOperationResult> {
    try {
      const currentBranch = await this.getCurrentBranch();

      // upstream이 설정되어 있는지 확인
      const hasUpstream = await this.hasUpstreamBranch(currentBranch);

      if (hasUpstream) {
        await this.git.push();
      } else {
        // 첫 push: upstream 설정과 함께 push
        await this.git.push(["-u", "origin", currentBranch]);
      }

      return {
        success: true,
        message: "성공적으로 올렸습니다!",
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // 원격에 새 커밋이 있는 경우
      if (errorMsg.includes("rejected") || errorMsg.includes("non-fast-forward")) {
        return {
          success: false,
          message: "먼저 최신 내용을 가져와야 합니다",
          error: "팀원이 먼저 작업을 올렸습니다. '최신 가져오기'를 먼저 실행하세요.",
        };
      }

      return {
        success: false,
        message: "올리기 실패",
        error: errorMsg,
      };
    }
  }

  /**
   * 현재 브랜치에 upstream이 설정되어 있는지 확인
   */
  private async hasUpstreamBranch(branchName: string): Promise<boolean> {
    try {
      const remote = await this.git.raw([
        "config",
        "--get",
        `branch.${branchName}.remote`,
      ]);
      return !!remote.trim();
    } catch {
      return false;
    }
  }

  /**
   * Fetch (원격 상태 확인)
   */
  async fetch(): Promise<GitOperationResult> {
    try {
      await this.git.fetch();
      return { success: true, message: "원격 상태 확인 완료" };
    } catch (error) {
      return {
        success: false,
        message: "원격 상태 확인 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ===== 브랜치 작업 =====

  /**
   * 새 작업 공간 만들기 (브랜치 생성)
   */
  async createBranch(name: string, fromMain = true): Promise<GitOperationResult> {
    try {
      // 브랜치 이름 정리 (공백 -> 하이픈)
      const safeName = name.trim().replace(/\s+/g, "-").toLowerCase();

      if (fromMain) {
        // main에서 분기
        const mainBranch = await this.findMainBranch();
        await this.git.checkout(mainBranch);
        await this.git.pull(); // 최신 상태로
      }

      await this.git.checkoutLocalBranch(safeName);

      return {
        success: true,
        message: `'${safeName}' 작업 공간이 생성되었습니다`,
      };
    } catch (error) {
      return {
        success: false,
        message: "작업 공간 생성 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 작업 공간 전환 (브랜치 체크아웃)
   */
  async switchBranch(name: string): Promise<GitOperationResult> {
    try {
      // 변경사항 확인
      const status = await this.git.status();
      if (status.files.length > 0) {
        return {
          success: false,
          message: "저장하지 않은 변경사항이 있습니다",
          error: "먼저 변경사항을 저장하거나 취소하세요.",
        };
      }

      await this.git.checkout(name);
      return {
        success: true,
        message: `'${name}' 작업 공간으로 전환했습니다`,
      };
    } catch (error) {
      return {
        success: false,
        message: "작업 공간 전환 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * main 브랜치 찾기
   */
  private async findMainBranch(): Promise<string> {
    try {
      const branches = await this.git.branchLocal();
      if (branches.all.includes("main")) return "main";
      if (branches.all.includes("master")) return "master";
      return branches.all[0] || "main";
    } catch {
      return "main";
    }
  }

  // ===== 커밋 작업 =====

  /**
   * 파일 선택 (Stage)
   */
  async stageFiles(files: string[]): Promise<GitOperationResult> {
    try {
      await this.git.add(files);
      return {
        success: true,
        message: `${files.length}개 파일 선택됨`,
      };
    } catch (error) {
      return {
        success: false,
        message: "파일 선택 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 모든 변경사항 선택
   */
  async stageAll(): Promise<GitOperationResult> {
    try {
      await this.git.add("-A");
      return {
        success: true,
        message: "모든 변경사항 선택됨",
      };
    } catch (error) {
      return {
        success: false,
        message: "선택 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 파일 선택 취소 (Unstage)
   */
  async unstageFiles(files: string[]): Promise<GitOperationResult> {
    try {
      await this.git.reset(["HEAD", "--", ...files]);
      return {
        success: true,
        message: `${files.length}개 파일 선택 취소됨`,
      };
    } catch (error) {
      return {
        success: false,
        message: "선택 취소 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 저장점 만들기 (Commit)
   */
  async commit(message: string): Promise<GitOperationResult> {
    try {
      if (!message.trim()) {
        return {
          success: false,
          message: "저장 메시지를 입력하세요",
        };
      }

      const result = await this.git.commit(message);

      return {
        success: true,
        message: "저장 완료!",
        details: result.summary
          ? `변경: ${result.summary.changes}, 추가: ${result.summary.insertions}, 삭제: ${result.summary.deletions}`
          : undefined,
      };
    } catch (error) {
      return {
        success: false,
        message: "저장 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 저장 & 올리기 (Commit + Push)
   */
  async commitAndPush(message: string): Promise<GitOperationResult> {
    const commitResult = await this.commit(message);
    if (!commitResult.success) {
      return commitResult;
    }

    const pushResult = await this.push();
    if (!pushResult.success) {
      return {
        ...pushResult,
        message: "저장은 완료했지만 올리기 실패",
      };
    }

    return {
      success: true,
      message: "저장 및 올리기 완료!",
    };
  }

  // ===== 충돌 해결 =====

  /**
   * 충돌 파일 목록
   */
  async getConflictedFiles(): Promise<string[]> {
    try {
      const status = await this.git.status();
      return status.conflicted;
    } catch {
      return [];
    }
  }

  /**
   * 충돌 해결 (간단 모드)
   */
  async resolveConflict(
    file: string,
    resolution: ConflictResolution
  ): Promise<GitOperationResult> {
    try {
      if (resolution === "ours") {
        await this.git.checkout(["--ours", file]);
      } else if (resolution === "theirs") {
        await this.git.checkout(["--theirs", file]);
      }

      await this.git.add(file);

      return {
        success: true,
        message: `'${file}' 충돌 해결됨`,
      };
    } catch (error) {
      return {
        success: false,
        message: "충돌 해결 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ===== PR 관련 =====

  /**
   * Git 호스팅 제공자 감지
   */
  async detectProvider(): Promise<GitProvider> {
    const remoteUrl = await this.getRemoteUrl();
    if (!remoteUrl) return "unknown";

    if (remoteUrl.includes("bitbucket.org")) return "bitbucket";
    if (remoteUrl.includes("github.com")) return "github";
    if (remoteUrl.includes("gitlab.com") || remoteUrl.includes("gitlab")) return "gitlab";

    return "unknown";
  }

  /**
   * 원격 URL 가져오기
   */
  async getRemoteUrl(): Promise<string | null> {
    try {
      const remotes = await this.git.getRemotes(true);
      const origin = remotes.find((r) => r.name === "origin");
      return origin?.refs?.fetch || origin?.refs?.push || null;
    } catch {
      return null;
    }
  }

  /**
   * PR 생성 페이지 URL 생성
   */
  async generatePRLink(targetBranch?: string): Promise<PRLinkInfo | null> {
    try {
      const remoteUrl = await this.getRemoteUrl();
      if (!remoteUrl) return null;

      const provider = await this.detectProvider();
      const currentBranch = await this.getCurrentBranch();
      const target = targetBranch || (await this.findMainBranch());

      // URL 파싱
      const repoInfo = this.parseRemoteUrl(remoteUrl);
      if (!repoInfo) return null;

      let url: string;

      switch (provider) {
        case "bitbucket":
          url = `https://bitbucket.org/${repoInfo.owner}/${repoInfo.repo}/pull-requests/new?source=${currentBranch}&dest=${target}`;
          break;
        case "github":
          url = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/compare/${target}...${currentBranch}?expand=1`;
          break;
        case "gitlab":
          url = `https://gitlab.com/${repoInfo.owner}/${repoInfo.repo}/-/merge_requests/new?merge_request[source_branch]=${currentBranch}&merge_request[target_branch]=${target}`;
          break;
        default:
          return null;
      }

      return {
        url,
        provider,
        sourceBranch: currentBranch,
        targetBranch: target,
      };
    } catch {
      return null;
    }
  }

  /**
   * 원격 URL 파싱
   */
  private parseRemoteUrl(url: string): { owner: string; repo: string } | null {
    // SSH format: git@github.com:owner/repo.git
    // HTTPS format: https://github.com/owner/repo.git

    let match = url.match(/[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }

    return null;
  }

  // ===== 유틸리티 =====

  /**
   * 변경사항 되돌리기 (특정 파일)
   */
  async discardChanges(files: string[]): Promise<GitOperationResult> {
    try {
      await this.git.checkout(["--", ...files]);
      return {
        success: true,
        message: `${files.length}개 파일 변경사항 취소됨`,
      };
    } catch (error) {
      return {
        success: false,
        message: "변경사항 취소 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 임시 보관 (Stash)
   */
  async stash(message?: string): Promise<GitOperationResult> {
    try {
      if (message) {
        await this.git.stash(["push", "-m", message]);
      } else {
        await this.git.stash();
      }
      return {
        success: true,
        message: "변경사항을 임시 보관했습니다",
      };
    } catch (error) {
      return {
        success: false,
        message: "임시 보관 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 임시 보관 복원 (Stash Pop)
   */
  async stashPop(): Promise<GitOperationResult> {
    try {
      await this.git.stash(["pop"]);
      return {
        success: true,
        message: "임시 보관 복원 완료",
      };
    } catch (error) {
      return {
        success: false,
        message: "임시 보관 복원 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Git diff 가져오기 (AI 커밋 메시지 생성용)
   * @param files 특정 파일들만 diff할 경우 파일 경로 배열
   */
  async getDiff(files?: string[]): Promise<{ diff: string; hasStagedChanges: boolean }> {
    try {
      const status = await this.git.status();
      const hasStagedChanges = status.staged.length > 0;

      const args: string[] = [];
      if (hasStagedChanges) {
        args.push("--cached");
      }
      if (files && files.length > 0) {
        args.push("--", ...files);
      }

      const diff = await this.git.diff(args);
      return { diff, hasStagedChanges };
    } catch {
      return { diff: "", hasStagedChanges: false };
    }
  }

  /**
   * 원격 저장소 추가 (Add Remote)
   */
  async addRemote(url: string, name = "origin"): Promise<GitOperationResult> {
    try {
      // URL 유효성 검사
      if (!this.isValidRemoteUrl(url)) {
        return {
          success: false,
          message: "유효하지 않은 URL 형식입니다",
          error: "HTTPS (https://...) 또는 SSH (git@...) 형식으로 입력해주세요.",
        };
      }

      // 기존 remote 확인
      const remotes = await this.git.getRemotes(true);
      const existing = remotes.find((r) => r.name === name);
      if (existing) {
        return {
          success: false,
          message: `'${name}' 원격 저장소가 이미 존재합니다`,
          error: "다른 이름을 사용하거나 기존 연결을 삭제하세요.",
        };
      }

      // remote 추가
      await this.git.addRemote(name, url);

      return {
        success: true,
        message: "원격 저장소가 연결되었습니다!",
        details: `${name}: ${this.formatRemoteUrlForDisplay(url)}`,
      };
    } catch (error) {
      return {
        success: false,
        message: "원격 저장소 연결 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 원격 저장소 URL 유효성 검사
   */
  private isValidRemoteUrl(url: string): boolean {
    // HTTPS format: https://github.com/owner/repo.git
    const httpsPattern = /^https:\/\/[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+(?:\.git)?$/;
    // SSH format: git@github.com:owner/repo.git
    const sshPattern = /^git@[a-zA-Z0-9.-]+:[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+(?:\.git)?$/;

    return httpsPattern.test(url) || sshPattern.test(url);
  }

  /**
   * 원격 URL을 표시용으로 포맷
   */
  private formatRemoteUrlForDisplay(url: string): string {
    return url
      .replace(/^git@[^:]+:/, "")
      .replace(/^https?:\/\/[^/]+\//, "")
      .replace(/\.git$/, "");
  }

  /**
   * 원격 저장소 URL 변경 (Set Remote URL)
   */
  async setRemoteUrl(url: string, name = "origin"): Promise<GitOperationResult> {
    try {
      // URL 유효성 검사
      if (!this.isValidRemoteUrl(url)) {
        return {
          success: false,
          message: "유효하지 않은 URL 형식입니다",
          error: "HTTPS (https://...) 또는 SSH (git@...) 형식으로 입력해주세요.",
        };
      }

      // remote 존재 확인
      const remotes = await this.git.getRemotes(true);
      const existing = remotes.find((r) => r.name === name);
      if (!existing) {
        return {
          success: false,
          message: `'${name}' 원격 저장소가 존재하지 않습니다`,
          error: "먼저 원격 저장소를 연결하세요.",
        };
      }

      // remote URL 변경
      await this.git.remote(["set-url", name, url]);

      return {
        success: true,
        message: "원격 저장소 URL이 변경되었습니다!",
        details: `${name}: ${this.formatRemoteUrlForDisplay(url)}`,
      };
    } catch (error) {
      return {
        success: false,
        message: "원격 저장소 URL 변경 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 원격 저장소 연결 해제 (Remove Remote)
   */
  async removeRemote(name = "origin"): Promise<GitOperationResult> {
    try {
      // remote 존재 확인
      const remotes = await this.git.getRemotes(true);
      const existing = remotes.find((r) => r.name === name);
      if (!existing) {
        return {
          success: false,
          message: `'${name}' 원격 저장소가 존재하지 않습니다`,
        };
      }

      // remote 삭제
      await this.git.remote(["remove", name]);

      return {
        success: true,
        message: "원격 저장소 연결이 해제되었습니다",
      };
    } catch (error) {
      return {
        success: false,
        message: "원격 저장소 연결 해제 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
