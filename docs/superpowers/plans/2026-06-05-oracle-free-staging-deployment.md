# Oracle Free Staging Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Oracle Cloud Always Free VM에 더이음 스테이징 서버를 올려 30명 안팎의 외부 체험자가 HTTPS URL로 접속할 수 있게 한다.

**Architecture:** 앱은 기존 `docker-compose.staging.yml`로 VM 내부에서 실행하고 frontend만 `127.0.0.1:3000`에 바인딩한다. 외부 공개는 Caddy가 `80/443`을 받아 `127.0.0.1:3000`으로 reverse proxy하며, backend/PostgreSQL 포트는 외부에 열지 않는다. GitHub repo는 public 유지 조건을 점검하고, 보안상 부담이 있으면 private + read-only deploy key로 배포한다.

**Tech Stack:** Oracle Cloud Always Free Ampere A1, Ubuntu ARM64, Docker Compose, Caddy, Spring Boot, React/Vite, PostgreSQL, Playwright.

---

## File Structure

- Modify: `.env.staging.example`  
  staging server 기본 frontend bind를 `127.0.0.1:3000`으로 둔다.
- Create: `docs/oracle-free-staging-runbook.md`  
  Oracle VM 생성부터 HTTPS, Docker, GitHub public/private, smoke 검증, 종료까지 담는 실행 런북.
- Modify: `README.md`  
  Oracle Always Free 스테이징 런북 링크를 추가한다.
- Modify: `docs/deployment-readiness-checklist.md`  
  Oracle 배포와 GitHub public/private 보안 체크를 추가한다.
- Modify: `docs/handoff-2026-06-03.md`  
  Task 19 후보/진행 문서 링크를 추가한다.
- Create: `docs/handoffs/2026-06-05-task-19-oracle-free-staging.md`  
  실제 VM 생성 전까지 완료된 준비와 남은 사용자 입력을 정리한다.

---

### Task 1: Safer Staging Port Binding

**Files:**
- Modify: `.env.staging.example`

- [x] **Step 1: Update `.env.staging.example`**

Use:

```dotenv
# Bind frontend to localhost on staging servers and expose only 80/443 through Caddy or another HTTPS proxy.
FRONTEND_HTTP_PORT=127.0.0.1:3000
```

- [x] **Step 2: Verify compose rendering**

Run:

```bash
cd /Users/kyh/theieum
FRONTEND_HTTP_PORT=127.0.0.1:3000 docker compose --env-file .env.staging.example -f docker-compose.staging.yml config
```

Expected:

```text
host_ip: 127.0.0.1
published: "3000"
target: 80
```

---

### Task 2: Oracle Deployment Runbook

**Files:**
- Create: `docs/oracle-free-staging-runbook.md`
- Modify: `README.md`

- [x] **Step 1: Write Oracle runbook**

Create `docs/oracle-free-staging-runbook.md` with sections for:

- official references
- recommended VM shape: Ampere A1, 2 OCPU / 12GB RAM first
- ports: open `22`, `80`, `443`; keep `3000`, `8080`, `5432` closed
- Docker install on Ubuntu
- public repo vs private repo security decision
- read-only GitHub deploy key for private repo
- `.env.staging` values
- Docker Compose start
- Caddy reverse proxy and automatic HTTPS
- remote smoke and E2E commands
- 30-person pilot security checks
- update and shutdown commands

- [x] **Step 2: Add README link**

Add under `## 문서`:

```markdown
- [Oracle Always Free 스테이징 배포 런북](docs/oracle-free-staging-runbook.md): 무료 VM 기반 외부 체험 서버 구성, HTTPS, 보안 점검
```

---

### Task 3: Security Checklist Integration

**Files:**
- Modify: `docs/deployment-readiness-checklist.md`

- [x] **Step 1: Add Oracle/Public Repo section**

Add a section after `## 9. 외부 체험 개시 체크리스트`:

