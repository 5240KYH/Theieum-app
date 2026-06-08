# 관리자 운영 가이드

작성일: 2026-06-03

이 문서는 영수증 첨부 전자결재 앱을 관리자 관점에서 실행, 배포, 운영, 이용하는 방법을 정리한다. 현재 애플리케이션은 MVP 단계이며, `docker-compose.yml`은 로컬 검증과 내부 시연용 구성을 기준으로 한다.

## 1. 시스템 구성

| 영역 | 기술 | 설명 |
| --- | --- | --- |
| Frontend | React, Vite, nginx | 사용자/관리자 웹 화면과 `/api/*` 프록시 |
| Backend | Spring Boot, Spring Security, JPA | 인증, 신청서, 결재, 관리자 API |
| Database | PostgreSQL 16 | 사용자, 조직, 결재선, 신청서, 이력, 알림 저장 |
| File Storage | 로컬/볼륨 파일 경로 | 영수증 첨부 이미지 저장 |
| E2E | Playwright | 실제 브라우저 기반 신청/결재 흐름 검증 |

## 2. 로컬 실행 방법

### 2.1 Docker로 전체 앱 실행

가장 간단한 실행 방법이다.

```bash
cd /Users/kyh/theieum
docker compose up --build
```

접속 주소:

| 대상 | 주소 |
| --- | --- |
| 웹 앱 | `http://localhost:3000` |
| Backend API | `http://localhost:8080/api` |
| PostgreSQL | `localhost:5432` |

중지:

```bash
docker compose down
```

개발 DB 볼륨까지 초기화하려면 아래 명령을 사용한다. 기존 로컬 데이터가 삭제되므로 필요한 경우 백업 후 실행한다.

```bash
docker compose down -v
docker compose up --build
```

### 2.2 Backend만 로컬 실행

PostgreSQL만 Docker로 올리고 Backend를 직접 실행할 때 사용한다.

```bash
cd /Users/kyh/theieum
docker compose up -d postgres
cd backend
SPRING_PROFILES_ACTIVE=local \
JWT_SECRET=change-this-local-secret \
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
./gradlew bootRun
```

### 2.3 Frontend만 로컬 실행

Backend가 `localhost:8080`에서 실행 중이어야 한다.

```bash
cd /Users/kyh/theieum/frontend
npm install
npm run dev
```

Vite 개발 서버 주소는 터미널 출력에 표시된다. Docker 실행 기준 운영 형태는 nginx 정적 서빙이다.

## 3. 기본 계정

로컬 `local` profile과 seed 데이터를 사용하는 경우 아래 계정이 생성된다. 모든 seed 계정 비밀번호는 `password`다.

| 역할 | 아이디 | 주요 용도 |
| --- | --- | --- |
| 관리자 | `admin` | 관리자 메뉴, 예외 결재, 기준정보 조회 |
| 기안자 | `employee01` | 영수증 신청 작성, 개발팀 예외 결재선 E2E |
| 개발팀 결재자 | `lead-dev` | 개발팀 신청서 승인/반려 |
| 기본 결재자 | `approver01` | 기본 결재선 검증 |
| 영업팀 결재자 | `lead-sales` | 영업팀/조직 예외 결재자 검증 |

운영 배포에서는 seed 계정을 만들지 않는다. 운영 관리자 계정과 초기 비밀번호 전달 절차는 별도로 정한다.

## 4. 관리자 로그인과 메뉴

1. `http://localhost:3000/login`에 접속한다.
2. 관리자 계정으로 로그인한다.
3. 왼쪽 사이드바의 `관리` 메뉴를 사용한다.

관리자 메뉴:

| 메뉴 | 경로 | 기능 |
| --- | --- | --- |
| 사용자 관리 | `/admin/users` | 사용자 계정, 소속 목록, 대표 소속, 직위, 역할, 활성 상태 관리 |
| 조직 관리 | `/admin/organizations` | 조직명, 상위 조직, 레벨, 정렬, 활성 상태 관리 |
| 직위 관리 | `/admin/positions` | 직위명, 직위 순서, 정렬, 활성 상태 관리 |
| 결재선 관리 | `/admin/approval-lines` | 결재 유형별 결재 단계와 결재선 상태 관리 |
| 예외 결재자 | `/admin/approval-org-exceptions` | 조직별 예외 결재자 관리 |
| 전체 신청서 | `/admin/applications` | 전체 신청서 조회, 상태 필터, 관리자 예외 결재, 임시/취소 신청서 완전 삭제 |
| 알림 로그 | `/admin/notifications` | 알림 유형, 채널, 발송 상태, 읽음 상태 조회 |

