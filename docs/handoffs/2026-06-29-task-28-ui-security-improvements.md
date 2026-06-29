# Task 28 UI/UX 보안 개선 및 병렬 에이전트 운영 인수인계

작업 경로: `/Users/kyh/theieum`
현재 브랜치: `codex/task-28-ui-security-improvements`
기준 커밋: `e93699a`
작성일: 2026-06-29, Asia/Seoul

## 재시작 프롬프트

```text
/Users/kyh/theieum에서 Task 28 UI/UX 보안 개선 작업을 이어서 확인해주세요.
먼저 AGENTS.md, docs/handoff-2026-06-03.md, docs/handoffs/2026-06-29-task-28-ui-security-improvements.md,
docs/superpowers/specs/2026-06-29-ui-security-improvements-design.md,
docs/superpowers/plans/2026-06-29-ui-security-improvements.md를 읽고 현재 작업 트리와 검증 상태를 확인해주세요.
PR 후속 작업 전에는 현재 브랜치와 원격 PR 상태를 먼저 확인해주세요.
```

## 먼저 읽을 문서

- `AGENTS.md`
- `docs/handoff-2026-06-03.md`
- `docs/superpowers/specs/2026-06-29-ui-security-improvements-design.md`
- `docs/superpowers/plans/2026-06-29-ui-security-improvements.md`

## 변경 요약

- 병렬 AI 에이전트 팀 운영 방식으로 UI/UX와 보안 개선을 Wave 단위로 나누어 진행했다.
- `MANAGER`가 관리자 전체 신청서 목록에서 신청서 상세로 이동할 수 있도록 `/applications/:id` route 권한을 맞췄다.
- 서버 역할 판정은 `RoleAccess` helper로 통합하고, `MANGER` 오타 alias, trim, 대소문자 정규화를 한 곳에서 처리한다.
- 첨부 파일 저장소는 read/delete 시 storage root 밖 경로를 거부하고, symlink가 root 밖 파일을 가리키는 경우도 차단한다.
- 신청서 작성은 제출 전 필수 항목별 안내와 `신청서 제출 확인` 모달을 거친다.
- 결재함 승인은 `승인 확인` 모달을 거치며, 승인 실패 오류는 모달 내부에 표시되어 사용자가 실패 사유를 놓치지 않게 했다.
- 관리자 기준정보 화면은 비밀번호 확인 입력, 역할 변경 요약, 완전 삭제 확인 문구를 추가했다.
- 관리자 전체 신청서의 월별 첨부 ZIP 다운로드는 별도 확인 모달에서 민감 자료 다운로드를 확인한 뒤 실행한다.

## 병렬 에이전트 운영 메모

- 이번 작업은 UI routing, backend security, application UX, approval UX, admin safety, review 에이전트로 나누어 진행했다.
- 장점은 독립 화면/계층의 테스트와 구현을 빠르게 병렬화하고, 별도 리뷰어가 누락된 validation과 모달 오류 표시 문제를 잡아냈다는 점이다.
- 주의점은 backend 통합 테스트가 동일 `postgres-test` DB를 `clean()/migrate()`하므로, 여러 에이전트가 동시에 backend SpringBootTest를 실행하면 테스트 DB 경합이 날 수 있다는 점이다.
- 병렬 작업 중 backend 통합 테스트는 Coordinator가 단독 실행하거나, 에이전트별 테스트 DB 격리를 마련한 뒤 병렬화하는 편이 안전하다.

## Git 최종화 운영 메모

- 이번 최종화에서는 PR 요청을 별도 브랜치가 필요한 요청으로 해석해 `codex/task-28-ui-security-improvements` 브랜치를 만들었다.
- 사용자 후속 요청에 따라, 앞으로 이 저장소에서 `commit`, `push`, `pr`을 함께 요청하더라도 별도 브랜치 생성을 명시하지 않았다면 새 브랜치를 만들지 않는다.
- 기본 흐름은 `main` 브랜치 상태에서 검증 후 commit/push를 진행한다.
- GitHub PR은 일반적으로 비교용 head branch가 필요하므로, PR까지 꼭 필요한 상황에서는 `main` 직행 push와 PR 생성 중 어떤 흐름을 원하는지 먼저 확인한다.
- 사용자가 `main`에서 진행하라고 한 경우에는 PR 생성을 위해 임의로 `codex/*` 브랜치를 만들지 않는다.

