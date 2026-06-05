# Staging Pilot Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Task 15에서 만든 스테이징 구성물을 실제 외부 체험 운영에 사용할 수 있도록 배포 런북, 원격 스모크 검증, 체험 계정 전달 절차, 종료 정리 절차를 고정한다.

**Architecture:** 기존 `docker-compose.staging.yml`은 유지하고, 운영자는 `.env.staging`와 HTTPS 앞단을 준비한 뒤 같은 검증 명령으로 로컬과 서버를 확인한다. Playwright와 shell smoke를 원격 URL에 재사용할 수 있게 만들고, 체험자에게 전달할 문서와 운영자용 런북을 분리한다.

**Tech Stack:** Spring Boot, React/Vite, nginx, PostgreSQL, Docker Compose, Playwright, Bash, Markdown.

---

## Scope And Guardrails

- 기준 브랜치는 `main`, 기준 커밋은 `56feb60`이다.
- 현재 작업트리에는 인수인계 문서 수정이 있으므로, 실행 전 `git status --short`로 사용자 변경을 다시 확인한다.
- 사용자가 별도로 요청하기 전까지 `git add`, `git commit`, `git push`를 실행하지 않는다.
- Docker Desktop이 꺼져 있으면 compose 정적 검증과 문서 검증까지만 수행하고, 실제 기동 검증은 Docker가 켜진 뒤 재실행한다.
- 이번 Task 18은 실제 운영 배포가 아니라 5~10명 외부 체험을 여는 준비다. Google Calendar 연동, 공휴일/반복 일정, 정식 운영용 SSO, 메일/카카오 알림, S3/MinIO 전환은 제외한다.

## File Structure

- Modify: `e2e/playwright.config.ts`  
  `E2E_BASE_URL` 환경변수로 로컬과 원격 스테이징 URL을 모두 검증할 수 있게 한다.
- Create: `scripts/staging-smoke.sh`  
  frontend, PWA manifest, `/api/auth/login` 프록시 상태를 빠르게 확인하는 shell smoke.
- Create: `docs/staging-operations-runbook.md`  
  스테이징 서버 준비, secret 생성, 배포, 업데이트, 로그 확인, 종료 정리를 다루는 운영자용 런북.
- Create: `docs/staging-tester-account-packet.md`  
  체험자별 계정 전달 메시지와 역할별 시나리오를 담는 복사 가능한 문서.
- Modify: `docs/staging-test-guide.md`  
  체험 시작 전 준비물, 문의 시 전달할 정보, 캘린더 체험 시나리오를 보강한다.
- Modify: `docs/deployment-readiness-checklist.md`  
  Task 18의 외부 체험 개시 체크리스트와 종료 체크리스트를 추가한다.
- Modify: `docs/admin-user-guide.md`  
  관리자 관점에서 체험 계정 배정, 비밀번호 초기화, 체험 종료 정리 절차를 연결한다.
- Modify: `README.md`  
  런북과 계정 전달 문서 링크를 추가한다.
- Create: `docs/handoffs/2026-06-05-task-18-staging-pilot-readiness.md`  
  구현 완료 후 새 채팅에서 이어갈 수 있는 Task 18 인수인계.

---

### Task 1: Make E2E Base URL Configurable

**Files:**
- Modify: `e2e/playwright.config.ts`
- Test: `e2e/tests/mobile-pwa-staging.spec.ts`

- [ ] **Step 1: Update Playwright config**

Replace `e2e/playwright.config.ts` with:

```ts
import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL,
    trace: 'on-first-retry'
  }
});
```

- [ ] **Step 2: Run local mobile smoke when Docker app is running**

Run:

```bash
cd /Users/kyh/theieum/e2e
E2E_BASE_URL=http://localhost:3000 npm run test -- mobile-pwa-staging.spec.ts
```

Expected:

```text
1 passed
```

If Docker is not running, record the Docker state in the Task 18 handoff and run this same command after `docker compose up -d --build frontend`.

- [ ] **Step 3: Document remote URL usage in the handoff**

Use this command format in `docs/handoffs/2026-06-05-task-18-staging-pilot-readiness.md`:

```bash
cd /Users/kyh/theieum/e2e
E2E_BASE_URL=https://approval-staging.example.com npm run test -- mobile-pwa-staging.spec.ts
```

Expected for a live staging server:

```text
1 passed
```

---

### Task 2: Add A Staging Smoke Script

**Files:**
- Create: `scripts/staging-smoke.sh`
- Test: run the script against local or remote staging URL

- [ ] **Step 1: Create `scripts/staging-smoke.sh`**

