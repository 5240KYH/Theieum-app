# Task 12 Playwright E2E 업무 흐름 인수인계

작성 시점: 2026-06-03 16시대, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
현재 브랜치: `main`
시작 기준 커밋: `1b355cf docs: add task handoff workflow`

## 1. 완료 상태

Task 12는 Playwright E2E 프로젝트를 추가하고, 실제 E2E가 잡은 로그인/대시보드 계약 문제를 함께 수정했습니다.

완료된 항목:

- E2E 프로젝트 생성
- 실제 PNG 영수증 fixture 추가
- 신청자 `employee01`이 영수증 신청서를 제출하는 흐름 검증
- 개발팀 예외 결재선에 따라 `lead-dev`가 승인하는 흐름 검증
- 신청자 상세 화면에서 `승인완료` 확인
- 신청자 알림함에서 `최종 결재 완료` 확인
- 로그인 응답과 `/api/me` 응답에 `loginId` 포함
- 신청자 대시보드가 `/api/approvals/inbox`를 호출하지 않도록 역할 분기

## 2. 변경 파일

- `.gitignore`
- `backend/src/main/java/com/theieum/approval/auth/UserSummary.java`
- `backend/src/main/java/com/theieum/approval/auth/AuthenticatedUser.java`
- `backend/src/test/java/com/theieum/approval/auth/AuthIntegrationTest.java`
- `frontend/src/dashboard/DashboardPage.tsx`
- `frontend/src/dashboard/DashboardPage.test.tsx`
- `e2e/package.json`
- `e2e/package-lock.json`
- `e2e/playwright.config.ts`
- `e2e/tests/receipt-approval-flow.spec.ts`
- `e2e/fixtures/receipt.png`
- `docs/superpowers/plans/2026-06-03-receipt-approval-app-implementation.md`
- `docs/handoffs/2026-06-03-task-12-playwright-e2e-flow.md`

## 3. RED/GREEN 기록

RED:

```bash
cd /Users/kyh/theieum/e2e
npm run test
```

앱 미기동 상태에서 `net::ERR_CONNECTION_REFUSED`로 실패했습니다.

RED:

```bash
cd /Users/kyh/theieum/backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
GRADLE_USER_HOME=/Users/kyh/theieum/.gradle-home \
./gradlew test --tests 'com.theieum.approval.auth.AuthIntegrationTest.loginReturnsTokenForSeedAdmin' --tests 'com.theieum.approval.auth.AuthIntegrationTest.meReturnsAuthenticatedUser'
```

`$.user.loginId`와 `$.loginId`가 없어 실패했습니다.

GREEN:

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
GRADLE_USER_HOME=/Users/kyh/theieum/.gradle-home \
./gradlew test --tests 'com.theieum.approval.auth.AuthIntegrationTest.loginReturnsTokenForSeedAdmin' --tests 'com.theieum.approval.auth.AuthIntegrationTest.meReturnsAuthenticatedUser'
```

결과: `BUILD SUCCESSFUL`.

RED:

```bash
cd /Users/kyh/theieum/frontend
/opt/homebrew/bin/npm run test -- DashboardPage.test.tsx
```

신청자 대시보드가 `/api/approvals/inbox`를 호출해 실패했습니다.

GREEN:

```bash
/opt/homebrew/bin/npm run test -- DashboardPage.test.tsx
```

결과: 1 test passed.

E2E GREEN:

```bash
cd /Users/kyh/theieum
docker compose -p theieum_task12_e2e up --build -d postgres backend frontend
cd /Users/kyh/theieum/e2e
npm run test
```

결과: 1 passed.

최종 검증:

```bash
cd /Users/kyh/theieum/backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
GRADLE_USER_HOME=/Users/kyh/theieum/.gradle-home \
./gradlew test
```

결과: `BUILD SUCCESSFUL`.

```bash
cd /Users/kyh/theieum/frontend
/opt/homebrew/bin/npm run test
/opt/homebrew/bin/npm run build
```

결과:

- frontend test: 5 files, 18 tests passed
- frontend build: passed

```bash
cd /Users/kyh/theieum/e2e
npm run test
```

결과: 1 passed.

```bash
cd /Users/kyh/theieum
docker compose config
git diff --check
```

결과: 둘 다 정상 종료.

## 4. 실행 환경 메모

- Playwright Chromium은 `npx playwright install chromium`으로 설치했습니다.
- 샌드박스 안에서는 Chromium 실행이 macOS 권한 문제로 실패하므로 Playwright 실행은 승인된 환경에서 수행했습니다.
- E2E 앱은 기본 프로젝트의 기존 `theieum_postgres-data` 볼륨을 보존하기 위해 `theieum_task12_e2e` 프로젝트명으로 띄웠습니다.
- E2E에는 `postgres-test` 서비스가 필요 없고, `55432` 포트 충돌을 피하기 위해 `postgres backend frontend`만 실행했습니다.
- 백엔드 통합 테스트용 DB는 별도 `theieum_backend_test` 프로젝트의 `postgres-test` 서비스를 사용했습니다.
- 최종 검증 시점에는 `theieum_task12_e2e`와 `theieum_backend_test` 컨테이너가 아직 떠 있을 수 있습니다. 커밋 전후로 정리하려면 `docker compose -p theieum_task12_e2e down -v`와 `docker compose -p theieum_backend_test down -v`를 실행하세요.

## 5. 다음 작업

Task 13 최종 리뷰와 배포 준비로 진행합니다.

새 채팅에서 이어갈 경우:

```text
/Users/kyh/theieum 프로젝트를 이어서 진행해주세요.
먼저 docs/handoff-2026-06-03.md와 docs/handoffs/2026-06-03-task-12-playwright-e2e-flow.md를 읽고,
Task 12 최종 검증/커밋 상태를 확인한 뒤 Task 13 최종 리뷰와 배포 준비를 진행해주세요.
컨텍스트가 많아지면 task별 인수인계서를 만들고 새 채팅에서 이어갈 수 있게 해주세요.
```
