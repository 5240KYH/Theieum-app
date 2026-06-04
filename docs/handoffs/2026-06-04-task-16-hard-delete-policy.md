# Task 16 데이터 완전 삭제 인수인계

작성일: 2026-06-04, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
현재 브랜치: `codex/task-15-mobile-pwa-staging`

## 목표

기존 비활성화 기능은 유지하면서, 테스트/오입력 데이터를 복구 불가로 정리할 수 있는 완전 삭제 기능을 추가했다.

## 구현 범위

- 사용자, 조직, 직위, 결재선, 조직별 예외 결재자 완전 삭제
- 작성자 본인의 `DRAFT`/`CANCELED` 신청서 완전 삭제
- `ADMIN`의 모든 사용자 `DRAFT`/`CANCELED` 신청서 완전 삭제
- 신청서 첨부 DB row와 실제 파일 삭제
- 완전 삭제 확인 모달과 서버 차단 메시지 표시
- 기존 삭제 동작은 `비활성화`로 명확히 표시

## 권한과 정책

- 기준정보 완전 삭제는 `ADMIN`만 가능하다.
- 신청서 완전 삭제는 작성자 본인 또는 `ADMIN`만 가능하다.
- 신청서 상태가 `IN_APPROVAL`, `APPROVED`, `REJECTED`이면 완전 삭제할 수 없다.
- 기준정보가 신청서, 결재 단계, 결재 이력, 첨부, 알림, 결재선, 예외 결재자에서 참조되면 완전 삭제를 차단한다.

## 주요 변경 파일

```text
backend/src/main/java/com/theieum/approval/admin/AdminHardDeleteService.java
backend/src/main/java/com/theieum/approval/admin/AdminController.java
backend/src/main/java/com/theieum/approval/application/ApplicationHardDeleteService.java
backend/src/main/java/com/theieum/approval/application/ApplicationController.java
backend/src/main/java/com/theieum/approval/attachment/FileStorage.java
backend/src/main/java/com/theieum/approval/attachment/LocalFileStorage.java
backend/src/test/java/com/theieum/approval/admin/AdminHardDeleteServiceTest.java
backend/src/test/java/com/theieum/approval/application/ApplicationHardDeleteTest.java
backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java
frontend/src/admin/adminApi.ts
frontend/src/admin/AdminReferencePage.tsx
frontend/src/admin/AdminReferencePage.test.tsx
frontend/src/admin/AdminApplicationsPage.tsx
frontend/src/admin/AdminApplicationsPage.test.tsx
frontend/src/applications/applicationApi.ts
frontend/src/applications/ApplicationDetailPage.tsx
frontend/src/applications/ApplicationDetailPage.test.tsx
frontend/src/app/styles.css
docs/admin-user-guide.md
docs/deployment-readiness-checklist.md
```

## 검증 완료

백엔드 전체 테스트는 호스트 Java 21 부재로 Docker JDK 21 컨테이너에서 실행했다.

```bash
docker compose up -d postgres-test
docker run --rm --network host \
  -v /Users/kyh/theieum:/workspace \
  -w /workspace/backend \
  -e GRADLE_USER_HOME=/workspace/.gradle \
  eclipse-temurin:21-jdk \
  ./gradlew test
```

결과: `BUILD SUCCESSFUL`.

프론트 전체 테스트와 빌드:

```bash
cd /Users/kyh/theieum/frontend
npm run test
npm run build
```

결과: 9 files, 52 tests passed. `vite build` 성공.

정리 검증:

```bash
cd /Users/kyh/theieum
git diff --check
```

결과: 출력 없음.

## 주의점

- 호스트 `./gradlew test`는 Java 21 toolchain 미설치로 실패한다. 백엔드 테스트는 위 Docker JDK 21 명령을 사용한다.
- `docker compose up -d postgres-test`를 실행해 테스트한 뒤 `docker compose stop postgres-test`로 테스트 DB는 중지했다.
- `docker compose up -d --build backend frontend`로 메인 Docker 앱은 Task 16 코드가 반영된 이미지로 재기동했다.
- 사용자가 명시적으로 요청하기 전까지 `git add`, `git commit`, `git push`는 하지 않았다.

## 다음 후보

1. 전체 검증 완료 후 Task 17 공용 캘린더 설계/구현
2. Task 18 스테이징 외부 체험 운영 준비
3. Google Calendar 연동은 Task 17 이후 별도 단계로 진행
