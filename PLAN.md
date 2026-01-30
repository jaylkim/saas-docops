# SaaS DocOps - 개발 계획

## 현재 상태

**Phase 2: 터미널 통합** ✅ 완료 (2025-01-31)

## 전체 로드맵

### Phase 1: 초기 설정 ✅
- [x] 프로젝트 구조 생성 (package.json, tsconfig.json, esbuild)
- [x] 플러그인 진입점 (main.ts)
- [x] 터미널 뷰 stub
- [x] 에이전트 뷰 stub (React)
- [x] 설정 탭 기본 구현
- [x] 빌드 테스트 완료

### Phase 2: 터미널 통합 ✅
- [x] xterm.js + node-pty 연결
- [x] electron-bridge 구현 (ABI 호환성 체크)
- [x] PTYManager (생명주기 관리)
- [x] SessionManager (세션 관리)
- [x] Shadow DOM 격리 (Obsidian CSS 분리)
- [x] 양방향 I/O (Terminal ↔ PTY)
- [x] ResizeObserver 기반 자동 크기 조정
- [x] 환경변수 주입 (API 키)
- [x] 개발/배포 스크립트

**생성된 파일:**
```
src/terminal/
├── index.ts              # 모듈 export
├── terminal-view.ts      # xterm.js 뷰 (전체 구현)
├── electron-bridge.ts    # node-pty 로더
├── pty-manager.ts        # PTY 생명주기
└── terminal-session.ts   # 세션 관리

scripts/
├── deploy-test.sh        # 테스트 배포
└── dev-watch.sh          # watch + 자동 배포
```

### Phase 3: 에이전트 통합 🔲
- [ ] Agent Client fork 코드 분석
- [ ] ACP SDK 연결
- [ ] 스트리밍 응답
- [ ] @notename 멘션 시스템
- [ ] 메시지 히스토리

### Phase 4: 환경변수 GUI 🔲
- [ ] 온보딩 위자드 UI
- [ ] 환경 점검 (Node.js, Git, Claude Code)
- [ ] API 키 테스트 기능
- [ ] 자동 설치 기능

### Phase 5: MCP 연동 🔲
- [ ] .claude/settings.json 관리
- [ ] Slack MCP 서버 연동
- [ ] Confluence MCP 서버 연동
- [ ] Bitbucket MCP 서버 연동

### Phase 6: Quick Actions 🔲
- [ ] Quick Actions UI
- [ ] Git Sync 액션
- [ ] Slack 공유 액션
- [ ] Confluence 동기화 액션
- [ ] 사용자 정의 액션

### Phase 7: 팀 설정 & 문서화 🔲
- [ ] vault 내 팀 설정 공유 (agents/, skills/)
- [ ] 사용자 문서
- [ ] 개발자 문서

---

## 개발 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run build` | TypeScript 체크 + 프로덕션 빌드 |
| `npm run dev` | watch 모드 (파일 변경 감지) |
| `npm run deploy:test` | 빌드 후 테스트 vault로 배포 |
| `npm run dev:watch` | watch + 자동 배포 (개발용) |
| `npm run rebuild:electron` | node-pty ABI 재빌드 |

### node-pty 재빌드 (Electron 버전 맞추기)
```bash
# Obsidian 콘솔에서 Electron 버전 확인
process.versions.electron  # 예: '33.3.2'

# 해당 버전으로 재빌드
npx electron-rebuild -f -w node-pty -v 33.3.2

# 테스트 vault에 배포
npm run deploy:test
```

### 테스트 vault 경로
```
/Users/jay/projects/temp
```

### 다른 vault로 배포
```bash
./scripts/deploy-test.sh /path/to/vault
```

---

## 참조 리포지토리

- **O-Terminal**: https://github.com/Quorafind/O-Terminal (Apache 2.0)
- **Agent Client**: https://github.com/anthropics/obsidian-agent-client (Apache 2.0)

---

## 세션 기록

### 세션 1 (2025-01-31)
- Phase 1 완료
- 기본 플러그인 구조 생성
- 터미널/에이전트 뷰 stub 구현
- Obsidian에서 로드 테스트 성공

### 세션 2 (2025-01-31)
- Phase 2 완료
- 터미널 통합 전체 구현:
  - `src/terminal/electron-bridge.ts` - node-pty 로더, ABI 체크
  - `src/terminal/pty-manager.ts` - PTY 생명주기 관리
  - `src/terminal/terminal-session.ts` - 세션 관리
  - `src/terminal/terminal-view.ts` - xterm.js 전체 구현
- Shadow DOM으로 CSS 격리
- 개발 스크립트 추가 (`deploy:test`, `dev:watch`)
- node-pty ABI 이슈 해결:
  - Obsidian Electron 33.3.2에 맞춰 재빌드
  - 플러그인 폴더에 node_modules 복사 방식
  - `initElectronBridge()`로 절대 경로 로드
- "Integration AI Workspace" → "SaaS DocOps" 명칭 통일
