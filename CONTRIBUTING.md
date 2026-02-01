# Contributing to SaaS DocOps

## 개발 환경 설정

```bash
git clone https://github.com/jaylkim/saas-docops.git
cd saas-docops
npm install
```

## 빌드 명령어

```bash
npm run build            # TypeScript 체크 + 프로덕션 빌드
npm run dev              # watch 모드
npm run rebuild:electron # node-pty ABI 재빌드 (Obsidian Electron 버전에 맞춤)
```

## 프로젝트 구조

```
src/
├── main.ts              # 플러그인 진입점
├── constants.ts         # 설정 타입/기본값
├── styles.css           # 전역 스타일
├── terminal/            # xterm.js + node-pty 터미널
├── git/                 # Git 상태/커밋/브랜치 관리
├── explorer/            # 파일 탐색기
├── wizard/              # 온보딩 마법사 (7단계)
├── settings/            # 설정 탭
├── mcp/                 # MCP 프리셋 + Health Check
└── vault-manager/       # 다중 Vault 설치 관리
```

## MCP 설정 파일 위치

- **사용자 레벨**: `~/.claude.json` (모든 프로젝트 공통)
- **프로젝트 레벨**: `<vault>/.mcp.json` (Git 공유 가능)

## 테스트

빌드 후 Obsidian vault에 수동으로 복사하여 테스트:

```bash
npm run build
cp dist/main.js "<Your Vault>/.obsidian/plugins/saas-docops/"
cp styles.css "<Your Vault>/.obsidian/plugins/saas-docops/"
```

Obsidian에서 Cmd+R로 리로드하면 변경사항이 반영됩니다.
