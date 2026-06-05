# Task 18 스테이징 외부 체험 운영 준비 인수인계

작성일: 2026-06-05, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
기준 브랜치: `main`
기준 커밋: `56feb60 Merge pull request #3 from 5240KYH/codex/task-15-mobile-pwa-staging`

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
docs/superpowers/plans/2026-06-05-staging-pilot-readiness.md
docs/handoff-2026-06-03.md
```

## 구현 내용

- Playwright `baseURL`을 `E2E_BASE_URL` 환경변수로 바꿀 수 있게 했다.
- `scripts/staging-smoke.sh`를 추가해 frontend, PWA manifest, `/api/auth/login` 프록시 상태를 확인한다.
- 현재 API의 GET `/api/auth/login` 응답은 `405 Method Not Allowed` + `Allow: POST`이므로 smoke는 `401` 또는 `405`와 `Allow: POST`를 허용한다.
- 스테이징 운영자용 런북 `docs/staging-operations-runbook.md`를 추가했다.
- 체험자별 계정 전달 양식 `docs/staging-tester-account-packet.md`를 추가했다.
- 공유 계정 비밀번호 변경으로 다음 체험자가 잠기는 문제를 피하기 위해, 개인별 계정과 공유 확인용 계정의 비밀번호 변경 안내를 분리했다.
- 현재 seed SQL 기준 `ceo`는 `MANAGER`가 아니므로, 매니저 체험 문구는 특정 seed 계정 대신 `MANAGER` 권한 계정 확인 방식으로 정리했다.
- 체험자 가이드에 공용 캘린더 시나리오를 추가했다.
- 관리자 운영 가이드와 배포 전 체크리스트에 외부 체험 개시/종료 절차를 연결했다.

## 검증

```text
git diff --check: PASS, 출력 없음
docker compose --env-file .env.staging.example -f docker-compose.staging.yml config: PASS
bash -n scripts/staging-smoke.sh: PASS
cd /Users/kyh/theieum/e2e && npm exec playwright -- test --list: PASS, 2 tests listed
cd /Users/kyh/theieum/frontend && npm run test: PASS, 11 files / 62 tests
cd /Users/kyh/theieum/frontend && npm run build: PASS, Vite build completed
docker compose up -d --build frontend: PASS
scripts/staging-smoke.sh http://localhost:3000: PASS
cd /Users/kyh/theieum/e2e && E2E_BASE_URL=http://localhost:3000 npm run test -- mobile-pwa-staging.spec.ts: PASS, 1 passed
```

Docker 컨테이너 상태 확인:

```text
theieum-frontend-1: Up, 0.0.0.0:3000->80/tcp
theieum-backend-1: Up, 0.0.0.0:8080->8080/tcp
theieum-postgres-1: Up, healthy, 0.0.0.0:5432->5432/tcp
```

## 주의점

- 실제 외부 체험 URL은 문서의 `<스테이징 HTTPS URL>` 자리에 배포 직전 채운다.
- `.env.staging.example`의 `DB_PASSWORD`, `JWT_SECRET`, `STAGING_PUBLIC_URL` 예시값을 그대로 쓰지 않는다.
- 외부 체험자는 가능하면 개인별 계정을 배정한다.
- 공유 확인용 계정은 비밀번호를 변경하지 않도록 안내한다.
- 매니저 시나리오 계정은 전달 전 `MANAGER` 역할을 확인한다.
- 현재 로컬 Docker 앱은 Task 18 검증을 위해 기동된 상태다.

## 다음 후보

1. 실제 스테이징 서버에 HTTPS URL 연결
2. 체험자 5~10명 계정 배정과 피드백 수집
3. Google Calendar 단방향 가져오기 설계