관리자 기준정보 화면은 기준정보 생성, 수정, 비활성화, 완전 삭제를 지원한다. `MANAGER`는 일부 기준정보를 관리할 수 있지만 복구 불가 완전 삭제는 `ADMIN`에게만 허용된다.

### 4.1 사용자 소속 관리

Task 23 다중 소속/겸직 지원 이후 사용자 소속의 원본은 `user_organizations`다. 기존 `users.organization_id`는 목록, 인증 응답, 기존 API 호환을 위한 대표 소속 mirror로 유지한다.

사용자 관리 화면에서 관리자는 사용자별 소속 목록을 편집한다.

- 소속은 여러 개 등록할 수 있으며, 한 사용자에게 대표 소속은 반드시 1개만 지정한다.
- 대표 소속은 항상 활성 소속이어야 한다. 대표로 지정하면 해당 소속은 비활성으로 저장할 수 없다.
- 저장 시 대표 소속은 `user_organizations.primary_flag = true`로 저장되고, 같은 트랜잭션에서 `users.organization_id` mirror도 같은 조직 ID로 동기화된다.
- 기존 단일 소속 API 호환을 위해 `organizationId`는 계속 받지만, 운영상 실제 소속 목록은 `organizationMemberships` 기준으로 확인한다.

## 5. 관리자 이용 방법

### 5.1 전체 신청서 확인

1. `관리 > 전체 신청서`로 이동한다.
2. `상태 필터`에서 필요한 상태를 선택한다.
3. 목록에서 신청서 ID, 신청자, 사용처, 상태를 확인한다.

상태 의미:

| 상태 | 의미 |
| --- | --- |
| 임시저장 | 기안자가 작성 중인 신청서 |
| 결재중 | 결재 단계가 진행 중인 신청서 |
| 승인완료 | 모든 결재 단계가 승인된 신청서 |
| 반려 | 결재자가 반려한 신청서 |
| 취소 | 기안자가 임시저장 상태에서 취소한 신청서 |

`ADMIN`은 `임시저장` 또는 `취소` 상태의 신청서만 완전 삭제할 수 있다. `결재중`, `승인완료`, `반려` 신청서는 업무 기록 보호를 위해 완전 삭제할 수 없다.

### 5.2 관리자 예외 결재

관리자 예외 결재는 결재자 부재 등 운영상 필요한 경우에만 사용한다. 모든 예외 결재는 감사 이력에 남는다.

1. `관리 > 전체 신청서`로 이동한다.
2. 상태가 `결재중`인 신청서를 찾는다.
3. `예외 결재` 버튼을 누른다.
4. 현재 대기 중인 결재 단계를 확인한다.
5. `예외 결재 사유`를 입력한다.
6. `예외 승인`을 누른다.

주의:

- 사유를 입력하지 않으면 처리되지 않는다.
- 결재중 상태가 아니면 `예외 결재` 버튼이 비활성화된다.
- 예외 승인 후 신청서 상세의 `결재 이력`에서 실제 처리자와 사유를 확인한다.

### 5.3 신청서 상세와 감사 이력 확인

관리자는 신청서 상세에서 아래 항목을 확인할 수 있다.

- 신청자, 신청일, 영수증 일자, 사용처, 금액, 설명
- 결재 기준 조직
- 첨부 이미지 미리보기
- 결재 진행 상태
- 실제 결재 이력

신청서 작성/수정 화면에서는 `결재 기준 조직`을 선택한다. 선택지는 작성자 본인의 활성 소속으로 제한되며, 기본값은 대표 소속이다. 예상 결재선 미리보기와 실제 제출 시 생성되는 결재선은 모두 같은 선택 조직 기준으로 산정된다.

제출 API는 별도 조직 ID를 받지 않는다. 임시저장 또는 수정 단계에서 저장된 `approvalOrganizationId`를 사용해 제출 시점에 작성자의 활성 소속 여부를 다시 검증하고 결재선을 생성한다.

