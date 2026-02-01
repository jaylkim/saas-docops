/**
 * Explorer Service - Node.js fs 래퍼
 *
 * 파일 시스템 작업 수행 (숨김 파일 포함)
 */

import * as fs from "fs";
import * as path from "path";
import { FileEntry, ExplorerOperationResult } from "./explorer-types";

// Electron shell은 require로 가져옴 (Obsidian 환경)
const electron = require("electron");
const shell = electron.shell;

export class ExplorerService {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * 디렉토리 읽기 (숨김 파일 포함)
   */
  async readDirectory(dirPath: string = ""): Promise<FileEntry[]> {
    const fullPath = path.join(this.basePath, dirPath);

    try {
      const items = await fs.promises.readdir(fullPath, { withFileTypes: true });
      const entries: FileEntry[] = [];

      for (const item of items) {
        const itemPath = dirPath ? path.join(dirPath, item.name) : item.name;
        const absolutePath = path.join(fullPath, item.name);
        const isHidden = item.name.startsWith(".");
        const extension = item.isFile() ? path.extname(item.name) : "";

        let size: number | undefined;
        let modifiedTime: Date | undefined;

        try {
          const stat = await fs.promises.stat(absolutePath);
          size = stat.size;
          modifiedTime = stat.mtime;
        } catch {
          // 권한 등의 문제로 stat 실패 시 무시
        }

        entries.push({
          name: item.name,
          path: itemPath,
          absolutePath,
          isDirectory: item.isDirectory(),
          isHidden,
          extension,
          size,
          modifiedTime,
        });
      }

      // 정렬: 폴더 먼저, 그 다음 이름순
      entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name, "ko");
      });

      return entries;
    } catch (error) {
      console.error("Failed to read directory:", error);
      return [];
    }
  }

  /**
   * 재귀적으로 디렉토리 트리 읽기
   */
  async readDirectoryRecursive(
    dirPath: string = "",
    expandedPaths: Set<string>
  ): Promise<FileEntry[]> {
    const entries = await this.readDirectory(dirPath);
    const result: FileEntry[] = [];

    for (const entry of entries) {
      result.push(entry);

      if (entry.isDirectory && expandedPaths.has(entry.path)) {
        const children = await this.readDirectoryRecursive(entry.path, expandedPaths);
        result.push(...children);
      }
    }

    return result;
  }

  /**
   * 파일 생성
   */
  async createFile(dirPath: string, name: string): Promise<ExplorerOperationResult> {
    try {
      const fullPath = path.join(this.basePath, dirPath, name);

      // 이미 존재하는지 확인
      if (fs.existsSync(fullPath)) {
        return {
          success: false,
          message: "이미 존재하는 파일입니다",
          error: `'${name}' 파일이 이미 존재합니다.`,
        };
      }

      await fs.promises.writeFile(fullPath, "", "utf-8");
      return {
        success: true,
        message: `'${name}' 파일이 생성되었습니다`,
      };
    } catch (error) {
      return {
        success: false,
        message: "파일 생성 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 폴더 생성
   */
  async createDirectory(dirPath: string, name: string): Promise<ExplorerOperationResult> {
    try {
      const fullPath = path.join(this.basePath, dirPath, name);

      // 이미 존재하는지 확인
      if (fs.existsSync(fullPath)) {
        return {
          success: false,
          message: "이미 존재하는 폴더입니다",
          error: `'${name}' 폴더가 이미 존재합니다.`,
        };
      }

      await fs.promises.mkdir(fullPath, { recursive: true });
      return {
        success: true,
        message: `'${name}' 폴더가 생성되었습니다`,
      };
    } catch (error) {
      return {
        success: false,
        message: "폴더 생성 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 이름 변경
   */
  async rename(targetPath: string, newName: string): Promise<ExplorerOperationResult> {
    try {
      const fullPath = path.join(this.basePath, targetPath);
      const parentDir = path.dirname(fullPath);
      const newPath = path.join(parentDir, newName);

      // 새 이름이 이미 존재하는지 확인
      if (fs.existsSync(newPath)) {
        return {
          success: false,
          message: "이름 변경 실패",
          error: `'${newName}'이(가) 이미 존재합니다.`,
        };
      }

      await fs.promises.rename(fullPath, newPath);
      return {
        success: true,
        message: `'${newName}'으로 이름이 변경되었습니다`,
      };
    } catch (error) {
      return {
        success: false,
        message: "이름 변경 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 삭제 (휴지통으로 이동)
   */
  async delete(targetPath: string): Promise<ExplorerOperationResult> {
    try {
      const fullPath = path.join(this.basePath, targetPath);

      // Electron shell.trashItem으로 휴지통 이동
      await shell.trashItem(fullPath);
      return {
        success: true,
        message: "휴지통으로 이동되었습니다",
      };
    } catch (error) {
      return {
        success: false,
        message: "삭제 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 파일 열기
   * - .md 파일은 Obsidian에서 열기 (앱 참조 필요)
   * - 그 외 파일은 시스템 기본 앱으로 열기
   */
  async openWithSystemApp(targetPath: string): Promise<ExplorerOperationResult> {
    try {
      const fullPath = path.join(this.basePath, targetPath);

      // Electron shell.openPath로 시스템 앱에서 열기
      const error = await shell.openPath(fullPath);
      if (error) {
        return {
          success: false,
          message: "파일 열기 실패",
          error,
        };
      }

      return {
        success: true,
        message: "파일이 열렸습니다",
      };
    } catch (error) {
      return {
        success: false,
        message: "파일 열기 실패",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Finder/Explorer에서 보기
   */
  showInFolder(targetPath: string): void {
    const fullPath = path.join(this.basePath, targetPath);
    shell.showItemInFolder(fullPath);
  }

  /**
   * 파일 존재 여부 확인
   */
  exists(targetPath: string): boolean {
    const fullPath = path.join(this.basePath, targetPath);
    return fs.existsSync(fullPath);
  }

  /**
   * 파일인지 확인
   */
  async isFile(targetPath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.basePath, targetPath);
      const stat = await fs.promises.stat(fullPath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  /**
   * 디렉토리인지 확인
   */
  async isDirectory(targetPath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.basePath, targetPath);
      const stat = await fs.promises.stat(fullPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}