```markdown
## 10. Oracle Always Free 외부 체험 서버 체크리스트

- [ ] Oracle Ampere A1 VM을 2 OCPU / 12GB RAM 이상으로 준비한다.
- [ ] Security List 또는 NSG는 `80`, `443`, 제한된 `22`만 연다.
- [ ] `3000`, `8080`, `5432`는 외부에서 닫혀 있는지 확인한다.
- [ ] Caddy가 HTTPS를 받아 `127.0.0.1:3000`으로 reverse proxy한다.
- [ ] `FRONTEND_HTTP_PORT=127.0.0.1:3000`으로 frontend를 바인딩한다.
- [ ] GitHub public 유지 여부를 결정한다.
- [ ] public 유지 시 repo에 secret, `.env.staging`, DB dump, 실제 개인정보, 실제 첨부파일이 없는지 확인한다.
- [ ] private 전환 시 VM에는 read-only deploy key만 둔다.
- [ ] `scripts/staging-smoke.sh https://<staging-domain>`이 통과한다.
- [ ] `cd e2e && E2E_BASE_URL=https://<staging-domain> npm run test -- mobile-pwa-staging.spec.ts`가 통과한다.
```

Then renumber existing `## 10. 현재 차단/후속 후보` to `## 11. 현재 차단/후속 후보`.

---

### Task 4: Handoff Update

**Files:**
- Modify: `docs/handoff-2026-06-03.md`
- Create: `docs/handoffs/2026-06-05-task-19-oracle-free-staging.md`

- [x] **Step 1: Create Task 19 handoff**

Create `docs/handoffs/2026-06-05-task-19-oracle-free-staging.md` with:

```markdown
# Task 19 Oracle Always Free 스테이징 배포 인수인계

작성일: 2026-06-05, Asia/Seoul
작업 경로: `/Users/kyh/theieum`

## 목표

Oracle Cloud Always Free VM에 더이음 스테이징 서버를 올릴 수 있도록 배포 런북과 보안 체크리스트를 준비했다.

## 완료

- `.env.staging.example`의 frontend 기본 bind를 `127.0.0.1:3000`으로 조정했다.
- `docs/oracle-free-staging-runbook.md`를 추가했다.
- README와 배포 체크리스트에 Oracle 배포 경로를 연결했다.

## 실제 배포 전 필요한 사용자 입력

- Oracle Cloud 계정과 region
- SSH 공개키
- staging domain 또는 임시 도메인
- GitHub public 유지 여부 또는 private 전환 여부

## 검증

```text
FRONTEND_HTTP_PORT=127.0.0.1:3000 docker compose --env-file .env.staging.example -f docker-compose.staging.yml config: PASS
git diff --check: PASS
```

## 다음 실행

1. Oracle VM 생성
2. Docker/Caddy 설치
3. repo clone 또는 deploy key 설정
4. `.env.staging` 작성
5. `docker compose --env-file .env.staging -f docker-compose.staging.yml up --build -d postgres backend frontend`
6. `scripts/staging-smoke.sh https://<staging-domain>`
```

- [x] **Step 2: Update root handoff**

Add Task 19 as the latest candidate/prep section with links to:

```text
docs/oracle-free-staging-runbook.md
docs/handoffs/2026-06-05-task-19-oracle-free-staging.md
```

---

### Task 5: Verification

**Files:**
- Verify all changed docs/config

- [x] **Step 1: Run checks**

Run:

```bash
cd /Users/kyh/theieum
git diff --check
FRONTEND_HTTP_PORT=127.0.0.1:3000 docker compose --env-file .env.staging.example -f docker-compose.staging.yml config
```

Expected:

```text
git diff --check has no output
compose config renders frontend host_ip: 127.0.0.1
```

- [x] **Step 2: Confirm no deployment happened**

Record that actual Oracle VM creation is blocked until the user provides account/region/SSH/domain decisions.

---

## Self-Review

- This plan covers the user's chosen free 30-person recommendation: Oracle Always Free VM.
- It treats GitHub public/private as a security decision and gives a private repo path using deploy keys.
- It does not assume access to the user's Oracle account or domain.