감사 이력 표의 주요 항목:

| 항목 | 설명 |
| --- | --- |
| 단계 | 결재 단계 번호 |
| 원 결재자 | 원래 배정된 결재자 |
| 처리자 | 실제 승인/반려/예외 승인 처리자 |
| 처리 | 승인, 반려, 관리자 승인 등 처리 결과 |
| 사유/메모 | 결재 의견 또는 관리자 예외 사유 |
| 처리일 | 처리 시각 |

### 5.4 조직별 예외 결재자 확인

1. `관리 > 예외 결재자`로 이동한다.
2. 결재 유형, 조직, 예외 결재자, 단계, 활성 상태를 확인한다.

예외 결재자는 기본 결재선보다 우선 적용된다. 예를 들어 특정 조직에 active 예외 결재자가 있으면 해당 조직 신청서는 기본 결재선 대신 예외 결재자 단계로 생성된다.

### 5.5 기준정보 비활성화와 완전 삭제

기준정보 화면의 `비활성화`는 기존 데이터를 남긴 채 새 업무에서 사용하지 않도록 하는 안전한 처리다. 완전 삭제는 DB row를 제거하는 복구 불가 작업이며 `ADMIN`에게만 표시된다.

완전 삭제 대상:

- 사용자
- 조직
- 직위
- 결재선
- 조직별 예외 결재자

참조 중인 데이터가 있으면 서버가 삭제를 차단한다. 예를 들어 신청서, 결재 이력, 첨부파일, 결재선, 예외 결재자에서 사용 중인 사용자는 완전 삭제할 수 없고 비활성화만 가능하다.

### 5.6 공용 캘린더 관리

공용 캘린더는 모든 로그인 사용자가 조회할 수 있는 공유 일정이다. 대시보드와 `캘린더` 관리 화면 모두 달력 형식으로 제공되며, 월/주/목록 보기로 전환해 확인한다.

권한:

| 역할 | 조회 | 등록/수정/삭제 |
| --- | --- | --- |
| ADMIN | 가능 | 가능 |
| MANAGER | 가능 | 가능 |
| APPROVER | 가능 | 불가 |
| APPLICANT | 가능 | 불가 |

일정 등록:

1. `캘린더` 메뉴로 이동한다.
2. `일정 등록` 버튼을 누르거나 월간 캘린더 날짜 셀의 추가 버튼을 누른다.
3. 제목을 먼저 입력한다.
4. `시작일`, `시작 시간`, `종료일`, `종료 시간`을 입력한다. 종일 일정이면 `종일`을 선택하고 날짜 범위만 확인한다.
5. 장소와 상세 내용을 필요한 경우 입력한다.
6. `저장`을 누른다.

일정 수정/삭제:

1. 월간/주간/목록 보기에서 일정 칩 또는 수정 아이콘을 누른다.
2. 내용을 수정하고 `저장`을 누른다.
3. 삭제가 필요한 경우 `삭제`를 누르고 복구 불가 확인창에서 확인한다.

주의:

- 공용 캘린더 일정은 접속한 모든 사용자에게 보인다.
- 시간 일정은 `YYYY-MM-DD HH:mm~HH:mm` 형식으로 표시된다. 날짜가 다른 일정은 시작과 종료의 날짜/시간을 모두 표시한다.
- 종일 일정은 `YYYY-MM-DD 종일` 또는 `YYYY-MM-DD ~ YYYY-MM-DD 종일`로 표시한다.
- 등록/수정/삭제 권한은 `ADMIN`, `MANAGER`에게만 있다.
- Google Calendar 연동은 아직 포함되지 않았다. 내부 공용 캘린더가 안정화된 뒤 별도 작업으로 진행한다.

### 5.7 알림 로그 확인

1. `관리 > 알림 로그`로 이동한다.
2. 신청서 ID, 수신자 ID, 알림 유형, 채널, 상태, 읽음 여부를 확인한다.

알림 로그는 결재 요청, 반려, 최종 승인, 관리자 예외 승인 등 주요 이벤트 확인에 사용한다.

## 6. 관리자 API 사용 방법

관리자 API는 `ADMIN` 권한 토큰이 필요하다. 아래 예시는 로컬 Docker 앱 기준이다.

