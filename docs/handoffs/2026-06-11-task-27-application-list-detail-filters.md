# Task 27 신청서 목록 상세 이동 및 조회 필터/관리 UI 개선 인수인계

작성일: 2026-06-11, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
현재 브랜치: `main`
기준 커밋: `cac0bf8 feat: 신청서 입력 포맷 개선`

## 재시작 프롬프트

```text
Task 27 신청서 목록 상세 이동 및 조회 필터/관리 UI 개선 작업을 이어서 확인해주세요.
작업 경로는 /Users/kyh/theieum이고, main 브랜치에서 추가 브랜치 없이 진행했습니다.
먼저 AGENTS.md, docs/handoff-2026-06-03.md, docs/handoffs/2026-06-11-task-27-application-list-detail-filters.md, git status --short를 확인한 뒤 진행해주세요.
```

## 먼저 읽을 문서

```text
AGENTS.md
docs/handoff-2026-06-03.md
docs/handoffs/2026-06-09-task-26-application-input-formatting.md
docs/handoffs/2026-06-11-task-27-application-list-detail-filters.md
```

## 변경 요약

- `내 신청서` 상세 화면 상단에 `내 신청서로 돌아가기` 버튼을 추가했다.
- `전체 신청서` 목록에 상세 이동 버튼을 추가했다.
  - 상세 링크는 `/applications/:id?from=admin-applications`로 이동한다.
  - 상세 화면에서는 이 query 값을 보고 `전체 신청서로 돌아가기` 버튼을 표시한다.
- `전체 신청서` 상세 조회가 메뉴 권한과 맞도록 백엔드 상세 읽기 권한에 `MANAGER`를 추가했다.
  - 기존 `ADMIN`, 신청자 본인, 현재 결재자 읽기 권한은 유지했다.
- `내 신청서`, `전체 신청서` 목록에 영수증 월 범위 필터를 추가했다.
  - `영수증 월 From`, `영수증 월 To`로 월 범위를 지정한다.
  - 월 입력은 `type="month"` 대신 `YYYY-MM` 텍스트 마스크를 사용한다.
  - `20260699`처럼 입력해도 화면 값은 `2026-06`까지만 반영된다.
  - `전체기간` 버튼으로 월 조건을 비운다.
- `전체 신청서` 목록에 신청자 텍스트 검색을 추가했다.
  - 화면 명칭은 `신청자`로 표시한다.
  - 콤보박스가 아니라 텍스트 입력이며, `김` 입력 시 이름에 `김`이 포함된 신청자가 조회되도록 클라이언트에서 포함 검색한다.
- `전체 신청서` 목록 정보량을 늘렸다.
  - 관리자 목록 API 응답에 `applicationDate`, `receiptDate`, `amount`를 추가했다.
  - 화면 테이블에 `신청일`, `영수증 일자`, `금액`, `상세` 컬럼을 추가했다.
- 관리자/신청자 목록 검색조건 UI를 정돈된 패널 형태로 다듬고, 작은 화면에서 줄바꿈되도록 CSS를 보강했다.
- `결재함` 화면에 `접수기간 From`, `접수기간 To`, `전체기간` 필터를 추가했다.
  - 월 입력은 같은 `YYYY-MM` 텍스트 마스크를 사용한다.
  - 결재 대기 목록은 `receivedAt` 접수 월 기준으로 필터링한다.
  - 결재함 API 응답이 배열이 아닌 경우 빈 목록으로 보정해 화면이 깨지지 않도록 했다.
- `캘린더` 메뉴를 업무 메뉴에서 관리 메뉴로 이동했다.
  - 관리 메뉴의 `/admin/calendar`는 `ADMIN`, `MANAGER`만 접근 가능하다.
  - 기존 `/calendar` 주소는 대시보드로 redirect한다.
  - 일반 사용자는 대시보드의 공용 캘린더 위젯으로 일정 조회를 계속 할 수 있다.
- 캘린더 일정 등록/수정 모달의 `시작일`, `종료일` 입력을 텍스트 입력 + 날짜 선택 input 조합으로 바꿨다.
  - `20260610` 입력 시 `2026-06-10`으로 자동 정리된다.
  - 옆의 날짜 선택 input으로도 같은 값이 반영된다.
- `알림 로그` 화면을 ID 중심 표에서 업무 로그 중심 표로 개선했다.
  - 백엔드 관리자 알림 로그 응답에 수신자명, 신청서 사용처/상태, 제목, 본문, 생성/발송 시각, 실패 사유를 추가했다.
  - 프론트는 알림 내용, 수신자, 사용처, 신청상태, 발송상태, 채널, 읽음, 처리 시각을 분리해 표시한다.