Create `scripts/staging-smoke.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-${STAGING_BASE_URL:-http://localhost:3000}}"
BASE_URL="${BASE_URL%/}"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

curl_cmd() {
  if [ "${STAGING_INSECURE_TLS:-0}" = "1" ]; then
    curl -k "$@"
  else
    curl "$@"
  fi
}

status_code() {
  local url="$1"
  local label="$2"
  local code

  if ! code="$(curl_cmd -sS -o /dev/null -w '%{http_code}' "${url}")"; then
    fail "${label} request failed"
  fi

  printf '%s' "${code}"
}

headers_for() {
  local url="$1"
  local label="$2"
  local headers

  if ! headers="$(curl_cmd -sS -D - -o /dev/null "${url}")"; then
    fail "${label} request failed"
  fi

  printf '%s\n' "${headers}"
}

echo "Checking staging target: ${BASE_URL}"

FRONTEND_STATUS="$(status_code "${BASE_URL}/" "frontend /")"
if [ "${FRONTEND_STATUS}" != "200" ]; then
  fail "frontend / returned HTTP ${FRONTEND_STATUS}"
fi

MANIFEST_STATUS="$(status_code "${BASE_URL}/manifest.webmanifest" "manifest.webmanifest")"
if [ "${MANIFEST_STATUS}" != "200" ]; then
  fail "manifest.webmanifest returned HTTP ${MANIFEST_STATUS}"
fi

LOGIN_HEADERS="$(headers_for "${BASE_URL}/api/auth/login" "/api/auth/login")"
if ! printf '%s\n' "${LOGIN_HEADERS}" | grep -Eq '^HTTP/.* (401|405)'; then
  fail "/api/auth/login did not return HTTP 401 or 405 for GET"
fi

if ! printf '%s\n' "${LOGIN_HEADERS}" | grep -Eiq '^allow:.*POST'; then
  fail "/api/auth/login response does not expose Allow: POST"
fi

echo "PASS: frontend, manifest, and API proxy smoke checks passed"
```

- [ ] **Step 2: Make the script executable**

Run:

```bash
cd /Users/kyh/theieum
chmod +x scripts/staging-smoke.sh
```

- [ ] **Step 3: Run smoke against local app when Docker app is running**

Run:

```bash
cd /Users/kyh/theieum
scripts/staging-smoke.sh http://localhost:3000
```

Expected:

```text
PASS: frontend, manifest, and API proxy smoke checks passed
```

- [ ] **Step 4: Run smoke against remote staging after deployment**

Run:

```bash
cd /Users/kyh/theieum
STAGING_BASE_URL=https://approval-staging.example.com scripts/staging-smoke.sh
```

Expected:

```text
PASS: frontend, manifest, and API proxy smoke checks passed
```

---

### Task 3: Write The Operator Runbook

**Files:**
- Create: `docs/staging-operations-runbook.md`
- Modify: `README.md`
- Modify: `docs/deployment-readiness-checklist.md`

- [ ] **Step 1: Create the runbook**

Create `docs/staging-operations-runbook.md`:

````markdown
# 스테이징 외부 체험 운영 런북

작성일: 2026-06-05

이 문서는 더이음 전자결재 앱을 5~10명 외부 체험자에게 열기 위한 운영자용 절차다. 이 환경은 정식 운영 환경이 아니며 실제 개인정보와 실제 영수증을 넣지 않는다.

## 1. 준비물

- Linux 서버 또는 Docker Compose를 실행할 수 있는 VM
- HTTPS로 접근 가능한 도메인
- Docker와 Docker Compose plugin
- 배포 대상 커밋: `56feb60` 이후 Task 18 변경 포함 커밋
- 체험 담당 관리자 계정
- 체험자별 계정 전달 채널

## 2. 서버 파일 준비

```bash
git clone git@github.com:5240KYH/Theieum-app.git theieum
cd theieum
cp .env.staging.example .env.staging
```

`.env.staging`에서 아래 값을 반드시 바꾼다.

```dotenv
DB_PASSWORD=replace-with-generated-db-password
JWT_SECRET=replace-with-generated-jwt-secret
STAGING_PUBLIC_URL=https://approval-staging.example.com
```

`DB_PASSWORD`와 `JWT_SECRET`은 서로 다른 긴 난수 문자열을 사용한다.

## 3. Compose 정적 검증

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml config
```

확인한다.

- `postgres`에 `ports:`가 없다.
- `backend`에 `ports:`가 없다.
- `frontend`만 외부 포트를 연다.
- `JWT_SECRET`과 `DB_PASSWORD`가 예시 문자열이 아니다.

## 4. 최초 기동

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml up --build -d postgres backend frontend
docker compose --env-file .env.staging -f docker-compose.staging.yml ps
```