## 주요 변경 파일

- `backend/src/main/java/com/theieum/approval/auth/RoleAccess.java`
- `backend/src/test/java/com/theieum/approval/auth/RoleAccessTest.java`
- `backend/src/main/java/com/theieum/approval/attachment/LocalFileStorage.java`
- `backend/src/test/java/com/theieum/approval/attachment/LocalFileStorageTest.java`
- `backend/src/main/java/com/theieum/approval/admin/AdminController.java`
- `backend/src/main/java/com/theieum/approval/application/ApplicationController.java`
- `backend/src/main/java/com/theieum/approval/application/ApplicationService.java`
- `backend/src/main/java/com/theieum/approval/approval/ApprovalController.java`
- `backend/src/main/java/com/theieum/approval/calendar/CalendarEventService.java`
- `frontend/src/app/router.tsx`
- `frontend/src/applications/ApplicationForm.tsx`
- `frontend/src/applications/ApplicationForm.test.tsx`
- `frontend/src/approvals/ApprovalsInboxPage.tsx`
- `frontend/src/approvals/ApprovalsInboxPage.test.tsx`
- `frontend/src/admin/AdminReferencePage.tsx`
- `frontend/src/admin/AdminReferencePage.test.tsx`
- `frontend/src/admin/AdminApplicationsPage.tsx`
- `frontend/src/admin/AdminApplicationsPage.test.tsx`
- `frontend/src/app/styles.css`
- `docs/superpowers/specs/2026-06-29-ui-security-improvements-design.md`
- `docs/superpowers/plans/2026-06-29-ui-security-improvements.md`

## 검증 명령과 결과

```bash
cd frontend && npm run test -- AdminApplicationsPage.test.tsx ApplicationForm.test.tsx ApprovalsInboxPage.test.tsx AdminReferencePage.test.tsx
cd frontend && npm run test
cd frontend && npm run build
cd backend && TMPDIR=/private/tmp GRADLE_USER_HOME=/Users/kyh/theieum/.gradle-home JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test --tests com.theieum.approval.attachment.LocalFileStorageTest
cd backend && TMPDIR=/private/tmp GRADLE_USER_HOME=/Users/kyh/theieum/.gradle-home JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test --max-workers=1
cd backend && TMPDIR=/private/tmp GRADLE_USER_HOME=/Users/kyh/theieum/.gradle-home JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test --rerun-tasks --max-workers=1
docker compose config
git diff --check
```

현재 확인된 결과:

- frontend targeted 테스트 42개 통과
- frontend 전체 테스트 85개 통과
- frontend build 통과
- `LocalFileStorageTest` 5개 통과
- backend 전체 테스트는 단독 실행 조건인 `--max-workers=1`에서 통과
- 최종화 직전 backend 전체 테스트는 `--rerun-tasks --max-workers=1`로 실제 재실행해 통과
- `docker compose config` 통과
- `git diff --check` 통과

검증 중 참고 사항:

- backend 전체 테스트를 최종 리뷰 에이전트의 backend 테스트와 동시에 실행했을 때 `application_approval_steps` 누락으로 실패했다.
- 같은 테스트는 병렬 backend 테스트가 끝난 뒤 `--max-workers=1`로 재실행했을 때 통과했다.
- 원인은 코드 회귀보다 여러 에이전트가 같은 `approval_test` DB를 동시에 `clean()/migrate()`한 경합으로 판단된다.

## 남은 확인 사항

- 실제 브라우저에서 신청서 제출 확인, 결재 승인 확인, 관리자 위험 작업 확인 모달의 모바일/데스크톱 레이아웃을 한 번 더 보면 좋다.
- 병렬 에이전트 운영을 계속 사용할 경우 backend 통합 테스트용 DB 격리 전략을 별도 Task로 분리하는 것을 권장한다.
- 최종화 요청에 따라 `codex/task-28-ui-security-improvements` 브랜치에서 커밋/푸시/PR 생성을 진행한다.
- 현재 실행 환경에는 `gh` CLI가 없어 PR 생성은 GitHub connector 또는 GitHub 웹 compare URL 경로가 필요할 수 있다.
- 후속 요청으로, 이후 최종화는 사용자가 별도 브랜치를 명시하지 않는 한 `main` 브랜치 상태에서 진행해야 한다.
