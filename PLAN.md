# SaaS DocOps - 개발 계획

## 현재 상태

**Phase 4: MCP 연동 확장** ✅ 완료 (2025-02-01)

## 프로젝트 방향

**Terminal-first 접근**: Obsidian 내에서 Claude Code CLI를 직접 실행하는 터미널 통합에 집중.

- Agent Panel (채팅 UI) 구현은 제외
- Claude Code의 모든 기능을 터미널에서 직접 사용
- GUI는 환경변수 관리, MCP 설정에만 집중

## 전체 로드맵

### Phase 1: 초기 설정 ✅
- [x] 프로젝트 구조 생성 (package.json, tsconfig.json, esbuild)
- [x] 플러그인 진입점 (main.ts)
- [x] 터미널 뷰 stub
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

### Phase 3: 환경변수 GUI (설정 마법사) ✅
- [x] 온보딩 위자드 Modal UI (7단계)
- [x] 환경 점검 (Node.js, Git, Claude Code, node-pty)
- [x] Claude 로그인 (OAuth 상태 확인 + API 키 입력)
- [x] Slack MCP 설정 (단계별 가이드 + 토큰 저장)
- [x] Atlassian MCP 설정 (단계별 가이드 + 토큰 저장)
- [x] Bitbucket SSH 키 설정 (생성 + 복사 + 등록 안내)
- [x] MCP 서버 자동 추가 (~/.claude/settings.json)
- [x] 비개발자 친화 UI (외부 링크 대신 인라인 가이드)

**생성된 파일:**
```
src/wizard/
├── index.ts                      # 모듈 export
├── setup-wizard-modal.ts         # 메인 Modal 클래스 (7단계 마법사)
├── environment-checker.ts        # 환경 점검 + MCP/SSH 유틸리티
└── steps/
    ├── welcome-step.ts           # Step 1: 시작
    ├── environment-check-step.ts # Step 2: 환경 점검
    ├── claude-login-step.ts      # Step 3: Claude 로그인
    ├── slack-setup-step.ts       # Step 4: Slack MCP
    ├── atlassian-setup-step.ts   # Step 5: Atlassian MCP
    ├── bitbucket-ssh-step.ts     # Step 6: Bitbucket SSH
    └── complete-step.ts          # Step 7: 완료

src/styles.css                    # 마법사 스타일
```

**수정된 파일:**
- `src/main.ts` - 첫 실행 시 마법사 호출, CSS import
- `src/constants.ts` - wizardCompleted, atlassianEmail 필드 추가
- `src/settings/settings-tab.ts` - "마법사 다시 실행" 버튼 추가

### Phase 4: MCP 연동 확장 ✅
- [x] .claude/settings.json 자동 관리 (Phase 3에서 완료)
- [x] MCP 서버 상태 표시 (설정 탭) - Health Check 구현
- [x] 서버 활성화/비활성화 토글
- [x] 추가 MCP 서버 지원 (GitHub, Filesystem, 커스텀, 원격 SSE/HTTP)

**생성된 파일:**
```
src/mcp/
├── index.ts              # 모듈 export
├── presets.ts            # MCP 서버 프리셋 (Slack, Atlassian, GitHub 등)
└── health-checker.ts     # MCP 서버 Health Check 모듈

src/settings/
├── settings-tab.ts       # 설정 탭 (Health 상태 표시 추가)
└── mcp-modals.ts         # MCP 서버 추가/편집 모달
```

**Health Check 기능:**
- stdio 서버: `child_process.spawn()` 테스트 (2초 timeout)
- http/sse 서버: `fetch()` HEAD 요청 (5초 timeout, 401/403도 healthy)
- 상태: ✅ 연결됨 | ❌ 오류 | ⏸️ 비활성 | 🔄 점검 중
- 개별/전체 서버 상태 점검 버튼

### Phase 5: Quick Actions 🔲
- [ ] Quick Actions UI (리본 또는 명령 팔레트)
- [ ] 자주 쓰는 Claude 명령 원클릭 실행
- [ ] 사용자 정의 액션

### Phase 6: 팀 설정 & 문서화 🔲
- [ ] vault 내 팀 설정 공유 (.claude/, agents/, skills/)
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

---

## 세션 기록

### 세션 1 (2025-01-31)
- Phase 1 완료
- 기본 플러그인 구조 생성
- 터미널 뷰 stub 구현
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

### 세션 3 (2025-01-31)
- Agent Panel 구현 시도 후 제거
  - Claude Code CLI 스폰 + 스트리밍 응답
  - @notename 멘션 시스템 (자동완성)
  - 구현이 매끄럽지 않아 제거 결정
