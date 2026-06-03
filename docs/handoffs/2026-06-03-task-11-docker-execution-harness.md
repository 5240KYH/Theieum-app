# Task 11 Docker 실행 하네스 인수인계

작성 시점: 2026-06-03 12시대, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
현재 브랜치: `main`
검증 기준 커밋: `0f7b6c9 chore: add docker execution harness`

## 1. 완료 상태

Task 11 Docker 실행 하네스는 빌드, 기동, 프론트/백엔드 HTTP 접근, nginx `/api` 프록시까지 검증되었습니다. Docker 하네스 구현 커밋은 `0f7b6c9 chore: add docker execution harness`입니다.

완료된 파일:

- `.gitignore`
- `.dockerignore`
- `backend/.dockerignore`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `docker/nginx.conf`
- `docker-compose.yml`
- `README.md`
- `docs/superpowers/plans/2026-06-03-receipt-approval-app-implementation.md`
- `docs/handoff-2026-06-03.md`
- `docs/handoffs/2026-06-03-task-11-docker-execution-harness.md`

현재 남은 미커밋 변경은 문서 3개입니다.

```text
 M docs/superpowers/plans/2026-06-03-receipt-approval-app-implementation.md
?? docs/handoff-2026-06-03.md
?? docs/handoffs/2026-06-03-task-11-docker-execution-harness.md
```

## 2. 검증 결과

정적 설정 검증:

```bash
docker compose config
```

결과: 정상 종료. `backend`, `frontend`, `postgres`, `postgres-test`, `postgres-data`, `upload-data`가 정상적으로 해석되었습니다.

문서/공백 검증:

```bash
git diff --check
```

결과: 정상 종료. 공백 오류 없음.

기존 기본 Compose 프로젝트 기동:

```bash
docker compose up --build -d
```

결과: 이미지 빌드와 컨테이너 생성은 성공했지만, 기존 `theieum_postgres-data` 볼륨에 이전 Flyway V2 checksum이 남아 있어 백엔드가 중단되었습니다.

주요 로그:

```text
Migration checksum mismatch for migration version 2
Applied to database : -1193334133
Resolved locally    : 480241771
```

기존 개발 DB 볼륨은 삭제하지 않고 보존했습니다. Docker 하네스 자체를 분리 검증하기 위해 별도 Compose 프로젝트 이름을 사용했습니다.

```bash
docker compose down
docker compose -p theieum_task11_verify up --build -d
docker compose -p theieum_task11_verify ps
docker compose -p theieum_task11_verify logs backend --tail=120
curl -I http://localhost:3000
curl -i http://localhost:8080/api/auth/login
curl -i http://localhost:3000/api/auth/login
```

결과:

- `theieum_task11_verify-backend-1`: Up, `0.0.0.0:8080->8080/tcp`
- `theieum_task11_verify-frontend-1`: Up, `0.0.0.0:3000->80/tcp`
- `theieum_task11_verify-postgres-1`: Up, healthy
- `theieum_task11_verify-postgres-test-1`: Up, healthy
- 백엔드 로그: `Started ApprovalApplication in 2.88 seconds`
- `curl -I http://localhost:3000`: `HTTP/1.1 200 OK`
- `curl -i http://localhost:8080/api/auth/login`: `HTTP/1.1 401`, `Allow: POST`
- `curl -i http://localhost:3000/api/auth/login`: `HTTP/1.1 401`, nginx를 통해 backend까지 도달

## 3. 주의할 점

- 기본 프로젝트의 기존 `theieum_postgres-data` 볼륨은 보존되어 있습니다.
- 로컬 개발 DB를 다시 seed해도 되는 상황이면 `docker compose down -v` 후 `docker compose up --build`로 기본 프로젝트를 깨끗하게 띄울 수 있습니다.
- 이번 검증은 기존 볼륨 오염과 Docker 하네스 자체 문제를 분리하기 위해 `theieum_task11_verify` 프로젝트를 사용했습니다.
- 최종 정리 전에는 검증용 컨테이너와 볼륨을 제거해도 됩니다.

## 4. 다음 작업

Task 12 Playwright E2E 업무 흐름 검증으로 진행합니다. E2E 실행 전에는 Docker 앱이 떠 있어야 합니다.

기본 개발 DB 볼륨을 초기화해도 되는 경우:

```bash
docker compose down -v
docker compose up --build -d
```

기존 기본 개발 DB 볼륨을 보존해야 하는 경우:

```bash
docker compose -p theieum_task12_e2e up --build -d
```

어느 방식을 쓰든 Playwright 실행 전 아래 응답을 확인하세요.

```bash
curl -I http://localhost:3000
curl -i http://localhost:3000/api/auth/login
```

예상 생성 파일:

- `e2e/package.json`
- `e2e/playwright.config.ts`
- `e2e/tests/receipt-approval-flow.spec.ts`
- `e2e/fixtures/receipt.png`

새 채팅에서 이어갈 경우:

```text
/Users/kyh/theieum 프로젝트를 이어서 진행해주세요.
먼저 docs/handoff-2026-06-03.md와 docs/handoffs/2026-06-03-task-11-docker-execution-harness.md를 읽고,
Task 12 Playwright E2E 업무 흐름 검증을 진행해주세요.
E2E 전 Docker 앱을 기본 프로젝트 또는 별도 `theieum_task12_e2e` 프로젝트로 띄우고 `http://localhost:3000`과 `/api` 프록시 응답을 확인해주세요.
컨텍스트가 많아지면 task별 인수인계서를 만들고 새 채팅에서 이어갈 수 있게 해주세요.
```