- 후속 요청으로 목록 검색조건 UI를 공통 컴포넌트로 정리했다.
  - `SearchConditionPanel`을 추가하고 `내 신청서`, `결재함`, `전체 신청서`가 같은 `검색조건` 영역/배치/CSS를 사용하도록 변경했다.
  - `AGENTS.md`에 새 목록 검색조건은 공통 컴포넌트를 우선 사용하도록 프로젝트 규칙을 추가했다.
- 캘린더 일정 등록/수정 날짜 입력의 직접 선택 UI를 더 명확히 했다.
  - 텍스트 입력 옆에 달력 아이콘이 붙은 실제 `type="date"` 컨트롤을 표시한다.
  - 접근성 이름은 `시작일 일자 직접 선택`, `종료일 일자 직접 선택`으로 명확히 했다.
- 알림 로그 표시를 다시 정리했다.
  - 수신자는 이름만 표시하고 `사용자 #ID` 보조 문구는 제거했다.
  - 신청서 정보는 `사용처`, `신청상태` 컬럼으로 분리했다.
  - 알림 상태는 `발송상태`, `채널`, `읽음` 컬럼으로 분리했다.
  - 알림 이벤트의 `CREATED` 상태는 관리자 화면에서 `생성` 대신 `발송 전`으로 표시한다.

## 주요 변경 파일

```text
backend/src/main/java/com/theieum/approval/admin/AdminController.java
backend/src/main/java/com/theieum/approval/application/ApplicationController.java
backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java
frontend/src/admin/AdminApplicationsPage.tsx
frontend/src/admin/AdminApplicationsPage.test.tsx
frontend/src/admin/AdminNotificationsPage.tsx
frontend/src/admin/adminTypes.ts
frontend/src/approvals/ApprovalsInboxPage.tsx
frontend/src/approvals/ApprovalsInboxPage.test.tsx
frontend/src/applications/monthFilters.ts
frontend/src/applications/ApplicationDetailPage.tsx
frontend/src/applications/ApplicationDetailPage.test.tsx
frontend/src/applications/MyApplicationsPage.tsx
frontend/src/applications/MyApplicationsPage.test.tsx
frontend/src/app/router.tsx
frontend/src/app/styles.css
frontend/src/calendar/CalendarPage.tsx
frontend/src/calendar/CalendarPage.test.tsx
frontend/src/shared/layout/AppLayout.tsx
frontend/src/shared/layout/AppLayout.test.tsx
frontend/src/shared/SearchConditionPanel.tsx
AGENTS.md
docs/handoff-2026-06-03.md
docs/handoffs/2026-06-11-task-27-application-list-detail-filters.md
```

## 검증 결과

```bash
cd frontend && npm run test -- AdminApplicationsPage.test.tsx ApprovalsInboxPage.test.tsx CalendarPage.test.tsx AppLayout.test.tsx
```

결과: PASS, 24 tests

```bash
cd frontend && npm run test -- MyApplicationsPage.test.tsx ApprovalsInboxPage.test.tsx AdminApplicationsPage.test.tsx CalendarPage.test.tsx
```

결과: PASS, 17 tests

```bash
cd frontend && npm run test
```

결과: PASS, 79 tests

- `영수증 월 From`에 `20260699` 입력 시 `2026-06`으로 제한되는지 확인
- `신청자`에 `김` 입력 시 이름 포함 검색이 적용되는지 확인
- `접수기간 From/To`에 `20260699`, `202606` 입력 시 `2026-06`으로 제한되고 결재함 목록이 필터링되는지 확인
- 캘린더 `시작일` 텍스트 입력 `20260610`이 `2026-06-10`으로 변환되고, `종료일 캘린더 선택` 값이 종료일 텍스트 입력에 반영되는지 확인
- 일반 사용자에게 캘린더 관리 메뉴가 노출되지 않고, 매니저 모바일 더보기에는 관리 캘린더가 노출되는지 확인
- 알림 로그에서 제목/본문/수신자명/사용처/신청상태/발송상태/채널/읽음/시각이 표시되는지 확인
- `내 신청서`, `결재함`, `전체 신청서`에 접근성 이름 `검색조건`인 공통 `SearchConditionPanel` 영역이 표시되는지 확인
- 캘린더 일정 등록 모달에 `시작일 일자 직접 선택`, `종료일 일자 직접 선택` `type="date"` 컨트롤이 표시되는지 확인
- 알림 로그에서 `사용자 #ID`가 표시되지 않고, `사용처`, `신청상태`, `발송상태`, `채널`, `읽음` 컬럼이 분리되는지 확인
- 알림 로그에서 `CREATED` 발송 상태가 `발송 전`으로 표시되는지 확인