- **Terminal-first 전략으로 방향 전환**
  - Claude Code의 모든 기능을 터미널에서 직접 사용
  - GUI는 환경변수/MCP 관리에만 집중
- OAuth 지원 추가 (Claude Max 구독자용)

### 세션 4 (2025-01-31)
- Phase 3 완료: 환경변수 GUI (설정 마법사)
- 7단계 온보딩 마법사 구현:
  1. 시작 (플러그인 소개)
  2. 환경 점검 (Node.js, Git, Claude Code, node-pty)
  3. Claude 로그인 (OAuth 또는 API 키)
  4. Slack MCP 설정 (Bot Token 발급 가이드 + 저장)
  5. Atlassian MCP 설정 (API Token 발급 가이드 + 저장)
  6. Bitbucket SSH (키 생성/복사 + 등록 안내)
  7. 완료 (설정 요약)
- 비개발자 친화 UI:
  - 외부 링크 대신 인라인 단계별 가이드
  - MCP 서버 자동 추가 (~/.claude/settings.json)
  - SSH 키 생성 기능 내장
  - "터미널에서 설치" 버튼으로 명령 실행
- PATH 문제 해결 (~/.local/bin, Homebrew 경로 추가)
- CSS 로드 문제 해결 (main.ts에서 import)

### 세션 5 (2025-01-31)
- 터미널 성능 최적화:
  - **문제**: Claude Code 시작이 일반 터미널(iTerm)보다 느림
  - **원인**: PTY에서 오는 모든 데이터 청크를 즉시 xterm.js에 write하여 매번 렌더링 트리거
  - **해결책 1 - 데이터 배칭** ✅:
    - `requestAnimationFrame`으로 여러 데이터 청크를 모아서 한 번에 렌더링
    - `writeBuffer`, `flushScheduled` 플래그로 배칭 관리
    - `handlePTYData()` → 버퍼에 추가 → `flushBuffer()`로 일괄 write
  - **해결책 2 - WebGL 렌더러** ❌ (호환성 문제):
    - `@xterm/addon-webgl` 추가 시도
    - Obsidian Shadow DOM 환경에서 터미널이 렌더링되지 않는 문제 발생
    - 비활성화하고 기본 canvas 렌더러 사용
  - **해결책 3 - ResizeObserver 디바운싱** ✅:
    - 리사이즈 이벤트 100ms 디바운싱으로 불필요한 계산 방지
- 의존성 추가: `@xterm/addon-webgl` (현재 미사용, 추후 호환성 해결 시 활성화 가능)

### 세션 6 (2025-02-01)
- Phase 4 완료: MCP 연동 확장
- MCP 서버 Health Check 기능 구현:
  - `src/mcp/health-checker.ts` 생성
  - stdio 서버: 프로세스 스폰 테스트 (2초 timeout)
  - http/sse 서버: HEAD 요청 테스트 (5초 timeout)
  - 401/403 응답도 healthy로 처리 (서버는 살아있음)
- 설정 탭 UI 개선:
  - Health 상태 배지 (색상 + 아이콘으로 구분)
  - 개별 서버 테스트 버튼 (🔍)
  - "전체 상태 점검" 버튼
  - 에러 메시지 인라인 표시
- CSS 추가:
  - `.mcp-health-*` 상태별 스타일
  - `@keyframes mcp-pulse` 점검 중 애니메이션

### 세션 7 (2025-02-01)
- UI/UX 안정성 개선:
  - **Wizard Race Condition 해결**: `setTimeout` 대신 polling (`isReady` 체크) 방식으로 변경하여 터미널 초기화 확실히 대기
  - **Terminal Auto-focus**: 터미널 열릴 때 자동 포커스 추가 (`terminal.focus()`)
  - **MCP Remote 연결 테스트**: 원격 서버 추가 시 `HEAD` 요청으로 연결 확인 기능 추가
- 빌드 및 검증 완료

### 세션 8 (2025-02-01)
- Wizard UX 개선:
  - **Step 4 제거 및 통합**: 독립적인 MCP 설정 위치 단계를 제거하고, Step 1 (Welcome) 하단의 옵션으로 통합하여 흐름 끊김 방지
  - **동적 내비게이션 버튼 (Smart Navigation)**:
    - 단계별 상태 동기화 구현: 설정 완료 시 즉시 "건너뛰기" -> "다음"으로 전환
    - 미완료 시 "건너뛰기" 버튼 유지
  - **접근성 개선**: 
    - 명령어 팔레트(`Cmd+P`)에 "설정 마법사 열기" 추가
