# Task 26 신청서 입력 포맷 개선 인수인계

작성일: 2026-06-09, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
현재 브랜치: `main`
기준 커밋: `9e5f387 feat: 조직장 기반 결재선 지원`

## 재시작 프롬프트

```text
Task 26 신청서 입력 포맷 개선 작업을 이어서 확인해주세요.
작업 경로는 /Users/kyh/theieum이고, main 브랜치에서 추가 브랜치 없이 진행했습니다.
먼저 AGENTS.md, docs/handoff-2026-06-03.md, docs/handoffs/2026-06-09-task-26-application-input-formatting.md, git status --short를 확인한 뒤 진행해주세요.
```

## 먼저 읽을 문서

```text
AGENTS.md
docs/handoff-2026-06-03.md
docs/handoffs/2026-06-09-task-26-application-input-formatting.md
docs/handoffs/2026-06-08-task-25-organization-leader-approval.md
```

## 변경 요약

- 신청서 작성/수정 화면의 `영수증 일자` 입력을 사용자가 보기 쉬운 문자열 입력으로 바꿨다.
  - 사용자가 `20260608`처럼 숫자만 입력해도 화면에는 `2026. 06. 08.` 형식으로 표시한다.
  - 저장/제출 API payload에는 기존 계약을 유지해 `2026-06-08` ISO 날짜 문자열로 전송한다.
  - 존재하지 않는 날짜는 제출 전 `영수증 일자는 YYYY. MM. DD. 형식으로 입력해주세요.` 메시지로 막는다.
- 신청서 작성/수정 화면의 `금액` 입력에 천 단위 쉼표 포맷을 적용했다.
  - 사용자가 `100000`을 입력하면 화면에는 `100,000`으로 표시한다.
  - 저장/제출 API payload에는 기존 계약을 유지해 숫자 `100000`으로 전송한다.
- 기존 `ApplicationForm` 저장/제출 흐름은 유지했다.
  - 신청일자는 기존 브라우저 표준 date input을 그대로 둔다.
  - 영수증 일자와 금액만 표시용 포맷과 전송용 값을 분리했다.

## 주요 변경 파일

```text
frontend/src/applications/ApplicationForm.tsx
frontend/src/applications/ApplicationForm.test.tsx
docs/handoff-2026-06-03.md
docs/handoffs/2026-06-09-task-26-application-input-formatting.md
```

## 검증 결과

```bash
cd frontend && npm run test -- ApplicationForm.test.tsx
```

결과: PASS, 11 tests

```bash
cd frontend && npm run test
```

결과: PASS, 72 tests

```bash
cd frontend && npm run build
```

결과: PASS

```bash
git diff --check
```

결과: PASS

```bash
docker compose up --build -d frontend
docker compose ps
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

결과:

- `theieum-frontend-1`: Up, `0.0.0.0:3000->80/tcp`
- `theieum-backend-1`: Up, `0.0.0.0:8080->8080/tcp`
- `theieum-postgres-1`: healthy
- `http://localhost:3000`: HTTP 200

Headless browser 확인:

```text
계정: employee01 / password
URL: http://localhost:3000/applications/new
영수증 일자 입력: 20260608 -> 2026. 06. 08.
금액 입력: 100000 -> 100,000
```

## 남은 확인 사항

- 이번 작업은 프론트 입력 UX 개선이므로 백엔드 스키마/서비스 변경은 없다.
- 모바일 브라우저에서 실제 키패드 표시까지 수동 확인하면 좋다. 구현은 `inputMode="numeric"`을 사용한다.
- 본 인수인계 작성 후 사용자 요청에 따라 `main` 브랜치에서 커밋/푸시를 진행한다.