`postgres`, `backend`, `frontend`가 모두 running 상태인지 확인한다.

## 5. HTTPS 앞단

서버 앞단의 Caddy, nginx+certbot, Cloudflare Tunnel, 또는 배포 플랫폼 HTTPS 기능으로 `STAGING_PUBLIC_URL`을 frontend 80 포트로 연결한다.

확인할 헤더:

```bash
curl -I https://approval-staging.example.com
curl -I https://approval-staging.example.com/manifest.webmanifest
```

두 요청 모두 `HTTP/2 200` 또는 `HTTP/1.1 200`을 반환해야 한다.

## 6. 스모크 검증

```bash
scripts/staging-smoke.sh https://approval-staging.example.com
cd e2e
E2E_BASE_URL=https://approval-staging.example.com npm run test -- mobile-pwa-staging.spec.ts
```

## 7. 체험 시작 전 데이터 점검

- 관리자 계정으로 로그인한다.
- 사용자, 조직, 직위, 결재선, 조직별 예외 결재자를 확인한다.
- 체험자에게 배정할 계정이 모두 활성 상태인지 확인한다.
- 기본 비밀번호를 체험 안내와 함께 전달하고 첫 로그인 후 변경을 요청한다.
- 실제 개인정보와 실제 영수증 업로드 금지를 다시 공지한다.

## 8. 운영 중 확인

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml logs --tail=100 backend
docker compose --env-file .env.staging -f docker-compose.staging.yml logs --tail=100 frontend
docker compose --env-file .env.staging -f docker-compose.staging.yml ps
```

장애 제보를 받으면 다음 정보를 함께 요청한다.

- 접속 시각
- 계정 아이디
- 수행한 시나리오
- 브라우저와 기기
- 화면 캡처
- 오류 문구

## 9. 업데이트

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
docker compose --env-file .env.staging -f docker-compose.staging.yml up --build -d backend frontend
scripts/staging-smoke.sh https://approval-staging.example.com
```

DB migration이 포함된 변경은 업데이트 전에 DB 백업 여부를 결정한다.

## 10. 종료 정리

체험 종료 후 아래 중 하나를 선택한다.

- 피드백 분석을 위해 DB와 첨부 volume을 일정 기간 보존한다.
- 개인정보 위험을 줄이기 위해 DB와 첨부 volume을 삭제한다.

삭제 시:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml down -v
```

보존 시:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml stop
```
````

- [ ] **Step 2: Add README links**

Add these bullets under `## 문서` in `README.md`:

```markdown
- [스테이징 외부 체험 운영 런북](docs/staging-operations-runbook.md): 서버 준비, secret, HTTPS, 검증, 종료 정리 절차
- [스테이징 체험 계정 전달 양식](docs/staging-tester-account-packet.md): 체험자별 계정 전달 문구와 역할별 시나리오
```

- [ ] **Step 3: Extend deployment checklist**

Append this section after `## 8. 사전 체험 스테이징 체크리스트` in `docs/deployment-readiness-checklist.md`:

```markdown
## 9. 외부 체험 개시 체크리스트

- [ ] `docs/staging-operations-runbook.md` 기준으로 서버와 HTTPS URL을 준비한다.
- [ ] `scripts/staging-smoke.sh https://approval-staging.example.com`가 통과한다.
- [ ] `E2E_BASE_URL=https://approval-staging.example.com npm run test -- mobile-pwa-staging.spec.ts`가 통과한다.
- [ ] 체험자별 계정 전달 문구를 `docs/staging-tester-account-packet.md` 기준으로 준비한다.
- [ ] 실제 개인정보와 실제 영수증 업로드 금지를 공지한다.
- [ ] 체험 종료 시 DB와 첨부파일 volume을 보존할지 삭제할지 결정한다.
```

If this creates a duplicate `## 9. 현재 차단/후속 후보` heading, rename the old heading to:

```markdown
## 10. 현재 차단/후속 후보
```

---

### Task 4: Create Tester Account Packet

**Files:**
- Create: `docs/staging-tester-account-packet.md`
- Modify: `docs/staging-test-guide.md`
- Modify: `docs/admin-user-guide.md`

- [ ] **Step 1: Create account packet**

Create `docs/staging-tester-account-packet.md`:

````markdown
# 스테이징 체험 계정 전달 양식

작성일: 2026-06-05

이 문서는 외부 체험자에게 계정을 전달할 때 복사해 쓰는 양식이다. 실제 체험 URL과 담당자 연락처는 배포 직전에 채운다.

