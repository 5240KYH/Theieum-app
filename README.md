# 영수증 첨부 전자결재 앱

Spring Boot, React/Vite, PostgreSQL 기반 전자결재 MVP입니다.

## 문서

- [관리자 운영 가이드](docs/admin-user-guide.md): 실행, 배포, 관리자 이용, 운영 점검 절차
- [배포 전 체크리스트](docs/deployment-readiness-checklist.md): 운영 후보 배포 전 확인 항목
- [외부 체험자 가이드](docs/staging-test-guide.md): 스테이징 URL, 테스트 계정, 모바일 체험 시나리오 안내
- [반려 재상신 구현 계획](docs/superpowers/plans/2026-06-03-rejected-application-resubmission.md): 반려 신청서 재상신 후속 구현 plan

## 로컬 실행

```bash
docker compose up -d postgres
cd backend
./gradlew test
cd ../frontend
npm install
npm run build
```

기본 profile로 서버를 실행할 때는 `JWT_SECRET` 환경변수를 반드시 지정해야 합니다. 로컬 개발용 seed 데이터까지 함께 쓰려면 `local` profile을 사용하되, 배포 전에는 별도 secret으로 교체하세요.

```bash
SPRING_PROFILES_ACTIVE=local JWT_SECRET=change-this-local-secret ./gradlew bootRun
```

## Docker 앱 실행

백엔드, 프론트엔드, PostgreSQL을 한 번에 실행합니다.

```bash
docker compose up --build
```

브라우저에서 `http://localhost:3000`으로 접속합니다. 접속 주소는 다음과 같습니다.

- 프론트엔드: `http://localhost:3000`
- 백엔드 API: `http://localhost:8080/api`
- PostgreSQL: `localhost:5432`

Docker Compose 실행은 MVP 확인을 위해 `local` profile을 사용하므로 seed 계정이 함께 생성됩니다.

## 스테이징 체험 환경

외부 테스트 인원 5~10명이 체험할 환경은 로컬 `docker-compose.yml`을 그대로 공개하지 않고 `docker-compose.staging.yml`과 `.env.staging`로 분리해 실행한다.

```bash
cp .env.staging.example .env.staging
docker compose --env-file .env.staging -f docker-compose.staging.yml config
docker compose --env-file .env.staging -f docker-compose.staging.yml up --build -d postgres backend frontend
```

스테이징 서버에서는 PostgreSQL과 backend 포트를 외부에 직접 공개하지 않는다. HTTPS는 서버 앞단의 Caddy, nginx+certbot, Cloudflare Tunnel, 또는 배포 플랫폼의 HTTPS 기능으로 적용한다.

## 기본 계정

모든 seed 계정의 비밀번호는 `password`입니다.

| 역할 | 아이디 | 비밀번호 |
| --- | --- | --- |
| 관리자 | `admin` | `password` |
| 기안자 | `employee01` | `password` |
| 개발팀 결재자 | `lead-dev` | `password` |
| 결재자 | `approver01` | `password` |

기본 E2E 흐름은 개발팀 기안자인 `employee01`이 신청하고, 개발팀 예외 결재선에 따라 `lead-dev`가 승인합니다. `approver01`은 기본 결재선 검증용 결재자 계정입니다.

운영 배포 전에는 `docker-compose.yml`의 `JWT_SECRET`, DB 비밀번호, 파일 저장 경로를 환경별 secret으로 교체해야 합니다. `JWT_SECRET`은 애플리케이션이 금지하는 공유 기본값과 달라야 하며, 충분히 긴 난수 문자열을 사용하세요. 현재 frontend 컨테이너는 nginx가 `/api/*` 요청을 backend 컨테이너로 프록시합니다.

현재 Compose 구성은 로컬 MVP 검증용입니다. 운영 배포에서는 `local` profile과 seed 데이터 적용을 끄고, 운영용 secret 주입 방식과 파일 저장소를 별도 구성하세요.

기존 개발 DB 볼륨에 이전 seed 마이그레이션이 적용되어 있었다면 백엔드 시작 시 Flyway checksum 오류가 날 수 있습니다. 이 경우 개발 DB를 보존해야 하는지 먼저 판단한 뒤, 새 MVP 데이터를 다시 넣어도 되는 로컬 환경에서는 다음 명령으로 볼륨을 초기화하세요.

```bash
docker compose down -v
docker compose up --build
```

## 데이터베이스 하네스

일반 개발 DB는 영속 볼륨을 사용하는 `postgres` 서비스입니다.

```bash
docker compose up -d postgres
```

마이그레이션/seed 테스트는 tmpfs 기반의 테스트 전용 DB만 사용합니다.

```bash
docker compose up -d postgres-test
cd backend
TMPDIR=/private/tmp GRADLE_USER_HOME=/Users/kyh/theieum/.gradle-home JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test --tests '*DatabaseMigrationTest'
```

seed 데이터는 운영 기본 마이그레이션이 아니라 `db/seed` location에 분리되어 있습니다. 이전 로컬 DB에 `db/migration/V2__seed_mvp_data.sql`가 적용된 상태라면 Flyway validation 또는 checksum 충돌을 피하기 위해 `docker compose down -v`로 개발 DB 볼륨을 초기화한 뒤 다시 올리는 것이 안전합니다.
