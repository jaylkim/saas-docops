# SaaS DocOps

Obsidian 플러그인으로 Claude Code를 GUI로 관리하는 비개발자 친화 도구입니다.

## 핵심 기능

- **내장 터미널**: xterm.js + node-pty 기반 터미널에서 Claude Code 직접 실행
- **MCP 서버 관리**: GUI로 MCP 서버 설정 및 Health Check
- **온보딩 마법사**: 7단계 설정 마법사로 쉬운 초기 설정
- **프로젝트 관리**: Vault 기반 프로젝트별 설정 분리

## 설치

### 요구사항

- Obsidian v1.5.0 이상
- Node.js 18 이상
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)

### 설치 방법

1. 이 저장소를 클론합니다
2. `npm install`로 의존성 설치
3. `npm run build`로 빌드
4. `main.js`, `manifest.json`, `styles.css`를 Obsidian 플러그인 폴더에 복사

## 개발

```bash
npm run build          # TypeScript 체크 + 프로덕션 빌드
npm run dev            # watch 모드
npm run deploy:test    # 테스트 vault로 배포
npm run dev:watch      # watch + 자동 배포
```

### node-pty 재빌드

Obsidian Electron 버전에 맞춰 재빌드가 필요합니다:

```bash
# Obsidian 콘솔에서 버전 확인: process.versions.electron
npx electron-rebuild -f -w node-pty -v 33.3.2
```

## 프로젝트 구조

```
src/
├── main.ts                 # 플러그인 진입점
├── constants.ts            # 설정 타입/기본값
├── styles.css              # 전역 스타일
├── terminal/               # xterm.js + node-pty 터미널
├── wizard/                 # 온보딩 마법사 (7단계)
├── settings/               # 설정 탭 + MCP 모달
└── mcp/                    # MCP 프리셋 + Health Check
```

## MCP 설정

MCP 서버 설정은 두 가지 레벨로 관리됩니다:

- **사용자 레벨**: `~/.claude.json` (모든 프로젝트 공통)
- **프로젝트 레벨**: `vault/.mcp.json` (Git 공유 가능)

## 라이센스

Apache License 2.0 - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## Acknowledgments

This project was inspired by [O-Terminal](https://github.com/Quorafind/O-Terminal) by Boninall.