운영자는 가능하면 체험자마다 별도 계정을 배정한다. 여러 사람이 같은 seed 계정을 공유하면 첫 사용자의 비밀번호 변경으로 다음 체험자가 로그인하지 못할 수 있으므로, 공유 계정은 짧은 내부 확인용으로만 사용한다.

## 1. 공통 안내

안녕하세요. 더이음 전자결재 앱 사전 체험 계정을 전달드립니다.

- 접속 URL: `<스테이징 HTTPS URL>`
- 권장 브라우저: Chrome, Edge, Safari 최신 버전
- 모바일: iOS Safari 또는 Android Chrome에서 홈 화면에 추가 후 사용
- 실제 개인정보와 실제 영수증은 업로드하지 말아 주세요.
- 개인별로 배정받은 계정은 첫 로그인 후 우측 상단 `내 비밀번호 변경`에서 비밀번호를 변경해 주세요.
- 운영자가 공유 확인용 계정이라고 안내한 경우에는 비밀번호를 변경하지 말아 주세요.
- 오류가 있으면 사용 기기, 브라우저, 계정 아이디, 수행 시나리오, 화면 캡처를 함께 전달해 주세요.

## 2. 신청자 계정 전달 문구

```text
역할: 신청자
아이디: <신청자 체험 계정>
초기 비밀번호: <개별 초기 비밀번호>

체험 순서:
1. 개인별 계정이면 로그인 후 비밀번호를 변경합니다. 공유 확인용 계정이면 비밀번호를 변경하지 않습니다.
2. 새 신청에서 테스트용 신청서를 작성합니다.
3. 테스트 이미지 또는 임의 이미지를 첨부합니다.
4. 예상 결재선을 확인하고 제출합니다.
5. 내 신청서에서 상태 변화를 확인합니다.
6. 캘린더 메뉴에서 공용 일정을 조회합니다.
```

## 3. 결재자 계정 전달 문구

```text
역할: 결재자
아이디: <결재자 체험 계정>
초기 비밀번호: <개별 초기 비밀번호>

체험 순서:
1. 개인별 계정이면 로그인 후 비밀번호를 변경합니다. 공유 확인용 계정이면 비밀번호를 변경하지 않습니다.
2. 결재함에서 대기 신청서를 엽니다.
3. 신청 내용과 첨부 이미지를 확인합니다.
4. 승인 또는 반려를 처리합니다.
5. 반려 시 의견을 입력합니다.
6. 캘린더 메뉴에서 공용 일정을 조회합니다.
```

## 4. 관리자 계정 전달 문구

```text
역할: 관리자
아이디: <관리자 체험 계정>
초기 비밀번호: <개별 초기 비밀번호>

체험 순서:
1. 개인별 계정이면 로그인 후 비밀번호를 변경합니다. 공유 확인용 계정이면 비밀번호를 변경하지 않습니다.
2. 사용자, 조직, 직위 기준정보를 확인합니다.
3. 결재선과 조직별 예외 결재자를 확인합니다.
4. 전체 신청서와 알림 로그를 확인합니다.
5. 캘린더 메뉴에서 공용 일정을 등록, 수정, 삭제합니다.
```

## 5. 매니저 계정 전달 문구

```text
역할: 매니저
아이디: <MANAGER 권한 체험 계정>
초기 비밀번호: <개별 초기 비밀번호>

체험 순서:
1. 개인별 계정이면 로그인 후 비밀번호를 변경합니다. 공유 확인용 계정이면 비밀번호를 변경하지 않습니다.
2. 관리 메뉴 접근 여부를 확인합니다. 운영자는 전달 전 해당 계정에 `MANAGER` 역할이 있는지 확인합니다.
3. 전체 신청서에서 예외 결재 흐름을 확인합니다.
4. 캘린더 메뉴에서 공용 일정을 등록, 수정, 삭제합니다.
```
````

- [ ] **Step 2: Update tester guide**

Add this section after `## 5. 관리자/매니저 시나리오` in `docs/staging-test-guide.md`:

```markdown
## 6. 공용 캘린더 시나리오

1. `캘린더` 메뉴로 이동한다.
2. `월 보기`, `주 보기`, `목록 보기`를 전환한다.
3. 일반 사용자는 일정 상세를 조회한다.
4. 관리자 또는 매니저는 테스트 일정을 등록, 수정, 삭제한다.
5. 대시보드에서 같은 일정이 달력형 보기로 보이는지 확인한다.
```

Then increment the following headings:

