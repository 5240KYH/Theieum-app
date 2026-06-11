# AGENTS.md

## 기본 원칙

- 이 저장소에서의 기본 응답과 작업 문서는 한국어로 작성한다.
- 코드, 명령어, 파일 경로, 설정 키, 로그 원문은 필요한 경우 원문을 유지한다.
- 사용자의 직접 지시가 있으면 이 문서보다 우선한다.
- 변경 범위는 사용자가 요청한 목적에 필요한 파일로 제한한다.
- 기존 작업 트리 변경사항은 사용자가 만든 것으로 간주하고 임의로 되돌리지 않는다.

## 프로젝트 개요

- 작업 루트: `/Users/kyh/theieum`
- 저장소: 영수증 첨부 전자결재 MVP
- 주요 스택:
  - Backend: Spring Boot, Java 21, Gradle
  - Frontend: React, Vite, TypeScript
  - Database: PostgreSQL, Flyway
  - Local runtime: Docker Compose
- 주요 문서:
  - `README.md`
  - `docs/handoff-2026-06-03.md`
  - `docs/handoffs/`
  - `docs/superpowers/specs/`
  - `docs/superpowers/plans/`
  - `docs/admin-user-guide.md`
  - `docs/staging-operations-runbook.md`
  - `docs/staging-trial-data-and-attachments.md`

## 작업 시작 절차

작업을 시작하기 전에 다음 순서로 현재 상태를 확인한다.

1. 루트 `AGENTS.md`를 확인한다.
2. 작업과 관련된 최신 인수인계 문서를 확인한다.
   - 기본 진입점은 `docs/handoff-2026-06-03.md`이다.
   - task 단위 작업은 `docs/handoffs/`의 관련 파일을 함께 확인한다.
3. 관련 설계/계획 문서가 있으면 확인한다.
   - `docs/superpowers/specs/`
   - `docs/superpowers/plans/`
4. 파일 수정 전에 현재 작업 트리를 확인한다.

```bash
git status --short
git log --oneline -5
```

Git 브랜치, 원격 기본 브랜치, merge 상태가 작업 결과에 영향을 주는 경우 현재 원격 상태를 다시 검증한다.

```bash
git ls-remote --symref origin HEAD
git remote show origin
```

## 문서 작성 규칙

- 설계 문서, 계획 문서, 인수인계 문서는 기본적으로 한국어로 작성한다.
- 새 기능이나 큰 변경은 가능한 경우 다음 흐름을 따른다.
  - 설계: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
  - 계획: `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`
  - 인수인계: `docs/handoffs/YYYY-MM-DD-task-<n>-<topic>.md`
- 컨텍스트가 길어지거나 새 채팅에서 이어서 작업할 가능성이 있으면 task별 인수인계서를 남긴다.
- 인수인계서에는 최소한 다음을 포함한다.
  - 작업 경로
  - 현재 브랜치와 기준 커밋
  - 재시작 프롬프트
  - 먼저 읽을 문서
  - 변경 요약
  - 주요 변경 파일
  - 실행한 검증 명령과 결과
  - 남은 확인 사항
- 과거 상태를 설명하는 문서는 최신 상태로 오해되지 않도록 날짜와 커밋을 분명히 적는다.

## 코드 변경 규칙

- 파일을 수정하기 전에 기존 내용을 먼저 읽는다.
- 기존 패턴, 계층, 네이밍을 우선한다.
- 요청하지 않은 리팩터링, 포맷 변경, 파일 이동은 하지 않는다.
- 대규모 치환, 데이터 삭제, 볼륨 삭제, 초기화처럼 되돌리기 어려운 작업은 명시적 승인 후 진행한다.
- 민감정보가 포함될 수 있는 설정과 로그는 필요한 최소 범위만 확인하고 출력하지 않는다.

## Git 사용

- 사용자가 명시적으로 요청하지 않으면 `git add`, `git commit`, `git push`를 수행하지 않는다.
- 커밋이 필요한 경우 변경 파일과 검증 결과를 먼저 요약하고 사용자의 의도를 확인한다.
- 커밋 메시지는 별도 요청이 없으면 한국어로 작성한다.
- 기존 작업 트리에 다른 변경사항이 있어도 임의로 되돌리지 않는다.
- 원격 기본 브랜치는 현재 `main`으로 운영되지만, 브랜치 정리나 배포 관련 작업에서는 실시간으로 다시 확인한다.

## 검증 기준

코드나 설정을 변경한 경우 가능한 범위에서 검증 명령을 실행한다. 변경 범위에 따라 아래 명령을 조합한다.

Frontend:

