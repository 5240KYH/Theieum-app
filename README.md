# 영수증 첨부 전자결재 앱

Spring Boot, React/Vite, PostgreSQL 기반 전자결재 MVP입니다.

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