### 6.1 로그인 토큰 발급

```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"loginId":"admin","password":"password"}'
```

응답의 `accessToken` 값을 `TOKEN` 변수에 넣는다.

```bash
TOKEN='발급받은_accessToken'
```

### 6.2 사용자 생성

```bash
curl -X POST http://localhost:8080/api/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "loginId": "employee-new",
    "externalSubject": null,
    "password": "password123",
    "name": "신규직원",
    "email": "employee-new@theieum.local",
    "organizationId": 3,
    "positionId": 1,
    "roles": "APPLICANT",
    "active": true,
    "organizationMemberships": [
      {
        "organizationId": 3,
        "primary": true,
        "active": true,
        "sortOrder": 10
      },
      {
        "organizationId": 4,
        "primary": false,
        "active": true,
        "sortOrder": 20
      }
    ]
  }'
```

역할은 쉼표로 여러 개를 지정할 수 있다.

- `APPLICANT`
- `APPROVER`
- `MANAGER`
- `ADMIN`

다중 소속 사용자는 `organizationMemberships`에 소속 목록을 넣는다. 대표 소속은 `primary: true`인 항목이며 반드시 활성 상태여야 한다. `organizationId`는 대표 소속 mirror 값으로 유지되므로 `organizationMemberships`의 대표 조직과 같은 값으로 보낸다. `organizationMemberships`를 생략하면 서버는 기존 호환 방식으로 `organizationId` 1개를 대표 활성 소속으로 저장한다.

### 6.3 조직 생성

```bash
curl -X POST http://localhost:8080/api/admin/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "신규팀",
    "parentId": 1,
    "levelNo": 2,
    "sortOrder": 50,
    "active": true
  }'
```

### 6.4 직위 생성

```bash
curl -X POST http://localhost:8080/api/admin/positions \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "파트장",
    "rankOrder": 35,
    "sortOrder": 35,
    "active": true
  }'
```

### 6.5 결재선 생성

```bash
curl -X POST http://localhost:8080/api/admin/approval-lines \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "approvalTypeId": 1,
    "name": "영수증 첨부 신청 추가 결재선",
    "active": true,
    "steps": [
      {
        "stepOrder": 1,
        "stepType": "DIRECT_USER",
        "directUserId": 2,
        "sortPolicy": "POSITION_ORDER"
      },
      {
        "stepOrder": 2,
        "stepType": "ORG_POSITION",
        "organizationScope": "APPLICANT_ORG",
        "positionId": 4,
        "sortPolicy": "POSITION_ORDER"
      }
    ]
  }'
```

주의:

- 현재 같은 결재 유형에 active 결재선이 여러 개 있으면 결재선 산정 오류가 날 수 있다.
- 운영에서는 기존 active 결재선을 비활성화하는 관리 정책이 필요하다.

### 6.6 조직별 예외 결재자 생성

```bash
curl -X POST http://localhost:8080/api/admin/approval-org-exceptions \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "approvalTypeId": 1,
    "organizationId": 4,
    "approverUserId": 19,
    "stepOrder": 1,
    "active": true
  }'
```

주의:

- `approverUserId`는 active 상태이며 `APPROVER` 역할을 포함해야 한다.
- active 예외 결재자는 기본 결재선보다 우선 적용된다.

## 7. 배포 방법

### 7.1 배포 전 필수 확인

운영 후보 배포 전에는 [배포 전 체크리스트](./deployment-readiness-checklist.md)를 먼저 확인한다.

필수 항목:

- `JWT_SECRET` 교체
- DB 계정/비밀번호 secret 처리
- 운영 파일 저장소 경로 지정
- `local` profile 비활성화
- seed 데이터 제외
- PostgreSQL 외부 공개 차단
- HTTPS 적용
- 백업/복구 절차 준비

### 7.2 로컬 MVP compose와 운영 배포 분리

현재 `docker-compose.yml`은 로컬 MVP 검증용이다.

운영 배포에서는 다음 항목을 별도 운영 템플릿으로 분리한다.

- `SPRING_PROFILES_ACTIVE`
- `JWT_SECRET`
- DB 접속 정보
- 파일 저장소 volume 또는 외부 스토리지
- nginx/프록시/HTTPS 설정
- seed 데이터 적용 여부

