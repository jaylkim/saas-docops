# SaaS DocOps

Obsidian에서 Claude Code를 GUI로 관리하는 비개발자 친화 플러그인입니다.

터미널 명령어 없이도 Git 협업, MCP 서버 설정, Claude Code 실행을 할 수 있습니다.

## 주요 기능

### 내장 터미널
- xterm.js + node-pty 기반 풀 터미널 에뮬레이터
- Claude Code 직접 실행 가능
- Obsidian 테마와 독립된 VS Code 다크 테마

### 프로젝트 관리 (Git View)
- **Home 탭**: 현재 브랜치, 변경 파일 수, 동기화 상태 표시
- **Workspace 탭**: 브랜치 생성/전환, 스태시 관리
- **Review 탭**: GitHub/GitLab/Bitbucket PR 링크 표시
- **Conflict 탭**: 머지 충돌 감지 및 해결

### AI 커밋 메시지
- 선택한 파일 기반으로 AI가 커밋 메시지 자동 생성
- 원클릭 커밋 & 푸시

### 파일 탐색기
- Vault 파일 트리 탐색
- 파일/폴더 생성, 이름 변경, 삭제, 복제
- 우클릭 컨텍스트 메뉴

### MCP 서버 관리
- Slack, Atlassian(Jira/Confluence) 프리셋 제공
- 서버별 Health Check
- 활성화/비활성화 토글
- 사용자 레벨(`~/.claude.json`) 또는 프로젝트 레벨(`.mcp.json`) 설정

### 7단계 설정 마법사
1. 환영 & MCP 설정 레벨 선택
2. 환경 점검 (Git, Node.js, SSH 등)
3. Anthropic API 키 설정
4. Slack 연동
5. Atlassian 연동
6. Bitbucket SSH 설정
7. 완료 요약

---

## 설치 방법

### 요구사항

| 항목 | 최소 버전 | 비고 |
|------|----------|------|
| macOS | 10.15+ | Apple Silicon 및 Intel 지원 |
| Obsidian | 1.11.0+ | 데스크톱 전용 |
| Node.js | 18+ | `node --version`으로 확인 |
| Claude Code | 최신 | 설치 스크립트가 자동 설치 가능 |

### 원클릭 설치 (권장)

터미널에서 아래 명령어를 실행하세요:

```bash
curl -sSL https://raw.githubusercontent.com/jaylkim/saas-docops/main/install.sh | bash
```

설치 스크립트가 자동으로:
- Claude Code CLI 설치 여부 확인 (없으면 설치 제안)
- Obsidian vault 자동 탐지
- 최신 릴리즈 다운로드 및 설치
- node-pty 재빌드 (필요시)
- 플러그인 자동 활성화

### 설치 옵션

```bash
# 비대화형 모드 (기본값 자동 선택)
curl -sSL ... | bash -s -- --yes

# 특정 vault 지정
curl -sSL ... | bash -s -- --vault "/path/to/your/vault"

# 설치 후 Obsidian 자동 열기 비활성화
curl -sSL ... | bash -s -- --no-open

# node-pty 강제 재빌드
curl -sSL ... | bash -s -- --rebuild

# 요구사항 무시하고 설치
curl -sSL ... | bash -s -- --force
```

### 수동 설치

1. [Releases](https://github.com/jaylkim/saas-docops/releases) 페이지에서 플랫폼에 맞는 zip 다운로드
   - `saas-docops-darwin-arm64.zip` (Apple Silicon)
   - `saas-docops-darwin-x64.zip` (Intel Mac)

2. 압축 해제 후 파일들을 복사:
   ```
   <Your Vault>/.obsidian/plugins/saas-docops/
   ├── main.js
   ├── manifest.json
   ├── styles.css
   └── node_modules/
   ```

3. Obsidian 재시작

4. 설정 > 커뮤니티 플러그인 > SaaS DocOps 활성화

5. node-pty 재빌드 (터미널 기능 사용시):
   ```bash
   cd "<Your Vault>/.obsidian/plugins/saas-docops"
   npx electron-rebuild -f -w node-pty -v $(defaults read /Applications/Obsidian.app/Contents/Info.plist ElectronVersion)
   ```

---

## 사용 방법

### 첫 실행

1. 플러그인 활성화 후 자동으로 **설정 마법사**가 열립니다
2. 각 단계를 따라 환경을 설정하세요
3. 선택적 연동(Slack, Atlassian)은 건너뛰기 가능

### 터미널 열기

- 좌측 리본에서 터미널 아이콘 클릭
- 또는 명령어 팔레트(Cmd+P)에서 "터미널 열기" 검색

### Git 작업

1. 좌측 리본에서 Git 아이콘 클릭
2. **Home 탭**에서 현재 상태 확인
3. 변경된 파일 체크박스 선택
4. "AI 메시지 생성" 버튼으로 커밋 메시지 자동 작성
5. "커밋" 버튼 클릭

### MCP 서버 추가

1. 설정 > SaaS DocOps > MCP 서버 관리
2. 프리셋(Slack, Atlassian) 선택 또는 수동 추가
3. 토큰/키 입력
4. Health Check로 연결 확인

---

## 문제 해결

### 터미널이 열리지 않음

node-pty가 Obsidian Electron 버전과 맞지 않을 수 있습니다:

```bash
cd "<Your Vault>/.obsidian/plugins/saas-docops"
npx electron-rebuild -f -w node-pty -v $(defaults read /Applications/Obsidian.app/Contents/Info.plist ElectronVersion)
```

### Claude Code를 찾을 수 없음

1. Claude Code가 설치되어 있는지 확인:
   ```bash
   claude --version
   ```

2. 설치되어 있지 않다면:
   ```bash
   curl -fsSL https://claude.ai/install.sh | bash
   ```

### MCP 서버 연결 실패

- 토큰이 올바른지 확인
- `~/.claude.json` 파일 권한 확인 (읽기/쓰기 가능해야 함)
- Claude Code 재시작 필요 (MCP 설정 변경 후)

---

## 개발

### 빌드 명령어

```bash
npm install              # 의존성 설치
npm run build            # TypeScript 체크 + 프로덕션 빌드
npm run dev              # watch 모드
npm run deploy:test      # 테스트 vault로 배포
npm run dev:watch        # watch + 자동 배포
npm run rebuild:electron # node-pty ABI 재빌드
```

### 프로젝트 구조

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
└── mcp/                 # MCP 프리셋 + Health Check
```

### MCP 설정 파일 위치

- **사용자 레벨**: `~/.claude.json` (모든 프로젝트 공통)
- **프로젝트 레벨**: `<vault>/.mcp.json` (Git 공유 가능)

---

## 라이센스

Apache License 2.0 - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## Acknowledgments

This project was inspired by [O-Terminal](https://github.com/Quorafind/O-Terminal) by Boninall.
