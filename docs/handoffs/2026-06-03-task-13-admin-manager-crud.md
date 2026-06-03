# Task 13 Admin/Manager 관리화면 CRUD 및 권한 인수인계

작성 시점: 2026-06-03 20시대, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
현재 브랜치: `main`
최신 커밋: `8491e6e Implement manager admin permissions and CRUD screens`

## 1. 요청 배경

사용자가 Docker 실행 후 `http://localhost:3000/admin/approval-lines` 화면이 비어 있거나 한 번에 열리지 않는 문제를 보고했습니다. 이후 관리화면 CRUD, 관리자/매니저 권한, 사용자 비밀번호 변경, 신청서 재입력 조건, 화면 이동 시 이전 입력 액션 잔존 문제를 함께 요청했습니다.

최종 정책은 다음과 같습니다.

- 관리화면 메뉴 노출 대상: `ADMIN`, `MANAGER`
- 관리화면 조회/CRUD 대상: `ADMIN`, `MANAGER`
- 사용자관리 화면 CRUD 및 타 사용자 비밀번호 변경: `ADMIN` 전용
- 일반 사용자는 관리화면 메뉴를 보지 못하며 직접 `/admin/...` URL 접근 시 대시보드로 이동
- 역할 문자열은 `MANAGER`를 정식 값으로 사용하되, 기존 오타 호환을 위해 `MANGER`도 매니저로 인식

## 2. 완료된 작업

### 권한 및 라우팅

- 프론트 라우터에서 관리 라우트를 `ADMIN` 또는 `MANAGER`만 접근 가능하도록 변경했습니다.
- 앱 레이아웃의 관리 메뉴도 `ADMIN` 또는 `MANAGER`에게만 보이도록 변경했습니다.
- 로그인 직후와 `/api/me` 갱신 시 서버 roles를 localStorage와 동기화해, 오래된 localStorage 권한 때문에 일반 사용자에게 관리 메뉴가 남는 문제를 막았습니다.
- Spring Security에서 `/error`를 `permitAll` 처리해, Docker 환경에서 `ResponseStatusException(403)`이 401로 바뀌는 문제를 방지했습니다.

### 관리화면 CRUD

- 부서, 직위, 결재선, 사용자 기준정보 화면에 입력/수정/삭제 UI를 추가했습니다.
- `ADMIN`은 모든 관리화면 CRUD가 가능합니다.
- `MANAGER`는 사용자관리 화면을 조회만 할 수 있고, 나머지 관리화면은 CRUD가 가능합니다.
- 삭제는 실제 삭제 대신 `active=false`로 비활성화하는 방식입니다.
- 입력 또는 수정 패널을 연 상태에서 다른 관리화면으로 이동하면 이전 액션 상태가 초기화되도록 수정했습니다.
- 늦게 도착한 이전 화면의 API 응답이 현재 화면 데이터를 덮어쓰지 않도록 요청 race guard를 추가했습니다. 이 수정이 `/admin/approval-lines` 직접 접근 시 빈 화면으로 남는 문제의 핵심 대응입니다.

### 조직관리 트리 표시

- 조직관리 목록은 `parent_id` 기준으로 트리 형태로 정렬됩니다.
- 화면에는 레벨 배지와 들여쓰기가 표시되어 상하위 조직을 쉽게 구분할 수 있습니다.

### 신청서 재입력 조건

- 임시저장 신청서는 다시 수정할 수 있습니다.
- `CANCELED` 상태도 다시 수정할 수 있습니다.
- `IN_APPROVAL`, `APPROVED`, `REJECTED` 상태는 수정할 수 없습니다.
- `CANCELED` 상태를 수정 저장하면 다시 `DRAFT`로 전환됩니다.

### 비밀번호 변경

- 관리자가 사용자관리 화면에서 대상자 비밀번호를 변경할 수 있습니다.
- 로그인 사용자는 상단 사용자 메뉴의 팝업에서 본인 비밀번호를 직접 변경할 수 있습니다.

## 3. 주요 변경 파일

백엔드:

- `backend/src/main/java/com/theieum/approval/admin/AdminController.java`
  - 관리자 기준정보 CRUD API 권한 분리
  - 일반 기준정보는 `ADMIN`/`MANAGER`, 사용자 CRUD와 타 사용자 비밀번호 변경은 `ADMIN` 전용
- `backend/src/main/java/com/theieum/approval/application/Application.java`
  - 수정 가능 상태 판단 로직 보강
- `backend/src/main/java/com/theieum/approval/application/ApplicationService.java`
  - `CANCELED` 재수정 허용 및 저장 시 `DRAFT` 복귀
  - 관리자 예외 결재를 `MANAGER`도 수행 가능하게 조정
- `backend/src/main/java/com/theieum/approval/auth/AuthController.java`
  - `/api/me/password` 본인 비밀번호 변경 API 추가
- `backend/src/main/java/com/theieum/approval/auth/SecurityConfig.java`
  - `/error` 허용
- `backend/src/main/java/com/theieum/approval/user/User.java`
  - 비밀번호 해시 변경 메서드 추가