### 7.3 사전 체험 스테이징 실행

외부 테스트 인원 5~10명이 체험할 환경은 작은 스테이징 서버에서 실행한다. 로컬 MVP compose를 그대로 인터넷에 공개하지 않고, 단독 staging compose와 환경변수 파일을 사용한다.

```bash
cp .env.staging.example .env.staging
docker compose --env-file .env.staging -f docker-compose.staging.yml config
docker compose --env-file .env.staging -f docker-compose.staging.yml up --build -d postgres backend frontend
```

스테이징에서는 PostgreSQL과 backend 포트를 외부에 직접 열지 않는다. 외부 사용자는 HTTPS가 적용된 frontend URL로만 접속한다.

### 7.4 배포 후보 검증 명령

배포 후보 커밋에서 아래 명령이 통과해야 한다.

```bash
cd /Users/kyh/theieum/backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test
```

```bash
cd /Users/kyh/theieum/frontend
npm run test
npm run build
```

```bash
cd /Users/kyh/theieum/e2e
npm run test
```

```bash
cd /Users/kyh/theieum
docker compose config
git diff --check
```

### 7.5 스테이징 체험 운영

외부 체험을 열기 전 [스테이징 외부 체험 운영 런북](staging-operations-runbook.md)을 기준으로 HTTPS URL과 스모크 검증을 완료한다.

체험자 계정 전달은 [스테이징 체험 계정 전달 양식](staging-tester-account-packet.md)의 역할별 문구를 사용한다. 30명 안팎 계정 배정과 첨부파일 운영 정책은 [스테이징 체험 계정과 첨부파일 관리 런북](staging-trial-data-and-attachments.md)을 기준으로 확인한다. 외부 체험자는 가능하면 개인별 계정으로 배정하고, 개인별 계정에만 첫 로그인 후 비밀번호 변경을 요청한다. 공유 확인용 계정을 전달하는 경우에는 비밀번호를 변경하지 않도록 안내한다.

매니저 시나리오를 맡길 계정은 전달 전 `MANAGER` 역할이 있는지 확인한다. 모든 체험자에게 실제 개인정보 입력 금지와 실제 영수증 업로드 금지를 안내한다. 첨부파일은 기본적으로 신청서당 영수증 이미지 최대 10개, 파일당 5MB 이하로 제한된다.

체험 종료 후에는 DB와 첨부파일 volume 보존 또는 삭제 여부를 결정한다. 삭제가 필요한 경우 서버에서 다음 명령을 사용한다.

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml down -v
```

## 8. 운영 점검

### 8.1 일일 점검

- [ ] 관리자 로그인 가능 여부
- [ ] 결재중 신청서 backlog 확인
- [ ] 관리자 예외 결재 발생 건과 사유 확인
- [ ] 알림 로그의 실패/미발송 이벤트 확인
- [ ] 첨부 이미지 미리보기 오류 여부 확인

### 8.2 장애 대응

| 증상 | 확인할 항목 |
| --- | --- |
| 로그인이 안 됨 | Backend 상태, `JWT_SECRET`, 사용자 active 여부 |
| 신청서 제출 실패 | 영수증 이미지 첨부 여부, 파일 크기, MIME 타입 |
| 결재함에 신청서가 안 보임 | 현재 대기 단계 결재자, 조직별 예외 결재자 설정 |
| 예외 결재 불가 | 신청서 상태가 `결재중`인지, 사유 입력 여부 |
| 첨부 이미지 미표시 | 파일 저장소 경로, backend 파일 읽기 권한, 첨부 content API 권한 |
| 알림이 보이지 않음 | `notification_events` 생성 여부, 알림 로그 상태 |

### 8.3 데이터 보존

운영 전 아래 보존 정책을 정한다.

- 신청서 보존 기간
- 첨부 이미지 보존 기간
- 결재 이력 보존 기간
- 알림 로그 보존 기간
- 백업 주기와 복구 목표 시간

## 9. 알려진 후속 과제

- 운영용 compose 또는 배포 템플릿 분리
- 관리자 기준정보 생성/수정 UI 추가
- 반려 신청서 재상신 기능 구현
- 운영 감사 로그 export 기능 검토
- 사용자/조직/직위 변경 이력 관리
