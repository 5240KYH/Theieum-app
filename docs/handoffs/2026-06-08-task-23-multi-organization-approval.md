# Task 23 다중 소속/겸직 결재 기준 조직 구현/검증 인수인계

작성일: 2026-06-08, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
현재 브랜치: `codex-multi-organization-approval`
기준 커밋: `ef2de84 feat: harden staging attachments and calendar ux`

## 재시작 프롬프트

```text
Task 23 다중 소속/겸직 결재 기준 조직 구현 결과를 이어서 확인해주세요.
```

## 먼저 읽을 문서

```text
AGENTS.md
docs/handoff-2026-06-03.md
docs/admin-user-guide.md
docs/staging-trial-data-and-attachments.md
docs/superpowers/specs/2026-06-08-multi-organization-approval-design.md
docs/superpowers/plans/2026-06-08-multi-organization-approval.md
```

## 변경 요약

- `user_organizations` 테이블과 `applications.approval_organization_id`를 추가하는 V4 Flyway 마이그레이션을 작성했다.
- 기존 사용자 대표 소속과 기존 신청서 결재 기준 조직을 마이그레이션에서 backfill하도록 했다.
- 더이음사랑의교회 조직 seed 트리를 추가하고, 기존 루트 조직 중복 생성을 피하도록 idempotent하게 구성했다.
- 사용자 소속 목록 조회/저장/검증을 담당하는 `UserOrganizationService`를 추가했다.
- 관리자 사용자 API가 `organizationMemberships`를 내려주고 저장하도록 확장했다.
- 신청서 임시저장/수정 시 `approvalOrganizationId`를 저장하고, 제출 시 저장된 결재 기준 조직으로 결재선 snapshot을 생성하도록 변경했다.
- `GET /api/applications/approval-organizations`와 선택 조직 기준 `approval-preview` API를 추가/변경했다.
- 결재선 resolver가 선택 조직 멤버십 기준으로 `ORG_POSITION` 결재자를 찾도록 변경했고, 동일 결재자 중복 step을 제거했다.
- 조직/사용자 hard delete에서 `user_organizations`와 `applications.approval_organization_id` 참조를 보호하도록 보강했다.
- 관리자 사용자 화면에서 소속 추가/삭제, 대표 소속 지정, 활성 여부 편집 UI를 추가했다.
- 신청서 작성/수정 화면에서 `결재 기준 조직` 선택 UI와 선택 조직 기준 예상 결재선 미리보기를 추가했다.
- 신청서 상세 화면에서 저장된 결재 기준 조직을 표시하도록 했다.
- 사용자 소속 원본은 `user_organizations`이고, `users.organization_id`는 대표 소속 mirror라는 운영 설명을 추가했다.
- 관리자 사용자 관리에서 소속 목록 편집, 대표 소속 1개 지정, 대표 소속 활성 상태 유지, 저장 시 mirror 동기화 정책을 정리했다.
- 신청서 작성/수정 화면의 `결재 기준 조직` 선택 정책을 정리했다.
- `결재 기준 조직`은 본인의 활성 소속 중 선택하며, 대표 소속을 기본값으로 사용한다고 명시했다.
- 예상 결재선과 제출 결재선이 같은 선택 조직 기준으로 산정된다고 명시했다.
- 제출 API는 별도 조직 ID를 받지 않고, 임시저장/수정에 저장된 `approvalOrganizationId`를 사용한다고 정리했다.
- `더이음사랑의교회` 아래 예배부/총무부/재정부/미래준비부와 팀 seed 트리를 스테이징 체험 런북에 추가했다.

## 주요 변경 파일

Backend:

```text
backend/src/main/resources/db/migration/V4__add_user_organizations_and_approval_organization.sql
backend/src/main/java/com/theieum/approval/user/UserOrganizationService.java
backend/src/main/java/com/theieum/approval/admin/AdminController.java
backend/src/main/java/com/theieum/approval/admin/AdminHardDeleteService.java
backend/src/main/java/com/theieum/approval/application/Application.java
backend/src/main/java/com/theieum/approval/application/ApplicationController.java
backend/src/main/java/com/theieum/approval/application/ApplicationService.java
backend/src/main/java/com/theieum/approval/approval/ApprovalLineResolver.java
```

Backend tests:

```text
backend/src/test/java/com/theieum/approval/user/UserOrganizationServiceTest.java
backend/src/test/java/com/theieum/approval/common/DatabaseMigrationTest.java
backend/src/test/java/com/theieum/approval/approval/ApprovalLineResolverTest.java
backend/src/test/java/com/theieum/approval/application/ApplicationSubmissionTest.java
backend/src/test/java/com/theieum/approval/admin/AdminHardDeleteServiceTest.java
backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java
```

Frontend:

```text
frontend/src/admin/adminTypes.ts
frontend/src/admin/AdminReferencePage.tsx
frontend/src/admin/AdminReferencePage.test.tsx
frontend/src/applications/applicationTypes.ts
frontend/src/applications/applicationApi.ts
frontend/src/applications/ApplicationForm.tsx
frontend/src/applications/ApplicationForm.test.tsx
frontend/src/applications/ApplicationDetailPage.tsx
frontend/src/applications/ApplicationDetailPage.test.tsx
```

