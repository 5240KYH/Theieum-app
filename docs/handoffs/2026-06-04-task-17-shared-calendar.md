# Task 17 공용 캘린더 인수인계

작성일: 2026-06-04, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
현재 브랜치: `codex/task-15-mobile-pwa-staging`

## 목표

모든 로그인 사용자가 같은 일정을 확인할 수 있는 내부 공용 캘린더를 추가했다. 일정 관리는 `ADMIN`과 `MANAGER`에게만 허용하고, 일반 사용자는 조회 전용으로 사용한다.

## 구현 범위

- `calendar_events` DB 테이블 추가
- `/api/calendar/events` 조회, 생성, 수정, 삭제 API 추가
- 대시보드 공용 캘린더 요약 추가
- `/calendar` 전체 캘린더 화면 추가
- `/calendar` 화면을 월/주/목록 전환, 날짜 셀 일정 칩, 날짜별 빠른 추가 버튼 중심으로 개선
- 사이드바와 모바일 하단 탭에 `캘린더` 메뉴 추가
- 일정 등록/수정/삭제 모달 추가
- 대시보드 공용 캘린더에 현재 형태, 주단위, 월단위 보기 전환 추가
- 모바일 캘린더 그리드와 일정 목록 스타일 추가
- 관리자 운영 가이드와 루트 인수인계 문서 최신화

## 권한과 정책

- 모든 로그인 사용자는 일정을 조회할 수 있다.
- `ADMIN`과 `MANAGER`는 일정을 생성, 수정, 삭제할 수 있다.
- `APPLICANT`와 `APPROVER`는 일정 관리 버튼을 볼 수 없고 API 호출도 `403 Forbidden`으로 차단된다.
- 일정 삭제는 물리 삭제이며 삭제 전 브라우저 확인창을 표시한다.
- Google Calendar 연동은 Task 17 범위에 포함하지 않았다. 후속 task에서 내부 캘린더와 외부 캘린더의 단방향 가져오기부터 검토하는 것이 안전하다.

## 주요 변경 파일

```text
backend/src/main/java/com/theieum/approval/calendar/CalendarEvent.java
backend/src/main/java/com/theieum/approval/calendar/CalendarEventRepository.java
backend/src/main/java/com/theieum/approval/calendar/CalendarEventService.java
backend/src/main/java/com/theieum/approval/calendar/CalendarController.java
backend/src/main/resources/db/migration/V3__create_calendar_events.sql
backend/src/test/java/com/theieum/approval/calendar/CalendarEventServiceTest.java
backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java
frontend/src/calendar/calendarTypes.ts
frontend/src/calendar/calendarApi.ts
frontend/src/calendar/calendarUtils.ts
frontend/src/calendar/CalendarPage.tsx
frontend/src/calendar/CalendarPage.test.tsx
frontend/src/app/router.tsx
frontend/src/dashboard/DashboardPage.tsx
frontend/src/dashboard/DashboardPage.test.tsx
frontend/src/shared/layout/AppLayout.tsx
frontend/src/shared/layout/AppLayout.test.tsx
frontend/src/app/styles.css
docs/admin-user-guide.md
docs/handoff-2026-06-03.md
```

## 검증 완료

Task 17 진행 중 targeted 검증:

```bash
cd /Users/kyh/theieum/frontend
npm run test -- CalendarPage.test.tsx DashboardPage.test.tsx AppLayout.test.tsx
npm run build
```

결과: 캘린더/대시보드/레이아웃 테스트 11개 통과, frontend build 성공.

```bash
cd /Users/kyh/theieum
docker compose up -d postgres-test
docker run --rm --network host \
  -v /Users/kyh/theieum:/workspace \
  -w /workspace/backend \
  -e GRADLE_USER_HOME=/workspace/.gradle \
  eclipse-temurin:21-jdk \
  ./gradlew test --tests com.theieum.approval.calendar.CalendarEventServiceTest

docker run --rm --network host \
  -v /Users/kyh/theieum:/workspace \
  -w /workspace/backend \
  -e GRADLE_USER_HOME=/workspace/.gradle \
  eclipse-temurin:21-jdk \
  ./gradlew test --tests com.theieum.approval.api.ApiAuthorizationTest
```

결과: 두 targeted backend 테스트 모두 `BUILD SUCCESSFUL`.

최종 전체 프론트 검증:

```bash
cd /Users/kyh/theieum/frontend
npm run test
npm run build
```

결과: 10 files, 54 tests passed. `vite build` 성공.

최종 전체 백엔드 검증:

```bash
cd /Users/kyh/theieum
docker run --rm --network host \
  -v /Users/kyh/theieum:/workspace \
  -w /workspace/backend \
  -e GRADLE_USER_HOME=/workspace/.gradle \
  eclipse-temurin:21-jdk \
  ./gradlew test
```

결과: `BUILD SUCCESSFUL`.

정리 검증:

```bash
cd /Users/kyh/theieum
git diff --check
```

결과: 출력 없음.

## 2026-06-04 추가 UX 개선

사용자 요청에 따라 캘린더 형태와 입력 방법을 Google Calendar에 가까운 조작 흐름으로 보강했다.

- 전체 캘린더 화면에 `월`, `주`, `목록` 세그먼트 전환을 추가했다.
- 월/주 캘린더 날짜 셀 안에 `시간 + 제목` 일정 칩을 표시한다.
- `ADMIN`/`MANAGER`는 날짜 셀의 추가 버튼으로 해당 날짜에 빠르게 일정을 등록할 수 있다.
- 일반 사용자는 일정 칩 또는 목록 상세 버튼으로 조회 전용 일정 상세를 열 수 있다.
- 일정 입력 모달은 제목 입력을 먼저 배치하고, 시작/종료/종일/장소/상세 입력 흐름을 정리했다.
- 대시보드 공용 캘린더는 `현재 형태`, `주단위`, `월단위` 보기로 전환할 수 있다.

