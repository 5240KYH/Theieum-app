# 영수증 첨부 전자결재 앱 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**목표:** 20명 내외 조직에서 사용할 수 있는 영수증 첨부 전자결재 MVP를 Spring Boot, React/Vite, PostgreSQL, Docker Compose 기반으로 구현한다.

**아키텍처:** 백엔드는 Spring Boot REST API가 인증, 사용자/조직/직위, 결재선, 신청서, 첨부파일, 알림 이벤트를 담당한다. 프론트엔드는 React/Vite 업무앱으로 홈, 신청서 작성, 내 신청서, 결재함, 관리 화면을 제공한다. Docker Compose, Flyway, seed 데이터, API/E2E 테스트로 하네스 검증을 구성한다.

**기술스택:** Java 21, Spring Boot, Spring Security, Spring Data JPA, PostgreSQL, Flyway, JUnit 5, Testcontainers, React, Vite, TypeScript, TanStack Query, React Router, Playwright, Docker Compose.

---

## 0. 구현 원칙

- 설계 기준 문서: `docs/superpowers/specs/2026-06-03-receipt-approval-app-design.md`
- 모든 문서와 주요 화면 라벨은 한글을 우선한다.
- MVP 알림은 인앱 알림만 구현한다.
- 이메일/카카오는 실제 발송하지 않지만 `NotificationSender` 확장 구조와 DB 컬럼을 준비한다.
- 대리결재는 구현하지 않는다.
- 결재 불가 상황은 관리자 예외 결재로만 처리한다.
- 신청서 제출 시 결재선은 스냅샷으로 고정한다.
- 구현 단계에서는 각 서브에이전트의 파일 소유 범위를 분리한다.

### 0.1 컨텍스트 관리와 task별 인수인계

- 각 Task를 시작할 때 현재 범위, 기존 변경물, 검증 기준을 먼저 확인한다.
- 각 Task를 완료하거나 컨텍스트 사용량이 많아져 새 채팅 전환이 필요해질 때 `docs/handoffs/YYYY-MM-DD-task-N-<slug>.md` 형식의 인수인계서를 작성한다.
- task별 인수인계서에는 반드시 현재 브랜치, 마지막 커밋, 작업 파일, 완료/미완료 항목, 검증 명령과 결과, 다음 채팅에서 바로 실행할 프롬프트를 포함한다.
- 기존 작업 중간에 새 채팅으로 넘길 때는 루트 인수인계서인 `docs/handoff-YYYY-MM-DD.md`에도 최신 task별 인수인계서 경로를 추가한다.
- 컨텍스트가 무거워지면 새 기능을 더 얹지 말고 현재 Task의 검증 가능한 단위에서 멈춘 뒤 인수인계서를 남긴다.

## 1. 파일 구조

```text
backend/
  build.gradle
  settings.gradle
  src/main/java/com/theieum/approval/
    ApprovalApplication.java
    common/
    auth/
    user/
    organization/
    approval/
    application/
    attachment/
    notification/
    admin/
  src/main/resources/
    application.yml
    application-local.yml
    db/migration/
    db/seed/
  src/test/java/com/theieum/approval/
frontend/
  package.json
  vite.config.ts
  src/
    main.tsx
    app/
    shared/
    auth/
    dashboard/
    applications/
    approvals/
    admin/
e2e/
  package.json
  playwright.config.ts
  tests/
docker/
  nginx.conf
docker-compose.yml
README.md
docs/superpowers/specs/
docs/superpowers/plans/
```

## 2. 서브에이전트 소유 범위

- `Backend Infra Agent`: `backend/build.gradle`, `backend/src/main/resources/**`, `backend/src/main/java/**/auth/**`, `backend/src/main/java/**/attachment/**`, `docker-compose.yml`, `docker/**`
- `Backend Domain Agent`: `backend/src/main/java/**/approval/**`, `backend/src/main/java/**/application/**`, `backend/src/main/java/**/notification/**`, 관련 테스트
- `Frontend App Agent`: `frontend/src/**`, `frontend/package.json`, `frontend/vite.config.ts`
- `Test Harness Agent`: `e2e/**`, backend 통합 테스트 보강, seed 검증
- `Review Agent`: 직접 구현 파일을 수정하지 않고 리뷰 결과와 필요한 패치 제안만 반환

---

## Task 1: 저장소와 프로젝트 골격 준비

**Files:**
- Create: `backend/settings.gradle`
- Create: `backend/build.gradle`
- Create: `backend/src/main/java/com/theieum/approval/ApprovalApplication.java`
- Create: `backend/src/main/resources/application.yml`
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `docker-compose.yml`
- Create: `README.md`

- [ ] **Step 1: git 저장소 여부 확인**

Run:

```bash
git status --short
```

Expected:

```text
fatal: not a git repository
```

현재 상태가 위와 같으면 구현 시작 전에 사용자 승인 후 `git init`을 실행한다.

- [ ] **Step 2: 저장소 초기화**

Run:

```bash
git init
```

Expected:

```text
Initialized empty Git repository
```

- [ ] **Step 3: Spring Boot Gradle 골격 생성**

Create `backend/settings.gradle`:

```gradle
pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        mavenCentral()
    }
}

rootProject.name = 'receipt-approval-backend'
```

Create `backend/build.gradle`:

```gradle
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.3.5'
    id 'io.spring.dependency-management' version '1.1.6'
}

group = 'com.theieum'
version = '0.0.1-SNAPSHOT'

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-validation'
    implementation 'org.springframework.boot:spring-boot-starter-security'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    implementation 'org.flywaydb:flyway-core'
    implementation 'org.flywaydb:flyway-database-postgresql'
    runtimeOnly 'org.postgresql:postgresql'
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testImplementation 'org.springframework.security:spring-security-test'
    testImplementation 'org.testcontainers:junit-jupiter'
    testImplementation 'org.testcontainers:postgresql'
}

tasks.named('test') {
    useJUnitPlatform()
}
```

Create `backend/src/main/java/com/theieum/approval/ApprovalApplication.java`:

```java
package com.theieum.approval;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ApprovalApplication {
    public static void main(String[] args) {
        SpringApplication.run(ApprovalApplication.class, args);
    }
}
```

- [ ] **Step 4: Backend 기본 설정 생성**

Create `backend/src/main/resources/application.yml`:

```yaml
spring:
  application:
    name: receipt-approval
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:approval}
    username: ${DB_USERNAME:approval}
    password: ${DB_PASSWORD:approval}
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
  flyway:
    enabled: true

app:
  file-storage:
    root-path: ${FILE_STORAGE_ROOT:./data/uploads}
  security:
    jwt-secret: ${JWT_SECRET:local-development-secret-change-me}
```

- [ ] **Step 5: Frontend Vite 골격 생성**

Create `frontend/package.json`:

```json
{
  "name": "receipt-approval-frontend",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "lint": "eslint .",
    "preview": "vite preview --host 0.0.0.0"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.59.20",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

Create `frontend/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
});
```

Create `frontend/index.html`:

```html
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
```

Create `frontend/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return <div>영수증 첨부 전자결재</div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Docker Compose 기본 구성 생성**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: approval
      POSTGRES_USER: approval
      POSTGRES_PASSWORD: approval
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
```

- [ ] **Step 7: 기본 README 생성**

Create `README.md`:

~~~markdown
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
~~~

- [ ] **Step 8: 골격 빌드 확인**

Run:

```bash
cd backend && ./gradlew test
```

Expected:

```text
BUILD SUCCESSFUL
```

Run:

```bash
cd frontend && npm install && npm run build
```

Expected:

```text
✓ built
```

- [ ] **Step 9: Commit**

Run:

```bash
git add backend frontend docker-compose.yml README.md
git commit -m "chore: scaffold receipt approval app"
```

---

## Task 2: DB 마이그레이션과 seed 데이터

**Files:**
- Create: `backend/src/main/resources/db/migration/V1__create_core_schema.sql`
- Create: `backend/src/main/resources/db/migration/V2__seed_mvp_data.sql`
- Test: `backend/src/test/java/com/theieum/approval/common/DatabaseMigrationTest.java`

- [ ] **Step 1: Flyway 마이그레이션 테스트 작성**

Create `backend/src/test/java/com/theieum/approval/common/DatabaseMigrationTest.java`:

```java
package com.theieum.approval.common;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
class DatabaseMigrationTest {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Test
    void flywayMigrationLoadsApplicationContext() {
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run:

```bash
cd backend && ./gradlew test --tests '*DatabaseMigrationTest'
```

Expected:

```text
BUILD FAILED
```

실패 원인은 아직 migration 파일이 없거나 JPA 검증 스키마가 없기 때문이다.

- [ ] **Step 3: 핵심 스키마 생성**

Create `backend/src/main/resources/db/migration/V1__create_core_schema.sql` with tables:

```sql
CREATE TABLE positions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    rank_order INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE organizations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id BIGINT REFERENCES organizations(id),
    level_no INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    login_id VARCHAR(50) NOT NULL UNIQUE,
    external_subject VARCHAR(120),
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(80) NOT NULL,
    email VARCHAR(160) NOT NULL,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    position_id BIGINT NOT NULL REFERENCES positions(id),
    roles VARCHAR(200) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE approval_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE approval_lines (
    id BIGSERIAL PRIMARY KEY,
    approval_type_id BIGINT NOT NULL REFERENCES approval_types(id),
    name VARCHAR(100) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE approval_line_steps (
    id BIGSERIAL PRIMARY KEY,
    approval_line_id BIGINT NOT NULL REFERENCES approval_lines(id),
    step_order INTEGER NOT NULL,
    step_type VARCHAR(30) NOT NULL,
    organization_scope VARCHAR(30),
    position_id BIGINT REFERENCES positions(id),
    direct_user_id BIGINT REFERENCES users(id),
    sort_policy VARCHAR(30) NOT NULL DEFAULT 'POSITION_ORDER'
);

CREATE TABLE approval_org_exceptions (
    id BIGSERIAL PRIMARY KEY,
    approval_type_id BIGINT NOT NULL REFERENCES approval_types(id),
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    approver_user_id BIGINT NOT NULL REFERENCES users(id),
    step_order INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE applications (
    id BIGSERIAL PRIMARY KEY,
    applicant_id BIGINT NOT NULL REFERENCES users(id),
    approval_type_id BIGINT NOT NULL REFERENCES approval_types(id),
    application_date DATE NOT NULL,
    receipt_date DATE NOT NULL,
    vendor VARCHAR(160) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(30) NOT NULL,
    submitted_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE application_approval_steps (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES applications(id),
    step_order INTEGER NOT NULL,
    original_approver_id BIGINT NOT NULL REFERENCES users(id),
    status VARCHAR(30) NOT NULL,
    acted_at TIMESTAMP
);

CREATE TABLE approval_histories (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES applications(id),
    approval_step_id BIGINT REFERENCES application_approval_steps(id),
    action VARCHAR(30) NOT NULL,
    original_approver_id BIGINT REFERENCES users(id),
    actor_id BIGINT NOT NULL REFERENCES users(id),
    admin_override BOOLEAN NOT NULL DEFAULT FALSE,
    admin_reason TEXT,
    comment TEXT,
    acted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attachments (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES applications(id),
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_by BIGINT NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_events (
    id BIGSERIAL PRIMARY KEY,
    recipient_id BIGINT NOT NULL REFERENCES users(id),
    application_id BIGINT REFERENCES applications(id),
    notification_type VARCHAR(50) NOT NULL,
    channel VARCHAR(30) NOT NULL,
    title VARCHAR(160) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(30) NOT NULL,
    read_flag BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at TIMESTAMP,
    failed_reason TEXT,
    template_code VARCHAR(80),
    external_message_id VARCHAR(120),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 4: seed 데이터 생성**

Create `backend/src/main/resources/db/migration/V2__seed_mvp_data.sql` with at least:

```sql
INSERT INTO positions (id, name, rank_order, sort_order) VALUES
(1, '사원', 10, 10),
(2, '대리', 20, 20),
(3, '과장', 30, 30),
(4, '팀장', 40, 40),
(5, '대표', 90, 90);

INSERT INTO organizations (id, name, parent_id, level_no, sort_order) VALUES
(1, '더이음', NULL, 1, 10),
(2, '경영지원팀', 1, 2, 10),
(3, '개발팀', 1, 2, 20),
(4, '영업팀', 1, 2, 30);

INSERT INTO approval_types (id, name, description) VALUES
(1, '영수증 첨부 신청', '영수증 이미지와 사용 내용을 첨부하여 결재를 요청한다.');
```

Add 20 users with BCrypt hashes generated by a known local password, for example all seed users use `password`.

- [ ] **Step 5: migration 테스트 통과 확인**

Run:

```bash
cd backend && ./gradlew test --tests '*DatabaseMigrationTest'
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 6: Commit**

Run:

```bash
git add backend/src/main/resources/db/migration backend/src/test/java/com/theieum/approval/common
git commit -m "feat: add schema and seed data"
```

---

## Task 3: Backend 공통 모델, 인증, 권한

**Files:**
- Create: `backend/src/main/java/com/theieum/approval/auth/**`
- Create: `backend/src/main/java/com/theieum/approval/user/**`
- Create: `backend/src/main/java/com/theieum/approval/organization/**`
- Test: `backend/src/test/java/com/theieum/approval/auth/AuthIntegrationTest.java`

- [ ] **Step 1: 로그인 통합 테스트 작성**

Create `AuthIntegrationTest` that verifies:

```java
@Test
void loginReturnsTokenForSeedAdmin() {
    // POST /api/auth/login
    // body: {"loginId":"admin","password":"password"}
    // expect: 200 and accessToken exists
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run:

```bash
cd backend && ./gradlew test --tests '*AuthIntegrationTest'
```

Expected:

```text
BUILD FAILED
```

- [ ] **Step 3: 사용자 엔티티와 Repository 구현**

Create `User.java` with fields matching `users`.

Create `UserRepository.java`:

```java
package com.theieum.approval.user;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByLoginIdAndActiveTrue(String loginId);
}
```

- [ ] **Step 4: Spring Security 설정 구현**

Create:

```text
auth/LoginRequest.java
auth/LoginResponse.java
auth/AuthController.java
auth/JwtTokenService.java
auth/SecurityConfig.java
```

Minimum behavior:

```java
POST /api/auth/login
```

returns:

```json
{
  "accessToken": "...",
  "user": {
    "id": 1,
    "name": "관리자",
    "roles": ["ADMIN"]
  }
}
```

- [ ] **Step 5: 인증 테스트 통과 확인**

Run:

```bash
cd backend && ./gradlew test --tests '*AuthIntegrationTest'
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 6: Commit**

Run:

```bash
git add backend/src/main/java/com/theieum/approval/auth backend/src/main/java/com/theieum/approval/user backend/src/test/java/com/theieum/approval/auth
git commit -m "feat: add account login"
```

---

## Task 4: 결재선 산정 도메인

**Files:**
- Create: `backend/src/main/java/com/theieum/approval/approval/**`
- Test: `backend/src/test/java/com/theieum/approval/approval/ApprovalLineResolverTest.java`

- [ ] **Step 1: 결재선 산정 실패 테스트 작성**

Create tests:

```java
@Test
void directUserStepsKeepConfiguredOrder() {
    // direct approvers [팀장, 대표] should resolve in same order
}

@Test
void organizationExceptionOverridesDefaultLine() {
    // organization exception should replace default approval line
}

@Test
void organizationPositionStepUsesPositionOrder() {
    // same organization approvers should be sorted by position rank
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run:

```bash
cd backend && ./gradlew test --tests '*ApprovalLineResolverTest'
```

Expected:

```text
BUILD FAILED
```

- [ ] **Step 3: 결재선 엔티티와 enum 구현**

Create:

```text
approval/ApprovalType.java
approval/ApprovalLine.java
approval/ApprovalLineStep.java
approval/ApprovalOrgException.java
approval/ApprovalStepType.java
approval/ApprovalStepStatus.java
approval/ApprovalLineResolver.java
```

Enums:

```java
public enum ApprovalStepType {
    DIRECT_USER,
    ORG_POSITION
}

public enum ApprovalStepStatus {
    PENDING,
    APPROVED,
    REJECTED,
    ADMIN_APPROVED
}
```

- [ ] **Step 4: 산정 서비스 구현**

`ApprovalLineResolver` public method:

```java
public List<ResolvedApprover> resolve(long approvalTypeId, long applicantId)
```

Behavior:

- 조직별 예외가 있으면 예외 결재자 목록을 `step_order` 순서로 반환한다.
- 예외가 없으면 기본 결재선을 단계 순서대로 읽는다.
- `DIRECT_USER`는 지정 사용자를 반환한다.
- `ORG_POSITION`은 신청자 조직 기준으로 직위 조건에 맞는 사용자를 찾고 직위 순으로 정렬한다.
- 빈 결재선이면 `IllegalStateException`을 던진다.

- [ ] **Step 5: 테스트 통과 확인**

Run:

```bash
cd backend && ./gradlew test --tests '*ApprovalLineResolverTest'
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 6: Commit**

Run:

```bash
git add backend/src/main/java/com/theieum/approval/approval backend/src/test/java/com/theieum/approval/approval
git commit -m "feat: resolve approval line snapshots"
```

---

## Task 5: 신청서, 첨부파일, 제출 흐름

**Files:**
- Create: `backend/src/main/java/com/theieum/approval/application/**`
- Create: `backend/src/main/java/com/theieum/approval/attachment/**`
- Test: `backend/src/test/java/com/theieum/approval/application/ApplicationSubmissionTest.java`

- [ ] **Step 1: 신청서 제출 테스트 작성**

Test cases:

```java
@Test
void submitApplicationCreatesApprovalSnapshotAndFirstNotification() {
    // create draft, attach image, submit
    // expect application status IN_APPROVAL
    // expect approval steps copied
    // expect first approver notification
}

@Test
void submitApplicationRequiresReceiptImage() {
    // submit without attachment
    // expect validation error
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run:

```bash
cd backend && ./gradlew test --tests '*ApplicationSubmissionTest'
```

Expected:

```text
BUILD FAILED
```

- [ ] **Step 3: 신청서 상태와 엔티티 구현**

Enums:

```java
public enum ApplicationStatus {
    DRAFT,
    SUBMITTED,
    IN_APPROVAL,
    APPROVED,
    REJECTED,
    CANCELED
}
```

Create:

```text
application/Application.java
application/ApplicationApprovalStep.java
application/ApprovalHistory.java
application/ApplicationRepository.java
application/ApplicationService.java
```

- [ ] **Step 4: 파일 저장 인터페이스 구현**

Create:

```text
attachment/FileStorage.java
attachment/LocalFileStorage.java
attachment/Attachment.java
attachment/AttachmentRepository.java
```

Interface:

```java
public interface FileStorage {
    StoredFile store(String originalFilename, String contentType, byte[] bytes);
}
```

`StoredFile` contains:

```java
public record StoredFile(String storedFilename, String path, long size, String contentType) {}
```

- [ ] **Step 5: 제출 서비스 구현**

`ApplicationService.submit(applicationId, actorId)`:

- 신청서가 `DRAFT`인지 확인한다.
- 영수증 이미지 첨부가 있는지 확인한다.
- 결재선을 산정한다.
- `application_approval_steps`를 생성한다.
- 신청서 상태를 `IN_APPROVAL`로 변경한다.
- 첫 결재자 알림 이벤트를 만든다.

- [ ] **Step 6: 테스트 통과 확인**

Run:

```bash
cd backend && ./gradlew test --tests '*ApplicationSubmissionTest'
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 7: Commit**

Run:

```bash
git add backend/src/main/java/com/theieum/approval/application backend/src/main/java/com/theieum/approval/attachment backend/src/test/java/com/theieum/approval/application
git commit -m "feat: submit receipt applications"
```

---

## Task 6: 결재 승인, 반려, 관리자 예외 결재, 알림 이벤트

**Files:**
- Modify: `backend/src/main/java/com/theieum/approval/application/**`
- Create: `backend/src/main/java/com/theieum/approval/notification/**`
- Test: `backend/src/test/java/com/theieum/approval/application/ApprovalActionTest.java`

- [ ] **Step 1: 상태 전이 테스트 작성**

Test cases:

```java
@Test
void approverApprovalMovesToNextStepAndNotifiesNextApprover() {}

@Test
void lastApprovalCompletesApplicationAndNotifiesApplicant() {}

@Test
void rejectionRejectsApplicationAndNotifiesApplicant() {}

@Test
void adminOverrideRequiresReasonAndRecordsOriginalApprover() {}

@Test
void adminOverrideCannotActOnCompletedApplication() {}
```

- [ ] **Step 2: 테스트 실패 확인**

Run:

```bash
cd backend && ./gradlew test --tests '*ApprovalActionTest'
```

Expected:

```text
BUILD FAILED
```

- [ ] **Step 3: 알림 모델 구현**

Create:

```text
notification/NotificationEvent.java
notification/NotificationChannel.java
notification/NotificationStatus.java
notification/NotificationType.java
notification/NotificationEventRepository.java
notification/NotificationService.java
notification/NotificationSender.java
notification/InAppNotificationSender.java
notification/EmailNotificationSender.java
notification/KakaoNotificationSender.java
```

Enums:

```java
public enum NotificationChannel {
    IN_APP,
    EMAIL,
    KAKAO
}

public enum NotificationStatus {
    CREATED,
    SENT,
    FAILED
}
```

`EmailNotificationSender` and `KakaoNotificationSender` are no-op placeholders that are wired but disabled for MVP.

- [ ] **Step 4: 결재 액션 구현**

`ApplicationService.approve(stepId, actorId, comment)`:

- actor가 현재 결재자인지 확인한다.
- 현재 단계만 승인 가능하다.
- 다음 단계가 있으면 다음 결재자 알림을 생성한다.
- 마지막 단계면 신청서를 `APPROVED`로 변경하고 기안자에게 최종 완료 알림을 생성한다.

`ApplicationService.reject(stepId, actorId, comment)`:

- actor가 현재 결재자인지 확인한다.
- comment는 필수다.
- 신청서를 `REJECTED`로 변경한다.
- 기안자에게 반려 알림을 생성한다.

`ApplicationService.adminApprove(stepId, adminId, reason)`:

- admin 권한을 확인한다.
- reason은 필수다.
- 현재 `PENDING` 단계만 처리한다.
- 이력에 원래 결재자와 실제 처리자를 모두 저장한다.
- 단계 상태는 `ADMIN_APPROVED`로 저장한다.

- [ ] **Step 5: 테스트 통과 확인**

Run:

```bash
cd backend && ./gradlew test --tests '*ApprovalActionTest'
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 6: Commit**

Run:

```bash
git add backend/src/main/java/com/theieum/approval/application backend/src/main/java/com/theieum/approval/notification backend/src/test/java/com/theieum/approval/application
git commit -m "feat: process approval actions"
```

---

## Task 7: REST API 컨트롤러

**Files:**
- Create: `backend/src/main/java/com/theieum/approval/admin/**`
- Create: `backend/src/main/java/com/theieum/approval/application/ApplicationController.java`
- Create: `backend/src/main/java/com/theieum/approval/approval/ApprovalController.java`
- Create: `backend/src/main/java/com/theieum/approval/notification/NotificationController.java`
- Test: `backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java`

- [ ] **Step 1: API 권한 테스트 작성**

Test:

```java
@Test
void applicantCannotApproveOthersPendingStep() {}

@Test
void approverCanOnlyApproveAssignedStep() {}

@Test
void adminCanUseAdminOverride() {}

@Test
void applicantCanReadOwnApplicationOnly() {}
```

- [ ] **Step 2: 테스트 실패 확인**

Run:

```bash
cd backend && ./gradlew test --tests '*ApiAuthorizationTest'
```

Expected:

```text
BUILD FAILED
```

- [ ] **Step 3: API 목록 구현**

Implement endpoints:

```text
POST   /api/auth/login
GET    /api/me
GET    /api/admin/users
POST   /api/admin/users
GET    /api/admin/organizations
POST   /api/admin/organizations
GET    /api/admin/positions
POST   /api/admin/positions
GET    /api/admin/approval-lines
POST   /api/admin/approval-lines
GET    /api/applications/my
POST   /api/applications
POST   /api/applications/{id}/attachments
POST   /api/applications/{id}/submit
GET    /api/applications/{id}
GET    /api/approvals/inbox
POST   /api/approvals/steps/{stepId}/approve
POST   /api/approvals/steps/{stepId}/reject
POST   /api/admin/approvals/steps/{stepId}/approve
GET    /api/notifications
PATCH  /api/notifications/{id}/read
GET    /api/admin/applications
GET    /api/admin/notification-events
```

- [ ] **Step 4: DTO validation 구현**

Request DTOs must validate:

- `receiptDate` required
- `vendor` required
- `amount` positive
- `description` required
- image attachment MIME type starts with `image/`
- admin override reason not blank

- [ ] **Step 5: API 권한 테스트 통과 확인**

Run:

```bash
cd backend && ./gradlew test --tests '*ApiAuthorizationTest'
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 6: 전체 backend 테스트 실행**

Run:

```bash
cd backend && ./gradlew test
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 7: Commit**

Run:

```bash
git add backend/src/main/java backend/src/test/java
git commit -m "feat: expose approval REST APIs"
```

---

## Task 8: Frontend 레이아웃, 인증, API 클라이언트

**Files:**
- Create: `frontend/src/app/App.tsx`
- Create: `frontend/src/app/router.tsx`
- Create: `frontend/src/shared/api.ts`
- Create: `frontend/src/auth/**`
- Create: `frontend/src/shared/layout/**`
- Test: `frontend/src/auth/LoginPage.test.tsx`

- [ ] **Step 1: 로그인 화면 테스트 작성**

Test:

```tsx
it('관리자 계정으로 로그인하면 홈으로 이동한다', async () => {
  // render LoginPage
  // type admin/password
  // click 로그인
  // expect navigate('/dashboard')
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run:

```bash
cd frontend && npm run test -- LoginPage
```

Expected:

```text
FAIL
```

- [ ] **Step 3: API 클라이언트 구현**

Create `frontend/src/shared/api.ts`:

```ts
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}
```

- [ ] **Step 4: 라우팅과 레이아웃 구현**

Routes:

```text
/login
/dashboard
/applications/new
/applications/my
/applications/:id
/approvals
/admin/users
/admin/organizations
/admin/positions
/admin/approval-lines
/admin/applications
/admin/notifications
```

Layout:

- 좌측 사이드바
- 상단 사용자/알림 바
- 업무용 표 중심 화면
- 모바일에서는 사이드바 접힘

- [ ] **Step 5: 로그인 화면 구현**

Fields:

- 아이디
- 비밀번호
- 로그인 버튼
- 오류 메시지

On success:

- save `accessToken`
- save user summary
- navigate to `/dashboard`

- [ ] **Step 6: 테스트 통과 확인**

Run:

```bash
cd frontend && npm run test -- LoginPage
```

Expected:

```text
PASS
```

- [ ] **Step 7: Commit**

Run:

```bash
git add frontend/src frontend/package.json frontend/vite.config.ts
git commit -m "feat: add frontend shell and login"
```

---

## Task 9: Frontend 신청서와 결재함 화면

**Files:**
- Create: `frontend/src/applications/**`
- Create: `frontend/src/approvals/**`
- Test: `frontend/src/applications/ApplicationForm.test.tsx`

- [ ] **Step 1: 신청서 폼 테스트 작성**

Test cases:

```tsx
it('필수 항목이 비어 있으면 제출할 수 없다', async () => {});
it('이미지 첨부 후 썸네일과 삭제 버튼을 표시한다', async () => {});
it('제출 성공 후 내 신청서 상세로 이동한다', async () => {});
```

- [ ] **Step 2: 테스트 실패 확인**

Run:

```bash
cd frontend && npm run test -- ApplicationForm
```

Expected:

```text
FAIL
```

- [ ] **Step 3: 신청서 작성 화면 구현**

Fields:

- 신청일자
- 신청자
- 영수증 일자
- 사용처
- 금액
- 신청 내용
- 영수증 이미지 첨부

Actions:

- 임시저장
- 제출
- 취소
- 첨부 미리보기
- 첨부 삭제

- [ ] **Step 4: 내 신청서와 상세 화면 구현**

List columns:

- 신청일
- 신청 내용 요약
- 영수증 일자
- 사용처
- 금액
- 현재 결재자
- 상태
- 최종 처리일

Detail sections:

- 신청 내용
- 첨부 이미지
- 결재 진행 상태
- 결재 이력
- 관리자 예외 처리 배지

- [ ] **Step 5: 결재함 화면 구현**

List columns:

- 접수일
- 신청자
- 조직
- 영수증 일자
- 사용처
- 금액
- 첨부 여부
- 상태

Actions:

- 승인
- 반려
- 첨부 확대 보기

- [ ] **Step 6: 테스트 통과 확인**

Run:

```bash
cd frontend && npm run test -- ApplicationForm
```

Expected:

```text
PASS
```

- [ ] **Step 7: Commit**

Run:

```bash
git add frontend/src/applications frontend/src/approvals
git commit -m "feat: add application and approval screens"
```

---

## Task 10: Frontend 관리 화면과 알림함

**Files:**
- Create: `frontend/src/admin/**`
- Create: `frontend/src/dashboard/**`
- Create: `frontend/src/shared/notifications/**`
- Test: `frontend/src/admin/AdminApplicationsPage.test.tsx`

- [ ] **Step 1: 관리자 화면 테스트 작성**

Test cases:

```tsx
it('전체 신청서를 상태별로 필터링한다', async () => {});
it('관리자 예외 결재 사유를 입력해야 처리된다', async () => {});
it('알림 로그에서 채널과 발송 상태를 표시한다', async () => {});
```

- [ ] **Step 2: 테스트 실패 확인**

Run:

```bash
cd frontend && npm run test -- AdminApplicationsPage
```

Expected:

```text
FAIL
```

- [ ] **Step 3: 홈 대시보드 구현**

Dashboard cards:

- 내 신청 진행중
- 결재 대기
- 반려/보완 필요
- 최근 알림

- [ ] **Step 4: 관리 CRUD 화면 구현**

Admin pages:

- 사용자 관리
- 조직 관리
- 직위 관리
- 결재선 관리
- 조직별 예외 결재자 관리
- 전체 신청서 관리
- 알림 로그 관리

For MVP, CRUD forms may be modal forms with table refresh.

- [ ] **Step 5: 알림함 구현**

Features:

- 미확인 알림 수 배지
- 알림 목록
- 읽음 처리
- 신청서 상세 이동

- [ ] **Step 6: 테스트 통과 확인**

Run:

```bash
cd frontend && npm run test -- AdminApplicationsPage
```

Expected:

```text
PASS
```

- [ ] **Step 7: Commit**

Run:

```bash
git add frontend/src/admin frontend/src/dashboard frontend/src/shared/notifications
git commit -m "feat: add admin and notification screens"
```

---

## Task 11: Docker 실행 하네스

**Files:**
- Modify: `.gitignore`
- Create: `.dockerignore`
- Create: `backend/.dockerignore`
- Modify: `docker-compose.yml`
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `docker/nginx.conf`
- Modify: `README.md`
- Create: `docs/handoffs/2026-06-03-task-11-docker-execution-harness.md`
- Modify: `docs/handoff-2026-06-03.md`

- [ ] **Step 1: Docker ignore 파일 생성**

Create `.dockerignore`:

```gitignore
.git/
.idea/
.gradle-home/
backend/build/
backend/.gradle/
frontend/node_modules/
frontend/dist/
```

Create `backend/.dockerignore`:

```gitignore
.gradle/
build/
data/
```

Modify `.gitignore` to include IDE and generated build output:

```gitignore
.DS_Store
.idea/

backend/build/
backend/.gradle/

frontend/node_modules/
frontend/dist/
frontend/*.tsbuildinfo
frontend/vite.config.js
frontend/vite.config.d.ts

.gradle-home/
```

- [ ] **Step 2: backend Dockerfile 생성**

Create `backend/Dockerfile`:

```Dockerfile
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY . .
RUN ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

- [ ] **Step 3: frontend Dockerfile 생성**

Create `frontend/Dockerfile`:

```Dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 4: nginx 설정 생성**

Create `docker/nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://backend:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

- [ ] **Step 5: docker-compose 전체 구성으로 확장**

Modify `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: approval
      POSTGRES_USER: approval
      POSTGRES_PASSWORD: approval
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U approval -d approval"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    build: ./backend
    environment:
      SPRING_PROFILES_ACTIVE: local
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: approval
      DB_USERNAME: approval
      DB_PASSWORD: approval
      FILE_STORAGE_ROOT: /app/uploads
      JWT_SECRET: theieum-compose-local-jwt-secret-change-before-deploy-2026
    ports:
      - "8080:8080"
    volumes:
      - upload-data:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend

  postgres-test:
    image: postgres:16
    environment:
      POSTGRES_DB: approval_test
      POSTGRES_USER: approval
      POSTGRES_PASSWORD: approval
    ports:
      - "55432:5432"
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U approval -d approval_test"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres-data:
  upload-data:
```

- [ ] **Step 6: Docker Compose 설정 검증**

Run:

```bash
docker compose config
```

Expected: normalized Compose config is printed and exits with code 0.

- [ ] **Step 7: Docker 실행 검증**

Run:

```bash
docker compose up --build
```

Expected:

```text
frontend-1  | ...
backend-1   | Started ApprovalApplication
postgres-1  | database system is ready to accept connections
```

- [ ] **Step 8: HTTP 접근 검증**

Run in another terminal while Compose is running:

```bash
curl -I http://localhost:3000
curl -i http://localhost:8080/api/auth/login
```

Expected: frontend returns `HTTP/1.1 200 OK`. The backend login endpoint may return `401 Unauthorized`, `405 Method Not Allowed`, or a JSON error for GET, but it must reach the Spring Boot application rather than connection failure.

- [ ] **Step 9: Task 11 인수인계서 작성**

Create `docs/handoffs/2026-06-03-task-11-docker-execution-harness.md` with:

```markdown
# Task 11 Docker 실행 하네스 인수인계

작성 시점: 2026-06-03, Asia/Seoul
작업 경로: `/Users/kyh/theieum`

## 상태

- 완료:
- 미완료:

## 변경 파일

- `.gitignore`
- `.dockerignore`
- `backend/.dockerignore`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `docker/nginx.conf`
- `docker-compose.yml`
- `README.md`
- `docs/handoff-2026-06-03.md`

## 검증 결과

```bash
docker compose config
docker compose up --build
curl -I http://localhost:3000
curl -i http://localhost:8080/api/auth/login
git diff --check
```

## 다음 작업

Task 12 Playwright E2E 업무 흐름 검증으로 진행한다.
```

Update `docs/handoff-2026-06-03.md` to point to this task handoff.

- [ ] **Step 10: Commit**

Run:

```bash
git add docs/handoff-2026-06-03.md docs/handoffs/2026-06-03-task-11-docker-execution-harness.md docs/superpowers/plans/2026-06-03-receipt-approval-app-implementation.md
git commit -m "docs: add task handoff workflow"
```

---

## Task 12: Playwright E2E 업무 흐름 검증

**Files:**
- Modify: `.gitignore`
- Modify: `backend/src/main/java/com/theieum/approval/auth/UserSummary.java`
- Modify: `backend/src/main/java/com/theieum/approval/auth/AuthenticatedUser.java`
- Modify: `backend/src/test/java/com/theieum/approval/auth/AuthIntegrationTest.java`
- Modify: `frontend/src/dashboard/DashboardPage.tsx`
- Create: `frontend/src/dashboard/DashboardPage.test.tsx`
- Create: `e2e/package.json`
- Create: `e2e/package-lock.json`
- Create: `e2e/playwright.config.ts`
- Create: `e2e/tests/receipt-approval-flow.spec.ts`
- Create: `e2e/fixtures/receipt.png`
- Create: `docs/handoffs/2026-06-03-task-12-playwright-e2e-flow.md`

- [ ] **Step 1: E2E 프로젝트 생성**

Create `e2e/package.json`:

```json
{
  "name": "receipt-approval-e2e",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "test": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0"
  }
}
```

Create `e2e/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  }
});
```

- [ ] **Step 2: E2E 테스트 작성**

Create `e2e/tests/receipt-approval-flow.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('영수증 신청부터 최종 승인 알림까지 처리한다', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('아이디').fill('employee01');
  await page.getByLabel('비밀번호').fill('password');
  await page.getByRole('button', { name: '로그인' }).click();

  await page.getByRole('link', { name: '신청서 작성' }).click();
  await page.getByLabel('영수증 일자').fill('2026-06-03');
  await page.getByLabel('사용처').fill('문구점');
  await page.getByLabel('금액').fill('12000');
  await page.getByLabel('신청 내용').fill('프로젝트 회의 준비물 구매');
  await page.getByLabel('영수증 이미지 첨부').setInputFiles('fixtures/receipt.png');
  await page.getByRole('button', { name: '제출' }).click();
  await expect(page.getByRole('heading', { name: '신청서 상세' })).toBeVisible();
  await expect(page.getByText('결재중')).toBeVisible();

  await page.goto('/login');
  await page.getByLabel('아이디').fill('lead-dev');
  await page.getByLabel('비밀번호').fill('password');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.getByRole('link', { name: '결재함' }).click();
  await page.getByText('문구점').click();
  await page.getByRole('button', { name: '승인' }).click();

  await page.goto('/login');
  await page.getByLabel('아이디').fill('employee01');
  await page.getByLabel('비밀번호').fill('password');
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByText('승인완료')).toBeVisible();
  await page.getByLabel('알림함').click();
  await expect(page.getByText('최종 결재 완료').first()).toBeVisible();
});
```

- [ ] **Step 3: E2E 실패 확인**

Run:

```bash
cd e2e && npm install && npm run test
```

Expected:

```text
failed
```

If the app is not running, start it first:

```bash
docker compose up --build
```

- [ ] **Step 4: Seed 계정과 화면 라벨을 테스트에 맞춤**

Ensure seed users include:

```text
admin / password
employee01 / password
approver01 / password
lead-dev / password
```

Ensure frontend labels match:

```text
아이디
비밀번호
신청서 작성
영수증 일자
사용처
금액
신청 내용
영수증 이미지 첨부
제출
결재함
승인
```

If the first E2E run exposes an API/frontend contract mismatch, add the smallest regression tests first. For Task 12 this includes:

```text
backend AuthIntegrationTest: login and /api/me include loginId.
frontend DashboardPage.test: APPLICANT dashboard does not call /api/approvals/inbox.
```

- [ ] **Step 5: E2E 통과 확인**

Run:

```bash
docker compose -p theieum_task12_e2e up --build -d postgres backend frontend
```

In another terminal:

```bash
cd e2e && npm run test
```

Expected:

```text
1 passed
```

Clean up the E2E-only Compose project when verification is finished:

```bash
docker compose -p theieum_task12_e2e down -v
```

- [ ] **Step 6: Commit**

Run:

```bash
git add e2e backend/src/main/resources/db/migration frontend/src
git commit -m "test: cover receipt approval workflow"
```

---

## Task 13: 최종 리뷰와 배포 준비

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/reviews/2026-06-03-receipt-approval-app-review.md`

- [ ] **Step 1: 전체 검증 실행**

Run:

```bash
cd backend && ./gradlew test
```

Expected:

```text
BUILD SUCCESSFUL
```

Run:

```bash
cd frontend && npm run build && npm run test
```

Expected:

```text
✓ built
PASS
```

Run:

```bash
docker compose up --build
```

Expected:

```text
Started ApprovalApplication
```

Run:

```bash
cd e2e && npm run test
```

Expected:

```text
passed
```

- [ ] **Step 2: Review Agent 점검 요청**

Ask Review Agent to check:

- 설계서 요구사항 누락
- 권한 문제
- 관리자 예외 결재 감사 이력
- 카카오 알림 확장 구조
- 첨부파일 접근권한
- E2E 누락 흐름

- [ ] **Step 3: 리뷰 결과 문서화**

Create `docs/superpowers/reviews/2026-06-03-receipt-approval-app-review.md`:

```markdown
# 영수증 첨부 전자결재 앱 최종 리뷰

## 검증 명령

- backend: `./gradlew test`
- frontend: `npm run build && npm run test`
- docker: `docker compose up --build`
- e2e: `npm run test`

## 확인한 요구사항

- 사용자/조직/직위 관리
- 결재선 관리
- 신청서 작성과 영수증 첨부
- 결재 승인/반려
- 관리자 예외 결재
- 인앱 알림
- 카카오 알림 확장 구조
- 관리 화면

## 남은 확장 후보

- 이메일 알림
- 카카오 알림톡
- S3 또는 MinIO 파일 저장
- 금액별 결재선
- 대리결재
```

- [ ] **Step 4: README 운영 가이드 보강**

Add:

~~~markdown
## 기본 계정

- 관리자: `admin / password`
- 기안자: `employee01 / password`
- 결재자: `approver01 / password`

## 전체 실행

```bash
docker compose up --build
```

브라우저에서 `http://localhost:3000`으로 접속합니다.
~~~

- [ ] **Step 5: 최종 Commit**

Run:

```bash
git add README.md docs/superpowers/reviews
git commit -m "docs: add deployment and review notes"
```

---

## 3. 계획 자체 리뷰 체크리스트

- 설계서의 MVP 포함 항목은 Task 2부터 Task 12까지 모두 배치했다.
- 대리결재는 구현 항목에 넣지 않았다.
- 관리자 예외 결재는 Task 6, Task 10, Task 12에서 다룬다.
- 카카오 알림은 실제 연동 없이 Task 6의 sender 구조와 DB 컬럼으로 준비한다.
- Docker Compose와 seed 데이터는 Task 2, Task 11, Task 12에서 검증한다.
- 신청서 필수 항목은 Task 5, Task 9, Task 12에서 반복 검증한다.
- 권한 검증은 Task 3, Task 7, Task 13에 포함했다.
- 파일 저장 확장성은 Task 5에서 `FileStorage` 인터페이스로 처리한다.

## 4. 실행 권장 순서

1. Task 1부터 Task 3까지는 기반 작업이므로 순차 실행한다.
2. Task 4와 Task 5는 Backend Domain Agent가 이어서 맡는다.
3. Task 6과 Task 7은 Backend Domain Agent와 Backend Infra Agent가 함께 리뷰하며 진행한다.
4. Task 8부터 Task 10은 Frontend App Agent가 맡는다.
5. Task 11과 Task 12는 Test Harness Agent가 맡는다.
6. Task 13은 Review Agent와 메인 세션이 함께 마무리한다.

첫 구현 실행 방식은 `superpowers:subagent-driven-development`를 추천한다. 각 task 완료 후 메인 세션에서 테스트와 파일 변경을 검토한 뒤 다음 task로 넘긴다.