Docs:

```text
docs/admin-user-guide.md
docs/staging-trial-data-and-attachments.md
docs/handoff-2026-06-03.md
docs/handoffs/2026-06-08-task-23-multi-organization-approval.md
docs/superpowers/specs/2026-06-08-multi-organization-approval-design.md
docs/superpowers/plans/2026-06-08-multi-organization-approval.md
```

## Task 23 운영 메모

### 사용자 소속 데이터

- `user_organizations`가 사용자 소속 목록의 원본이다.
- `users.organization_id`는 대표 소속 mirror다.
- 기존 단일 소속 API 호환을 위해 `organizationId`는 유지하지만, 새 운영 기준은 `organizationMemberships`다.
- 대표 소속은 사용자별로 정확히 1개이며 활성 소속이어야 한다.
- 대표 소속 저장 시 `user_organizations.primary_flag`와 `users.organization_id`를 같은 트랜잭션에서 동기화한다.

### 신청서 결재 기준 조직

- 작성/수정 화면에서 `결재 기준 조직`을 선택한다.
- 선택지는 작성자 본인의 활성 소속으로 제한된다.
- 대표 소속이 기본 선택된다.
- 예상 결재선 미리보기와 제출 결재선 생성은 같은 선택 조직 기준이다.
- 제출 API는 별도 조직 ID를 받지 않으며, 저장된 `approvalOrganizationId`를 사용한다.

### 조직 seed

```text
더이음사랑의교회
├─ 예배부
│  ├─ 찬양팀
│  ├─ 미디어팀
│  ├─ 새가족팀
│  └─ 중보기도팀
├─ 총무부
│  ├─ 기획팀
│  └─ 시설팀
├─ 재정부
│  ├─ 회계팀
│  └─ 감사팀
└─ 미래준비부
   ├─ 이음씨드
   └─ 이음키즈
```

## 검증 명령

```bash
cd frontend && npm run test
cd frontend && npm run build
cd backend && TMPDIR=/private/tmp GRADLE_USER_HOME=/Users/kyh/theieum/.gradle-home JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test
docker compose config
docker compose --env-file .env.staging.example -f docker-compose.staging.yml config
git diff --check
```

실제 결과:

- `cd frontend && npm run test`: 69개 테스트 통과
- `cd frontend && npm run build`: TypeScript check와 Vite production build 통과
- `cd backend && ... ./gradlew test`: 108개 테스트 통과
- `docker compose config`: 통과
- `docker compose --env-file .env.staging.example -f docker-compose.staging.yml config`: 통과
- `git diff --check`: 통과

## 브라우저/Docker 확인

브라우저 시나리오 확인:

- 관리자 `admin/password` 로그인 후 `/admin/users`에서 사용자 소속 편집 UI를 확인했다.
- 사용자 편집 폼에서 소속 목록, 대표 소속 라디오, 활성 체크박스, 소속 추가 버튼이 표시되는지 확인했다.
- 기안자 `employee01/password` 로그인 후 `/applications/new`에서 `결재 기준 조직` 선택 UI를 확인했다.
- 대표 소속이 기본 선택되고, 다른 활성 소속 선택 시 선택값과 표시명이 바뀌는지 확인했다.

Docker 서버 기동 확인:

```bash
docker compose up --build -d postgres backend frontend
docker compose ps
docker compose logs --tail=80 backend
docker compose logs --tail=80 frontend
```

실제 결과:

- `theieum-postgres-1`: healthy
- `theieum-backend-1`: `0.0.0.0:8080->8080/tcp` 실행 중
- `theieum-frontend-1`: `0.0.0.0:3000->80/tcp` 실행 중
- 백엔드 로그에서 V4 마이그레이션 적용 및 Spring Boot 기동 성공 확인
- 인앱 브라우저에서 `http://localhost:3000/login` 접속, title `더이음 전자결재`, `로그인` 화면 표시 확인
- 터미널 샌드박스의 `curl http://127.0.0.1:3000`은 로컬 포트 접근 제한으로 실패했지만, 브라우저와 nginx 로그에서는 `200` 응답이 확인되었다.

## 남은 확인 사항

- 실제 스테이징 배포 전에는 `docs/staging-trial-data-and-attachments.md`의 다중 소속/결재 기준 조직 체험 점검을 운영자가 따라 확인한다.
- 운영/스테이징 배포에서는 `local` profile seed 적용 여부와 secret 교체 여부를 별도로 확인한다.
- 현재 작업 트리에는 Task 23 외에 기존 Task 21/22 문서 변경과 `AGENTS.md` 미추적 파일도 남아 있으므로 commit 전 범위를 다시 확인한다.
- 기존 Task 22 문서는 과거 완료 상태 기록이므로 삭제하지 않고, Task 23 최신 업데이트가 위에 위치하도록 유지한다.
