# Task 14 결재선/신청서/관리 UI 개선 인수인계

작성 시점: 2026-06-03 23시대, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
현재 브랜치: `main`
현재 마지막 커밋: `7f7d6b2 docs: add admin manager CRUD handoff`
상태: 커밋 전, 작업트리에 변경사항이 남아 있음

## 1. 이번 작업 배경

사용자가 Task 13 이후 실제 화면을 확인하면서 다음 개선을 요청했습니다.

- 신청서와 관리화면의 필수값 표시
- 결재신청 시 예상 결재선 표시
- 로그인 후 메인/상단에 로그인 대상자 이름 표시
- 로그아웃 전 확인창 표시
- 사용자 역할을 수기 입력 대신 체크박스로 관리
- 조직/직위/대상자 입력을 숫자 또는 텍스트 대신 콤보로 변경
- 결재선관리의 영문 콤보값을 한글로 표시
- 결재선관리 안내문과 사용 예시 추가
- 결재신청서의 예상 결재선 위치 조정
- 영수증 이미지 첨부 필수 표시 줄바꿈 방지
- 결재유형 ID를 신청서 유형명 콤보로 변경
- 결재선 직접 사용자도 `#ID 이름` 콤보로 변경
- 조직범위에 `상위 조직` 추가
- 3레벨 조직 구조에서도 요청자 부서, 상위 조직, 최상위 조직 결재선이 동작하도록 백엔드 resolver 확장

## 2. 완료된 주요 변경

### 신청서 작성 화면

- 필수 입력값에 `*` 표시를 추가했습니다.
- 신청서 작성 시 `예상 결재선`을 미리 조회해 표시합니다.
- 예상 결재선을 신청일자 위로 이동했습니다.
- 영수증 이미지 첨부 필수 표시는 `required-inline-label`로 한 줄 유지되게 했습니다.
- 예상 결재선 API는 `GET /api/applications/approval-preview?approvalTypeId=1`을 사용합니다.

### 대시보드/레이아웃

- 로그인 후 화면 상단에 로그인 사용자 이름을 표시합니다.
- 로그아웃 버튼 클릭 시 `window.confirm('로그아웃 하시겠습니까?')` 확인 후 로그아웃합니다.

### 사용자 관리

- 역할 입력을 텍스트 필드에서 체크박스 그룹으로 변경했습니다.
- `MANAGER` 역할을 직접 수기로 입력하지 않고 체크할 수 있습니다.
- 사용자 조직/직위는 숫자 ID 입력 대신 조직명/직위명 콤보로 선택합니다.

### 조직별 예외 결재자 관리

- 조직은 조직명 콤보로 선택합니다.
- 예외 결재자는 사용자 콤보로 선택합니다.

### 결재선 관리 UI

- `결재 유형 ID` 숫자 입력을 `결재 유형` 콤보로 변경했습니다.
  - 현재 seed 기준 선택지는 `영수증 첨부 신청` 하나입니다.
- 결재선 목록의 결재유형 표시도 `#1` 대신 `approvalTypeName`을 사용합니다.
- 단계 유형 콤보는 한글로 표시합니다.
  - `직접 사용자`
  - `조직/직위`
- 단계 유형별로 필요한 입력만 표시합니다.
  - `직접 사용자`: 사용자 콤보만 표시
  - `조직/직위`: 조직범위 콤보와 직위 콤보만 표시
- 사용자 콤보는 동명이인 구분을 위해 `#ID 이름` 형식으로 표시합니다.
- 조직범위 콤보는 아래 값을 사용합니다.
  - `요청자 부서` -> `APPLICANT_ORG`
  - `상위 조직` -> `PARENT_ORG`
  - `최상위 조직` -> `ROOT_ORG`
- 기존 화면의 `REQUESTER_DEPARTMENT`, `ROOT`, `LOWEST_POSITION_ORDER` 표시/저장 불일치 문제를 정리했습니다.
- 결재선 안내문을 최신 정책에 맞게 갱신했습니다.
  - 신청서 유형별 활성 결재선은 하나만 사용
  - 직접 사용자는 특정 사용자를 직접 지정
  - 조직/직위는 조직범위 + 직위로 대상자 산정
  - 상위 조직이 없는 최상위 조직 사용자는 본인 조직 기준 처리