```markdown
## 7. 피드백 양식
## 8. 금지 사항
```

- [ ] **Step 3: Update admin guide**

Add this section near the staging/deployment area in `docs/admin-user-guide.md`:

```markdown
## 스테이징 체험 운영

외부 체험을 열기 전 `docs/staging-operations-runbook.md`를 기준으로 HTTPS URL과 스모크 검증을 완료한다.

체험자 계정 전달은 `docs/staging-tester-account-packet.md`의 역할별 문구를 사용한다. 모든 체험자에게 첫 로그인 후 비밀번호 변경, 실제 개인정보 입력 금지, 실제 영수증 업로드 금지를 안내한다.

체험 종료 후에는 DB와 첨부파일 volume 보존 또는 삭제 여부를 결정한다. 삭제가 필요한 경우 서버에서 다음 명령을 사용한다.

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml down -v
```
```

---

### Task 5: Verification And Handoff

**Files:**
- Create: `docs/handoffs/2026-06-05-task-18-staging-pilot-readiness.md`
- Verify: docs, frontend/e2e, compose, smoke

- [ ] **Step 1: Run static checks**

Run:

```bash
cd /Users/kyh/theieum
git diff --check
docker compose --env-file .env.staging.example -f docker-compose.staging.yml config
```

Expected:

```text
git diff --check has no output
```

The compose config should render `postgres`, `backend`, and `frontend`.

- [ ] **Step 2: Run frontend tests and build**

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run test
npm run build
```

Expected:

```text
Test Files ... passed
✓ built
```

- [ ] **Step 3: Run local smoke when Docker app is available**

Run:

```bash
cd /Users/kyh/theieum
docker compose up -d --build frontend
scripts/staging-smoke.sh http://localhost:3000
```

Expected:

```text
PASS: frontend, manifest, and API proxy smoke checks passed
```

If Docker is unavailable, record the Docker error in the handoff.

- [ ] **Step 4: Run mobile PWA E2E when Docker app is available**

Run:

```bash
cd /Users/kyh/theieum/e2e
E2E_BASE_URL=http://localhost:3000 npm run test -- mobile-pwa-staging.spec.ts
```

Expected:

```text
1 passed
```

If Docker is unavailable, record this as deferred runtime verification in the handoff.

- [ ] **Step 5: Create Task 18 handoff**

Create `docs/handoffs/2026-06-05-task-18-staging-pilot-readiness.md`:

````markdown
# Task 18 스테이징 외부 체험 운영 준비 인수인계

작성일: 2026-06-05, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
기준 브랜치: `main`

## 목표

Task 15에서 만든 스테이징 구성물을 실제 외부 체험 운영에 사용할 수 있도록 운영 런북, 체험 계정 전달 양식, 원격 URL 검증 절차, 종료 정리 절차를 추가했다.

## 주요 변경 파일

```text
e2e/playwright.config.ts
scripts/staging-smoke.sh
docs/staging-operations-runbook.md
docs/staging-tester-account-packet.md
docs/staging-test-guide.md
docs/deployment-readiness-checklist.md
docs/admin-user-guide.md
README.md
```

## 검증

```text
git diff --check: 결과 기록
docker compose --env-file .env.staging.example -f docker-compose.staging.yml config: 결과 기록
frontend npm run test: 결과 기록
frontend npm run build: 결과 기록
scripts/staging-smoke.sh http://localhost:3000: 결과 기록 또는 Docker 미실행으로 보류
E2E_BASE_URL=http://localhost:3000 npm run test -- mobile-pwa-staging.spec.ts: 결과 기록 또는 Docker 미실행으로 보류
```

## 다음 후보

1. 실제 스테이징 서버에 HTTPS URL 연결
2. 체험자 5~10명 계정 배정과 피드백 수집
3. Google Calendar 단방향 가져오기 설계
```
````

- [ ] **Step 6: Final status check**

Run:

```bash
cd /Users/kyh/theieum
git status --short
```

Expected: Task 18 files are modified or untracked. Existing user-edited handoff docs remain untouched unless this task explicitly updates them.

---

## Self-Review

- Spec coverage: This plan covers the strongest Task 17 next candidate, "Task 18 스테이징 외부 체험 운영 준비", without expanding into Google Calendar or recurring calendar features.
- Placeholder scan: The plan uses example domains and replace-with strings only inside operator templates where the operator must supply environment-specific secrets.
- Type and command consistency: `E2E_BASE_URL` is defined in `e2e/playwright.config.ts` and reused in both local and remote Playwright commands. `scripts/staging-smoke.sh` accepts either an argument or `STAGING_BASE_URL`.