```bash
cd frontend && npm run test
cd frontend && npm run build
```

Backend:

```bash
cd backend && ./gradlew test
```

호스트 Java 21 환경이 맞지 않으면 Docker Java 21 컨테이너를 fallback으로 사용한다.

```bash
docker run --rm -v /Users/kyh/theieum:/workspace -w /workspace/backend eclipse-temurin:21 ./gradlew test
```

Docker/스테이징 설정:

```bash
docker compose config
docker compose --env-file .env.staging.example -f docker-compose.staging.yml config
```

공통 문서/공백 검증:

```bash
git diff --check
```

문서만 변경한 경우에는 빌드 대신 다음을 중심으로 검증한다.

- 문서 경로와 링크가 실제로 존재하는지 확인
- 참조한 명령어와 파일명이 현재 저장소 구조와 맞는지 확인
- `git diff --check` 통과 여부 확인

## Docker와 데이터베이스 주의사항

- 기존 개발 DB 볼륨에는 이전 Flyway checksum 상태가 남아 있을 수 있다.
- 검증 중 DB 상태가 의심되면 사용자 데이터가 있는 볼륨을 바로 삭제하지 말고 별도 compose project 또는 테스트 전용 DB를 우선 사용한다.
- Docker 이미지는 task별 임시 compose project 이름으로 새 이미지를 계속 쌓지 않는다.
- 앱 이미지를 다시 빌드해야 하면 기본적으로 기존 안정 이미지명(`theieum-backend`, `theieum-frontend`)을 갱신하는 방식으로 진행한다.
- DB/volume 격리를 위해 임시 compose project가 꼭 필요하면 앱 이미지명 누적 여부를 먼저 고려하고, 부득이하게 임시 이미지가 생긴 경우 작업 종료 전에 해당 이미지 정리까지 수행한다.
- `docker compose down -v`는 로컬 데이터 삭제가 포함되므로 사용자의 명시적 승인 없이 실행하지 않는다.
- 로컬 MVP 검증은 `local` profile과 seed 데이터를 사용할 수 있지만, 운영/스테이징 배포에서는 secret과 seed 적용 여부를 별도로 확인한다.

## 보안과 배포

- `JWT_SECRET`, DB 비밀번호, 개인 키, 쿠키, 토큰을 응답이나 문서에 그대로 노출하지 않는다.
- 외부 공개 환경에서는 `3000`, `8080`, `5432`를 직접 공개하지 않는 원칙을 유지한다.
- 스테이징/운영 배포 작업은 관련 런북을 먼저 확인한다.
  - `docs/staging-operations-runbook.md`
  - `docs/oracle-free-staging-runbook.md`
  - `docs/deployment-readiness-checklist.md`

## 프론트엔드 작업 기준

- 기존 React/Vite 구조와 CSS 패턴을 우선한다.
- 모바일 대시보드, 캘린더, 신청서 작성/상세 화면은 실제 체험 흐름에 민감하므로 UI 변경 후 가능하면 브라우저나 Playwright로 확인한다.
- 텍스트가 버튼, 카드, 탭, 모바일 하단 영역에서 겹치거나 잘리지 않도록 확인한다.
- 사용자 설명용 문구를 과도하게 추가하기보다 실제 업무 흐름을 바로 수행할 수 있는 UI를 우선한다.
- 목록 화면의 상단 검색조건은 화면마다 임의 마크업을 새로 만들지 않는다.
  - 기본 컨테이너는 `frontend/src/shared/SearchConditionPanel.tsx`의 `SearchConditionPanel`을 사용한다.
  - `내 신청서`, `결재함`, `전체 신청서`처럼 같은 성격의 목록 화면은 `검색조건` 제목, 필드 배치, 초기화 버튼 위치, 반응형 줄바꿈이 일관되게 보여야 한다.
  - 새 검색 필드가 필요하면 기존 `inline-field filter-field` 패턴과 공통 월 입력 마스크 등 기존 헬퍼를 먼저 재사용한다.
  - 예외가 필요하면 작업 문서나 코드 주석이 아니라 사용자에게 먼저 이유를 설명하고 확인한다.
- 날짜 입력을 텍스트 마스크로 제공하는 화면에서 사용자가 달력 직접 선택을 요청한 경우, 텍스트 입력만 두지 말고 실제 `type="date"` 기반 선택 컨트롤을 나란히 제공한다.

## 완료 보고

작업 완료 보고에는 다음을 간결하게 포함한다.

- 변경한 파일
- 핵심 변경 내용
- 실행한 검증 명령과 결과
- 실행하지 못한 검증이 있다면 이유
- 사용자가 이어서 확인해야 할 남은 이슈