추가 검증:

```bash
cd /Users/kyh/theieum/frontend
npm run test -- CalendarPage.test.tsx DashboardPage.test.tsx
npm run test
npm run build
```

결과: targeted 테스트 4개 통과, 전체 프론트 테스트 10 files / 55 tests 통과, production build 성공.

Docker 앱 반영 및 브라우저 스모크:

```bash
cd /Users/kyh/theieum
docker compose up -d --build frontend
```

결과: `frontend`와 의존 `backend` 이미지가 빌드되고 컨테이너가 재생성/시작되었다. 브라우저에서 `http://127.0.0.1:3000/calendar`와 `/dashboard`를 확인했다.

브라우저 확인 항목:

- `/calendar`: `월 보기`, `주 보기`, `목록 보기`, `일정 등록` 노출 확인
- `/calendar`: `주 보기` 클릭 시 `주간 일정`, `목록 보기` 클릭 시 `월간 목록` 표시 확인
- `/calendar`: `일정 등록` 클릭 시 제목 placeholder `제목 추가`, 시작/종료/종일/장소/상세/저장 입력 모달 확인
- `/dashboard`: `현재 형태`, `주단위`, `월단위` 전환 및 `이번 주 일정`, `이번 달 일정` 표시 확인

## 2026-06-04 2차 UX/시간 처리 개선

사용자 피드백에 따라 입력 방식, 주 이동, 시간 표시, 대시보드 달력 형태를 다시 보강했다.

변경 내용:

- 일정 입력 모달을 `제목`, `시작일`, `시작 시간`, `종료일`, `종료 시간`, `종일`, `장소`, `상세 내용` 순서로 재구성했다.
- 시간 입력은 `datetime-local` 하나가 아니라 날짜와 시간을 분리해 Google Calendar/Outlook류 입력 흐름에 가깝게 바꿨다.
- 종일 일정은 시간 입력을 비활성화하고 날짜 범위만 저장한다.
- 서버 응답의 offset이 `Z` 또는 `+09:00`이어도 서울 시간 기준 날짜/시간 입력값으로 변환한다.
- 일정 표시를 `YYYY-MM-DD HH:mm~HH:mm`, 다른 날짜 일정은 `YYYY-MM-DD HH:mm ~ YYYY-MM-DD HH:mm`, 종일 일정은 `YYYY-MM-DD 종일` 또는 `YYYY-MM-DD ~ YYYY-MM-DD 종일`로 정리했다.
- 주 보기에서 이전/다음 버튼은 월이 아니라 7일 단위로 이동한다.
- 대시보드는 캘린더 관리 화면과 같은 `CalendarBoard` 달력 컴포넌트를 사용한다.
- 대시보드에서는 `전체 캘린더` 이동 링크를 제거했다.

추가/변경 파일:

```text
frontend/src/calendar/CalendarBoard.tsx
frontend/src/calendar/calendarUtils.test.ts
frontend/src/calendar/calendarUtils.ts
frontend/src/calendar/CalendarPage.tsx
frontend/src/calendar/CalendarPage.test.tsx
frontend/src/dashboard/DashboardPage.tsx
frontend/src/dashboard/DashboardPage.test.tsx
frontend/src/app/styles.css
docs/admin-user-guide.md
docs/handoff-2026-06-03.md
```

추가 검증:

```bash
cd /Users/kyh/theieum/frontend
npm run test -- calendarUtils.test.ts CalendarPage.test.tsx DashboardPage.test.tsx
npm run test
npm run build
```

결과: targeted 테스트 11개 통과, 전체 프론트 테스트 11 files / 62 tests 통과, production build 성공.

정리 검증:

```bash
cd /Users/kyh/theieum
git diff --check
```

결과: 출력 없음.

Docker 앱 반영:

```bash
cd /Users/kyh/theieum
docker compose up -d --build frontend
```

결과: frontend/backend 이미지가 빌드되고 컨테이너가 재생성/시작되었다.

브라우저 확인 항목:

- `/calendar`: 날짜/시간 분리 입력 모달 노출 확인
- `/calendar`: 주 보기에서 `다음 주` 클릭 시 `2026-05-31` 주에서 `2026-06-07` 주로 이동 확인
- `/dashboard`: `월 보기`, `주 보기`, `목록 보기`가 있는 달력형 패널 확인

제약:

- 현재 브라우저 자동화 환경은 페이지 내부 `fetch`/`localStorage` 접근과 입력 fill이 제한되어, 실제 API 생성/삭제를 통한 저장값 확인은 수행하지 못했다.
- 대신 프론트 테스트에서 저장 요청 body가 `2026-06-10T13:30:00+09:00` / `2026-06-10T15:45:00+09:00`로 생성되는 것을 검증했다.

## 주의점

- 호스트 `./gradlew test`는 Java 21 toolchain 부재로 실패한다. 백엔드 테스트는 Docker JDK 21 컨테이너를 사용한다.
- 이 작업은 기존 실행 중인 Docker 앱의 DB에 새 Flyway migration `V3__create_calendar_events.sql`을 적용한다.
- 사용자가 명시적으로 요청하기 전까지 `git add`, `git commit`, `git push`는 하지 않는다.

## 다음 후보

1. Task 18 스테이징 외부 체험 운영 준비
2. Google Calendar 단방향 가져오기 설계
3. 공휴일/반복 일정/알림 기능 확장