```bash
cd frontend && npm run build
```

결과: PASS

```bash
git diff --check
```

결과: PASS

```bash
cd backend && TMPDIR=/private/tmp GRADLE_USER_HOME=/Users/kyh/theieum/.gradle-home JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test --tests com.theieum.approval.api.ApiAuthorizationTest
```

결과: PASS

```bash
docker compose up --build -d postgres backend frontend
docker compose ps
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

결과:

- `theieum-frontend-1`: Up, `0.0.0.0:3000->80/tcp`
- `theieum-backend-1`: Up, `0.0.0.0:8080->8080/tcp`
- `theieum-postgres-1`: healthy
- `http://localhost:3000`: HTTP 200

추가 반영:

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

인앱 브라우저 확인:

```text
계정: admin / password
URL: http://localhost:3000/admin/applications
확인 내용:
- 전체 신청서 목록에 상태, 영수증 월 From/To, 신청자 텍스트 검색, 전체기간, 상세 컬럼 표시
- 상세 링크로 /applications/2?from=admin-applications 진입
- 상세 화면에서 전체 신청서로 돌아가기 버튼 표시
- 버튼 클릭 후 /admin/applications 복귀
- 영수증 월 2026-06~2026-06 + 신청자 검색 적용 시 대상 행만 표시
- 전체기간 클릭 시 월 From/To 입력값 초기화
```

추가 인앱 브라우저 확인:

```text
계정: admin / password
URL: http://localhost:3000/admin/applications
확인 내용:
- 검색조건 패널에 상태, 영수증 월 From/To, 신청자 텍스트 입력, 전체기간 표시
- 영수증 월 From `20260699` 입력 결과: `2026-06`
- 영수증 월 To `202606` 입력 결과: `2026-06`
- 신청자 `김` 입력 가능
- 첨부 다운로드 월 `20261288` 입력 결과: `2026-12`
```

후속 local 3000 반영 및 인앱 브라우저 확인:

```bash
docker compose up --build -d backend frontend
docker compose ps
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

결과:

- `theieum-frontend-1`: Up, `0.0.0.0:3000->80/tcp`
- `theieum-backend-1`: Up, `0.0.0.0:8080->8080/tcp`
- `theieum-postgres-1`: healthy
- `http://localhost:3000`: HTTP 200

인앱 브라우저 확인:

```text
계정: admin / password
확인 내용:
- `/admin/applications` 검색조건에 `신청자` 텍스트 입력 표시
- `영수증 월 From`에 `20260699` 입력 결과: `2026-06`
- `영수증 월 To`에 `202606` 입력 결과: `2026-06`
- `신청자`에 `채` 입력 시 채동훈 행 표시
- `/admin/calendar`가 관리 메뉴에 표시되고 업무 메뉴에는 별도 `/calendar` 링크가 없음
- 캘린더 일정 등록 모달에서 `시작일` `20260610` 입력 결과: `2026-06-10`
- `종료일 캘린더 선택`에서 `2026-06-11` 선택 시 `종료일` 텍스트 입력도 `2026-06-11`
- `/admin/notifications` 테이블 헤더가 `로그 ID`, `알림 내용`, `수신자`, `사용처`, `신청상태`, `발송상태`, `채널`, `읽음`, `처리 시각`으로 표시
- 알림 로그 행에 제목/본문, 수신자명, 사용처, 신청상태, 발송상태, 채널, 읽음상태, 생성/발송시각 표시
- `/approvals` 검색조건에 `접수기간 From/To`, `전체기간` 표시
- `접수기간 From` `20260699`, `접수기간 To` `202606` 입력 결과: 각각 `2026-06`
- `전체기간` 클릭 시 접수기간 From/To 입력값 초기화
- 기존 `/calendar` 직접 접근 시 `/dashboard`로 redirect
```

최종 후속 확인:

```text
URL: http://localhost:3000/admin/notifications
확인 내용:
- 알림 로그 테이블 헤더가 `로그 ID`, `알림 내용`, `수신자`, `사용처`, `신청상태`, `발송상태`, `채널`, `읽음`, `처리 시각`으로 표시
- `사용자 #ID` 보조 문구 미표시
- 로컬 데이터 행은 비어 있었으나, `CREATED -> 발송 전` 표시는 테스트로 검증
```

## 남은 확인 사항

- 실제 스테이징 데이터에서 신청자 이름 한 글자 검색의 결과량이 과도하지 않은지 피드백을 받으면 좋다.
- 알림 로그의 표시 컬럼은 운영 중 필요한 추가 필드가 생기면 관리자 API 응답을 같은 방식으로 확장하면 된다.