- `backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java`
  - 일반 사용자/매니저/관리자 권한 테스트 추가
  - 비밀번호 변경과 취소 신청서 재수정 테스트 추가

프론트엔드:

- `frontend/src/admin/AdminReferencePage.tsx`
  - 기준정보 CRUD UI 추가
  - 사용자관리 CRUD는 관리자 전용으로 제한
  - 조직 트리 표시
  - 화면 전환 시 form/action 상태 초기화
  - 이전 요청 응답 race guard 추가
- `frontend/src/admin/adminApi.ts`
  - 기준정보 CRUD 및 관리자 비밀번호 변경 API 추가
- `frontend/src/app/router.tsx`
  - 관리 라우트 접근 권한을 `ADMIN`/`MANAGER` 기준으로 조정
- `frontend/src/shared/layout/AppLayout.tsx`
  - 관리 메뉴 권한 필터링
  - 본인 비밀번호 변경 팝업 추가
- `frontend/src/auth/AuthContext.tsx`
  - roles 정규화 및 `/api/me` 동기화 보강
- `frontend/src/applications/ApplicationForm.tsx`
- `frontend/src/applications/ApplicationDetailPage.tsx`
- `frontend/src/applications/applicationTypes.ts`
  - 수정 가능 상태와 신청서 수정 라우팅 보강
- 테스트:
  - `frontend/src/admin/AdminReferencePage.test.tsx`
  - `frontend/src/shared/layout/AppLayout.test.tsx`
  - `frontend/src/auth/LoginPage.test.tsx`
  - `frontend/src/applications/ApplicationDetailPage.test.tsx`

## 4. 검증 결과

백엔드:

```text
cd /Users/kyh/theieum/backend
./gradlew test
BUILD SUCCESSFUL
```

프론트엔드:

```text
cd /Users/kyh/theieum/frontend
npm test -- --run
8 files, 35 tests passed

npm run build
build passed
```

Docker:

```text
cd /Users/kyh/theieum
docker compose up --build -d
success
```

Docker 실행 후 확인한 항목:

- 최신 프론트 빌드 asset: `index-KAF74k0g.js`
- `admin/password` 로그인: 200
- `/api/admin/approval-lines`: 200, 배열 응답
- `/api/me`: 200
- 일반 사용자 `/api/admin/positions`: 403
- 매니저 `/api/admin/positions`: 200
- 매니저 `/api/admin/users`: 200
- 매니저 사용자 생성: 403
- 매니저 타 사용자 비밀번호 변경: 403
- 매니저 `/api/admin/applications`: 200

## 5. 운영 및 재현 메모

- Docker 재빌드 후 브라우저가 이전 JS asset을 잡고 있으면 `Cmd+Shift+R`로 하드 새로고침하세요.
- 매니저 권한은 사용자 roles에 `MANAGER`를 부여합니다. 신청서 작성/조회 업무도 필요하면 `MANAGER,APPLICANT`처럼 함께 부여하세요.
- `MANAGER`만 가진 사용자는 매니저 관리 권한은 있지만 applicant 전용 업무 라우트는 제한될 수 있습니다.
- 사용자관리 화면은 매니저에게도 보이지만 조회 전용입니다.
- 결재선 입력 UI는 현재 textarea 기반 형식입니다.
  - 형식: `순서,유형,조직범위,직위ID,사용자ID,정렬정책`
  - 예: `1,POSITION,REQUESTER_DEPARTMENT,5,,LOWEST_POSITION_ORDER`
- Docker 로컬 DB가 수동 테스트 때문에 이상해졌거나 Flyway checksum 문제가 나면, 데이터 초기화가 허용되는 상황에서 아래 명령으로 재생성하세요.

```bash
cd /Users/kyh/theieum
docker compose down -v
docker compose up --build -d
```

## 6. 다음에 하면 좋은 작업

1. 실제 브라우저에서 `ADMIN`, `MANAGER`, 일반 사용자 각각 로그인해 관리 메뉴 노출과 직접 URL 접근을 한 번 더 확인합니다.
2. 결재선관리 입력 UI를 textarea에서 행 단위 편집기와 select/dropdown 기반 UI로 개선하면 실사용성이 좋아집니다.
3. Playwright 환경이 준비되어 있으면 `approval-lines` 직접 접근, 매니저 권한, 일반 사용자 메뉴 숨김을 E2E로 추가합니다.
4. README 또는 seed 문서에 `MANAGER` 역할 부여 방법을 명시합니다.

## 7. 새 채팅 시작 프롬프트

새 채팅에서 이어갈 때는 아래 문장을 붙여 넣으면 됩니다.

```text
/Users/kyh/theieum 프로젝트를 이어서 진행해주세요.
먼저 docs/handoff-2026-06-03.md와 docs/handoffs/2026-06-03-task-13-admin-manager-crud.md를 읽고,
현재 커밋 8491e6e 이후 git status와 Docker 상태를 확인한 뒤 다음 요청을 진행해주세요.
관리화면 권한 정책은 ADMIN/MANAGER 기준이며 사용자관리 CRUD는 ADMIN 전용입니다.
```