### 백엔드 결재선 산정

- `GET /api/admin/approval-types` API를 추가했습니다.
- 결재선 목록 응답에 `approvalTypeName`을 추가했습니다.
- `ApprovalLineResolver`가 조직범위를 해석하도록 확장했습니다.
  - `APPLICANT_ORG`: 신청자 조직
  - `PARENT_ORG`: 신청자 조직의 부모 조직, 부모가 없으면 본인 조직
  - `ROOT_ORG`: 신청자 조직에서 최상위 조직까지 재귀 탐색
- 3레벨 조직에서 상위 조직/최상위 조직 결재자가 산정되는 테스트를 추가했습니다.

## 3. 주요 변경 파일

백엔드:

- `backend/src/main/java/com/theieum/approval/admin/AdminController.java`
  - 결재유형 목록 API 추가
  - 결재선 목록 응답에 `approvalTypeName` 추가
  - 허용 조직범위에 `PARENT_ORG`, `ROOT_ORG` 추가
- `backend/src/main/java/com/theieum/approval/approval/ApprovalLineResolver.java`
  - 조직범위 해석 로직 추가
  - 상위 조직과 최상위 조직 탐색 로직 추가
- `backend/src/test/java/com/theieum/approval/approval/ApprovalLineResolverTest.java`
  - 상위 조직/최상위 조직 resolver 테스트 추가

프론트엔드:

- `frontend/src/admin/AdminReferencePage.tsx`
  - 결재유형/사용자/직위 콤보 UI
  - 결재선 단계 조건부 입력 UI
  - 결재선 안내문 갱신
  - 사용자 역할 체크박스
  - 사용자/예외결재자 조직/직위/대상자 콤보
- `frontend/src/admin/adminApi.ts`
  - `getAdminApprovalTypes()` 추가
- `frontend/src/admin/adminTypes.ts`
  - `AdminApprovalType`, `approvalTypeName` 추가
- `frontend/src/applications/ApplicationForm.tsx`
  - 예상 결재선 표시
  - 필수값 표시
  - 예상 결재선 위치 변경
- `frontend/src/applications/applicationApi.ts`
  - 예상 결재선 API 추가
- `frontend/src/applications/applicationTypes.ts`
  - 예상 결재선 타입 추가
- `frontend/src/dashboard/DashboardPage.tsx`
  - 로그인 사용자 이름 표시
- `frontend/src/shared/layout/AppLayout.tsx`
  - 로그인 사용자 이름 표시
  - 로그아웃 confirm
- `frontend/src/app/styles.css`
  - 필수 표시, 결재선 편집기, 안내문, 예상 결재선 스타일 추가

테스트:

- `frontend/src/admin/AdminReferencePage.test.tsx`
- `frontend/src/applications/ApplicationForm.test.tsx`
- `frontend/src/dashboard/DashboardPage.test.tsx`
- `frontend/src/shared/layout/AppLayout.test.tsx`
- `backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java`
- `backend/src/test/java/com/theieum/approval/approval/ApprovalLineResolverTest.java`

## 4. 검증 결과

프론트엔드:

```text
cd /Users/kyh/theieum/frontend
npm test -- --run
8 files, 43 tests passed

npm run build
passed
```

백엔드:

로컬 macOS 환경에는 Java 21 toolchain이 없어 `./gradlew test`는 실행 전 단계에서 실패합니다.

```text
Cannot find a Java installation on your machine matching this tasks requirements: {languageVersion=21}
```

대신 Java 21 Docker 컨테이너에서 resolver 테스트를 실행했습니다.

```bash
docker run --rm --network host \
  -v /Users/kyh/theieum/backend:/app \
  -w /app \
  eclipse-temurin:21-jdk \
  ./gradlew test --tests com.theieum.approval.approval.ApprovalLineResolverTest --no-daemon
```

결과:

```text
BUILD SUCCESSFUL
```

Docker:

```text
docker compose build backend
BUILD SUCCESSFUL / Image theieum-backend Built

docker compose build frontend
frontend npm run build passed / Image theieum-frontend Built

docker compose up -d backend frontend
backend/frontend recreated and started

docker compose ps
backend Up
frontend Up
postgres Up healthy
postgres-test Up healthy
```

