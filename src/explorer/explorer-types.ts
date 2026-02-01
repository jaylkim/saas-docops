/**
 * Explorer Types - 파일 탐색기 타입 정의
 */

export interface FileEntry {
  name: string;           // 파일명 (확장자 포함)
  path: string;           // Vault 기준 상대 경로
  absolutePath: string;   // 절대 경로
  isDirectory: boolean;
  isHidden: boolean;      // .으로 시작
  extension: string;      // 확장자 (.md, .ts 등)
  size?: number;          // 파일 크기 (바이트)
  modifiedTime?: Date;    // 수정 시간
}

export interface ExplorerViewState {
  loading: boolean;
  error: string | null;
  entries: FileEntry[];
  expandedPaths: Set<string>;
  selectedPath: string | null;
  currentPath: string;    // 현재 표시 중인 디렉토리 경로
}

export type ExplorerAction = "create-file" | "create-folder" | "rename" | "delete";

export interface ExplorerOperationResult {
  success: boolean;
  message: string;
  error?: string;
}
