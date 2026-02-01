/**
 * Explorer State - 반응형 상태 관리
 */

import { ExplorerService } from "./explorer-service";
import { FileEntry, ExplorerViewState, ExplorerOperationResult } from "./explorer-types";

type StateListener = (state: ExplorerViewState) => void;

export class ExplorerState {
  private service: ExplorerService;
  private listeners: Set<StateListener> = new Set();

  private state: ExplorerViewState = {
    loading: true,
    error: null,
    entries: [],
    expandedPaths: new Set(),
    selectedPath: null,
    currentPath: "",
  };

  constructor(basePath: string) {
    this.service = new ExplorerService(basePath);
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
  private setState(partial: Partial<ExplorerViewState>): void {
    // Set 타입은 별도 처리
    if (partial.expandedPaths) {
      this.state = {
        ...this.state,
        ...partial,
        expandedPaths: new Set(partial.expandedPaths),
      };
    } else {
      this.state = { ...this.state, ...partial };
    }
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
  getState(): ExplorerViewState {
    return this.state;
  }

  /**
   * ExplorerService 접근
   */
  getService(): ExplorerService {
    return this.service;
  }

  // ===== 상태 업데이트 =====

  /**
   * 파일 목록 새로고침
   */
  async refresh(): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      const entries = await this.service.readDirectoryRecursive(
        this.state.currentPath,
        this.state.expandedPaths
      );

      this.setState({
        loading: false,
        entries,
        error: null,
      });
    } catch (error) {
      this.setState({
        loading: false,
        error: error instanceof Error ? error.message : "파일 목록 조회 실패",
      });
    }
  }

  /**
   * 폴더 펼침/접힘 토글
   */
  async toggleExpand(path: string): Promise<void> {
    const newExpandedPaths = new Set(this.state.expandedPaths);

    if (newExpandedPaths.has(path)) {
      newExpandedPaths.delete(path);
    } else {
      newExpandedPaths.add(path);
    }

    this.setState({ expandedPaths: newExpandedPaths });
    await this.refresh();
  }

  /**
   * 파일/폴더 선택
   */
  select(path: string | null): void {
    this.setState({ selectedPath: path });
  }

  /**
   * 모든 폴더 접기
   */
  async collapseAll(): Promise<void> {
    this.setState({ expandedPaths: new Set() });
    await this.refresh();
  }

  // ===== CRUD 작업 =====

  /**
   * 파일 생성
   */
  async createFile(dirPath: string, name: string): Promise<ExplorerOperationResult> {
    const result = await this.service.createFile(dirPath, name);
    if (result.success) {
      await this.refresh();
    }
    return result;
  }

  /**
   * 폴더 생성
   */
  async createDirectory(dirPath: string, name: string): Promise<ExplorerOperationResult> {
    const result = await this.service.createDirectory(dirPath, name);
    if (result.success) {
      // 새 폴더가 생성된 부모 폴더를 펼치기
      if (dirPath) {
        const newExpandedPaths = new Set(this.state.expandedPaths);
        newExpandedPaths.add(dirPath);
        this.setState({ expandedPaths: newExpandedPaths });
      }
      await this.refresh();
    }
    return result;
  }

  /**
   * 이름 변경
   */
  async rename(targetPath: string, newName: string): Promise<ExplorerOperationResult> {
    const result = await this.service.rename(targetPath, newName);
    if (result.success) {
      await this.refresh();
    }
    return result;
  }

  /**
   * 삭제
   */
  async delete(targetPath: string): Promise<ExplorerOperationResult> {
    const result = await this.service.delete(targetPath);
    if (result.success) {
      // 삭제된 항목이 선택되어 있었으면 선택 해제
      if (this.state.selectedPath === targetPath) {
        this.setState({ selectedPath: null });
      }
      await this.refresh();
    }
    return result;
  }

  /**
   * 시스템 앱으로 열기
   */
  async openWithSystemApp(targetPath: string): Promise<ExplorerOperationResult> {
    return this.service.openWithSystemApp(targetPath);
  }

  /**
   * Finder/Explorer에서 보기
   */
  showInFolder(targetPath: string): void {
    this.service.showInFolder(targetPath);
  }

  /**
   * 리소스 정리
   */
  destroy(): void {
    this.listeners.clear();
  }
}