API smoke:

```text
POST http://127.0.0.1:3000/api/auth/login
admin/password -> 200

GET http://127.0.0.1:3000/api/admin/approval-types
-> [{"id":1,"name":"영수증 첨부 신청",...}]

GET http://127.0.0.1:3000/api/admin/approval-lines
-> approvalTypeName 포함 응답 확인
```

기타:

```text
git diff --check
clean
```

## 5. 현재 작업트리 상태

2026-06-03 23시대 기준 `git status --short`:

```text
 M backend/src/main/java/com/theieum/approval/admin/AdminController.java
 M backend/src/main/java/com/theieum/approval/application/ApplicationController.java
 M backend/src/main/java/com/theieum/approval/application/ApplicationService.java
 M backend/src/main/java/com/theieum/approval/approval/ApprovalLineResolver.java
 M backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java
 M backend/src/test/java/com/theieum/approval/approval/ApprovalLineResolverTest.java
 M frontend/src/admin/AdminReferencePage.test.tsx
 M frontend/src/admin/AdminReferencePage.tsx
 M frontend/src/admin/adminApi.ts
 M frontend/src/admin/adminTypes.ts
 M frontend/src/app/styles.css
 M frontend/src/applications/ApplicationForm.test.tsx
 M frontend/src/applications/ApplicationForm.tsx
 M frontend/src/applications/applicationApi.ts
 M frontend/src/applications/applicationTypes.ts
 M frontend/src/dashboard/DashboardPage.test.tsx
 M frontend/src/dashboard/DashboardPage.tsx
 M frontend/src/shared/layout/AppLayout.test.tsx
 M frontend/src/shared/layout/AppLayout.tsx
```

주의:

- 위 변경사항은 아직 커밋되지 않았습니다.
- 다음 채팅 시작 시 먼저 `git status --short`, `git diff --stat`, `docker compose ps`를 확인하세요.
- Docker backend/frontend는 최신 이미지로 재기동되어 있습니다.

## 6. 다음 작업 제안

1. 실제 브라우저에서 `/admin/approval-lines` 화면을 열어 결재유형/사용자/직위 콤보와 조건부 입력 노출을 눈으로 확인합니다.
2. 결재선관리에서 저장 오류 메시지를 더 사용자 친화적으로 바꿉니다.
   - 예: `Approval type not found` -> `존재하지 않는 신청서 유형입니다.`
3. 결재선 유형별로 목록 표시를 더 읽기 좋게 바꿉니다.
   - 예: `1. 직접 사용자 #2 결재자01 / 2. 요청자 부서 팀장`
4. 조직장 개념이 업무적으로 확정되면 별도 모델을 추가합니다.
   - 현재는 `조직범위 + 직위`로 조직장을 표현합니다.
   - 예: 개발팀 조직장은 `요청자 부서 + 팀장`
5. 결재유형 자체를 관리하는 CRUD 화면이 필요하면 추가합니다.
   - 현재는 목록 API만 있고, seed 기준 `영수증 첨부 신청` 하나만 존재합니다.
6. Java 21을 로컬에 설치하거나 Gradle toolchain 다운로드 repository를 설정하면 로컬 `./gradlew test`가 가능해집니다.

## 7. 새 채팅 시작 프롬프트

새 채팅에서 아래처럼 시작하면 됩니다.

```text
/Users/kyh/theieum 프로젝트를 이어서 진행해주세요.
먼저 docs/handoff-2026-06-03.md와 docs/handoffs/2026-06-03-task-14-approval-line-usability.md를 읽고,
현재 마지막 커밋 7f7d6b2 이후 git status와 Docker 상태를 확인한 뒤 다음 요청을 진행해주세요.
오늘 작업은 아직 커밋되지 않았고, 결재선관리 UI/조직범위 resolver/신청서 필수 표시/예상 결재선/로그아웃 confirm/역할 체크박스 변경이 포함되어 있습니다.
문서는 한글로 작성하고, TDD와 검증 후 완료 보고 방식을 유지해주세요.
```
