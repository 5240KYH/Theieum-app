# Task 22 전 다중 영수증 첨부 및 월별 다운로드 인수인계

작성일: 2026-06-05, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
현재 브랜치: `main`
최종 커밋: `ef2de84 feat: harden staging attachments and calendar ux`

## 재시작 프롬프트

```text
Task 22 전에 진행한 다중 영수증 첨부와 월별 첨부 ZIP 다운로드 작업을 이어서 확인해주세요.
```

## 읽을 문서

```text
docs/handoff-2026-06-03.md
docs/superpowers/specs/2026-06-05-multi-receipt-attachments-design.md
docs/superpowers/plans/2026-06-05-multi-receipt-attachments.md
docs/handoffs/2026-06-05-task-22-pre-multi-receipt-attachments.md
docs/staging-trial-data-and-attachments.md
```

## 변경 요약

- 신청서당 영수증 이미지 기본 첨부 개수를 1개에서 최대 10개로 확장했다.
- 파일당 5MB 제한과 기존 이미지 타입/signature 검증은 유지했다.
- 신청서 작성 화면에서 한 번에 여러 이미지를 선택하고, 썸네일 그리드에서 개별 미리보기/삭제를 할 수 있게 했다.
- 신청서 상세 화면에서 여러 첨부 이미지를 썸네일로 확인하고 클릭 시 확대 미리보기 모달을 열 수 있게 했다.
- 관리자 전체 신청서 화면에 월 선택과 `월별 첨부 다운로드` 버튼을 추가했다.
- 관리자 전용 `GET /api/admin/attachments/monthly-download?month=YYYY-MM` API를 추가해 영수증 일자 기준 월별 첨부 ZIP을 내려받을 수 있게 했다.
- ZIP entry 이름은 `YYYY-MM/application-<id>/<receipt-date>-<vendor>-<attachment-id>-<original-filename>` 형식이다.
- 매니저는 월별 첨부 ZIP API에 접근할 수 없고 403을 받는다.
- 스테이징/운영 문서의 기본 첨부 정책을 신청서당 최대 10개, 파일당 5MB 이하로 갱신했다.
- 모바일 대시보드/캘린더에서 일정 칩 또는 날짜 영역을 누르면 아래 세부 일정이 해당 날짜로 바뀌도록 보정했다.
- 읽기 전용 일정 칩은 편집/입력 버튼이 아니라 날짜 선택 버튼으로만 동작한다.

## 주요 변경 파일

```text
backend/src/main/java/com/theieum/approval/admin/AdminController.java
backend/src/main/resources/application.yml
backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java
backend/src/test/java/com/theieum/approval/application/ApplicationSubmissionTest.java
frontend/src/applications/ApplicationForm.tsx
frontend/src/applications/ApplicationDetailPage.tsx
frontend/src/admin/AdminApplicationsPage.tsx
frontend/src/admin/adminApi.ts
frontend/src/app/styles.css
frontend/src/applications/ApplicationForm.test.tsx
frontend/src/applications/ApplicationDetailPage.test.tsx
frontend/src/admin/AdminApplicationsPage.test.tsx
frontend/src/calendar/CalendarBoard.tsx
frontend/src/dashboard/DashboardPage.test.tsx
.env.staging.example
docker-compose.staging.yml
README.md
docs/admin-user-guide.md
docs/staging-test-guide.md
docs/staging-operations-runbook.md
docs/staging-trial-data-and-attachments.md
```

## 검증 완료

```bash
cd frontend && npm run test -- ApplicationForm.test.tsx ApplicationDetailPage.test.tsx AdminApplicationsPage.test.tsx
cd frontend && npm run build
cd frontend && npm run test
docker run --rm -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test
docker compose --env-file .env.staging.example -f docker-compose.staging.yml config
git diff --check
rg -n "영수증 이미지 1개|ATTACHMENT_MAX_FILES_PER_APPLICATION=1([^0-9]|$)" docs README.md .env.staging.example docker-compose.staging.yml backend/src/main/resources/application.yml
```

결과:

- 프론트 대상 테스트 21개 통과
- 프론트 전체 테스트 66개 통과
- 프론트 타입 체크와 production build 통과
- 백엔드 전체 테스트 통과
- 스테이징 compose 렌더링에서 `ATTACHMENT_MAX_FILES_PER_APPLICATION: "10"` 확인
- 모바일 412x915 Chromium에서 일정 칩 클릭과 빈 날짜 영역 클릭 시 세부 일정 전환 확인
- `git diff --check` 통과
- 오래된 `영수증 이미지 1개` 표기는 Task 21 당시 정책을 설명하는 과거 설계/인수인계 문서에만 남아 있다.
- 작업 묶음은 `ef2de84`로 커밋되어 `origin/main`에 푸시되었다.

## 후속 상태

- 실제 체험 운영 전 새 신청 다중 업로드, 상세 확대 미리보기, 관리자 월별 다운로드 버튼 시각 확인은 `docs/handoffs/2026-06-08-task-22-final-user-scenario-check.md`에서 완료했다.
- 추가 요청이 없다면 Task 22까지 계획된 기능 구현 task는 종료된 상태로 본다.
