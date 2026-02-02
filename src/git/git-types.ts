/**
 * Git Types - 비개발자 친화 Git 워크플로 타입 정의
 */

// 파일 상태
export type GitFileStatus =
  | "modified" // 수정됨
  | "added" // 새 파일
  | "deleted" // 삭제됨
  | "renamed" // 이름 변경
  | "copied" // 복사됨
  | "untracked" // 추적 안됨
  | "conflicted"; // 충돌

// Git 파일 정보
export interface GitFile {
  path: string;
  status: GitFileStatus;
  staged: boolean; // 저장 준비됨 (staged)
  displayName: string; // UI 표시용 이름
}

// 브랜치 정보
export interface GitBranch {
  name: string;
  current: boolean;
  isMain: boolean; // main/master 여부
  remote?: string; // origin/branch-name
  ahead: number; // 로컬이 앞선 커밋 수
  behind: number; // 로컬이 뒤쳐진 커밋 수
}

// Git 저장소 상태
export interface GitStatus {
  isRepo: boolean; // Git 저장소 여부
  currentBranch: string;
  isMainBranch: boolean;
  files: GitFile[];
  staged: GitFile[];
  modified: GitFile[];
  untracked: GitFile[];
  conflicted: GitFile[];
  ahead: number; // push 필요한 커밋 수
  behind: number; // pull 필요한 커밋 수
  hasRemote: boolean;
  remoteUrl: string | null;
  lastFetch: Date | null;
  needsInitialPush: boolean; // 원격은 있지만 추적 브랜치가 없는 경우 (첫 push 필요)
}

// 충돌 정보
export interface GitConflict {
  file: string;
  oursContent: string; // 내 변경사항
  theirsContent: string; // 상대방 변경사항
  baseContent: string; // 공통 조상
}

// 충돌 해결 방식
export type ConflictResolution = "ours" | "theirs" | "manual";

// 작업 결과
export interface GitOperationResult {
  success: boolean;
  message: string;
  error?: string;
  details?: string;
}

// PR 링크 정보 (Bitbucket)
export interface PRLinkInfo {
  url: string;
  provider: "bitbucket" | "github" | "gitlab" | "unknown";
  sourceBranch: string;
  targetBranch: string;
}

// Git 호스팅 제공자
export type GitProvider = "bitbucket" | "github" | "gitlab" | "unknown";

// 상태 변경 이벤트
export interface GitStateChangeEvent {
  type: "status" | "branch" | "files" | "remote" | "error";
  data?: GitStatus | GitBranch[] | GitFile[] | Error;
}

// 커밋 정보
export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: Date;
  isCurrent: boolean; // 현재 HEAD가 이 커밋인지
  files?: GitFile[]; // 변경된 파일 목록 (선택적)
}

// Submodule 정보 (저장소 선택 목록용)
export interface GitSubmoduleInfo {
  name: string; // 표시 이름
  path: string; // vault 기준 상대 경로
  absolutePath: string; // 절대 경로
  url?: string; // 원격 URL
  isInitialized: boolean; // 초기화 여부 (.git 존재 여부)
  headCommit?: string; // 현재 HEAD 커밋 해시
  status?: "clean" | "modified" | "out-of-sync" | "unknown"; // 상태
}

// View 상태
export interface GitViewState {
  loading: boolean;
  error: string | null;
  status: GitStatus | null;
  branches: GitBranch[];
  selectedFiles: Set<string>;
  commitMessage: string;
  activePanel: "status" | "sync" | "workspace" | "review" | "conflict";
  commits: GitCommitInfo[];
  commitsLoaded: boolean; // 커밋 이력 로드 시도 여부
  isDetachedHead: boolean;
  // Pagination & Details
  commitPage: number;
  expandedCommit: string | null; // 상세 내용을 보고 있는 커밋 해시
  detailLoading: boolean; // 상세 내용 로딩 중
  // Submodule 지원
  submodules: GitSubmoduleInfo[];     // submodule 목록
  activeRepoPath: string | null;       // 현재 선택된 repo 경로 (null = 메인)
}

// 비개발자 친화 용어 매핑
export const GIT_TERMS = {
  branch: "작업 공간",
  main: "메인 (공식 버전)",
  commit: "저장점",
  pull: "최신 내용 가져오기",
  push: "내 작업 올리기",
  conflict: "충돌 (겹침)",
  pullRequest: "검토 요청",
  staged: "저장 준비됨",
  modified: "수정됨",
  untracked: "새 파일",
  deleted: "삭제됨",
  ahead: "올릴 저장점",
  behind: "가져올 저장점",
  history: "저장 이력",
  checkout: "이동",
  detachedHead: "과거 버전 보기 모드",
  returnToLatest: "최신으로 돌아가기",
  submodule: "하위 저장소",
  mainRepo: "메인 저장소",
  uninitializedSubmodule: "초기화 필요",
} as const;

// 상태 아이콘 (이모지 - 텍스트 표시용, 예: Notice)
export const GIT_TEXT_ICONS = {
  branch: "🌿",
  main: "🏠",
  commit: "💾",
  pull: "⬇️",
  push: "⬆️",
  conflict: "⚠️",
  pullRequest: "📝",
  success: "✅",
  error: "❌",
  warning: "⚡",
  file: "📄",
  folder: "📁",
  modified: "✏️",
  added: "➕",
  deleted: "🗑️",
  loading: "⏳",
  sync: "🔄",
} as const;

// Lucide 아이콘 이름 (Deprecated: Use ICON_NAMES from shared/icons)
// export const GIT_ICON_NAMES = ...

// 상태 아이콘 (수정됨: Lucide 아이콘 이름 참조 - Deprecated)
// export const GIT_ICONS = GIT_ICON_NAMES;
