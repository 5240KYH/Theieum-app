# Mobile PWA Staging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 외부 테스트 인원 5~10명이 안정적으로 체험할 수 있는 스테이징 구성과 모바일/PWA 사용성 개선을 추가한다.

**Architecture:** 로컬 `docker-compose.yml`은 MVP 검증용으로 보존하고, 외부 체험용 설정은 단독 `docker-compose.staging.yml`과 `.env.staging.example`로 분리한다. 프론트는 기존 React/Vite SPA 구조를 유지하면서 `AppLayout`에 모바일 하단 탭과 더보기 메뉴를 추가하고, 신청서/결재함/상세 화면은 모바일에서 터치하기 쉬운 액션 영역과 카드형 보조 표시를 제공한다.

**Tech Stack:** Spring Boot, React 18, Vite, TypeScript, React Router, lucide-react, Vitest, Testing Library, Docker Compose, nginx, PostgreSQL.

---

## Scope And Guardrails

- 실제 작업 시작 전 현재 브랜치와 작업트리를 다시 확인한다.
- 사용자가 별도로 요청하기 전까지 `git add`, `git commit`, `git push`를 실행하지 않는다.
- Docker 데몬이 꺼져 있으면 compose 정적 검증까지만 수행하고, 실제 기동 검증은 Docker 사용 가능 시점에 넘긴다.
- 스테이징은 사전 체험 환경이다. 정식 운영 배포, SSO/OIDC, 이메일/카카오 발송, S3/MinIO 전환, 네이티브 앱 개발은 제외한다.

## File Structure

- Create: `docker-compose.staging.yml`  
  외부 체험용 단독 compose. DB/backend 포트를 호스트에 공개하지 않고 frontend만 공개한다.
- Create: `.env.staging.example`  
  스테이징 서버에서 복사해 쓸 환경변수 예시. 실제 secret 값은 저장하지 않는다.
- Create: `docs/staging-test-guide.md`  
  체험자에게 전달할 접속/계정/시나리오/피드백 가이드.
- Modify: `README.md`  
  스테이징 체험 문서 링크와 실행 개요 추가.
- Modify: `docs/deployment-readiness-checklist.md`  
  사전 체험용 staging 체크리스트를 운영 체크리스트와 구분해 추가.
- Modify: `docs/admin-user-guide.md`  
  관리자 관점의 스테이징 체험 준비 절차 추가.
- Create: `frontend/public/manifest.webmanifest`  
  PWA 설치 메타데이터.
- Create: `frontend/public/icons/icon.svg`  
  PWA 기본 아이콘.
- Modify: `frontend/index.html`  
  viewport, theme color, manifest, iOS 홈 화면 메타 추가.
- Modify: `frontend/src/shared/layout/AppLayout.tsx`  
  모바일 하단 탭, 더보기 메뉴, 관리 메뉴 노출 규칙.
- Modify: `frontend/src/shared/layout/AppLayout.test.tsx`  
  모바일 하단 탭과 더보기 메뉴 테스트.
- Modify: `frontend/src/applications/ApplicationForm.tsx`  
  모바일 sticky form action 영역과 첨부 UI 클래스 분리.
- Modify: `frontend/src/applications/ApplicationForm.test.tsx`  
  모바일 액션/첨부 UI 구조 테스트.
- Modify: `frontend/src/approvals/ApprovalsInboxPage.tsx`  
  결재함 카드형 보조 목록 추가.
- Create: `frontend/src/approvals/ApprovalsInboxPage.test.tsx`  
  결재함 카드 표시와 승인/반려 동작 테스트.
- Modify: `frontend/src/applications/ApplicationDetailPage.tsx`  
  상세 화면 모바일 action bar 클래스와 결재 이력 카드형 보조 표시.
- Modify: `frontend/src/applications/ApplicationDetailPage.test.tsx`  
  상세 action bar와 이력 카드 테스트.
- Modify: `frontend/src/admin/AdminReferencePage.tsx`  
  관리자 핵심 화면 모바일용 보조 클래스/컨테이너 추가.
- Modify: `frontend/src/admin/AdminReferencePage.test.tsx`  
  관리자 모바일 컨테이너가 렌더링되는지 테스트.
- Modify: `frontend/src/app/styles.css`  
  PWA/mobile spacing, bottom nav, sticky action, card list, admin mobile polish.
- Create: `e2e/tests/mobile-pwa-staging.spec.ts`  
  모바일 viewport에서 manifest와 핵심 navigation을 확인하는 Playwright smoke.
- Create: `docs/handoffs/2026-06-04-task-15-mobile-pwa-staging.md`  
  구현 완료 후 새 채팅 재시작용 인수인계.

---

### Task 1: Staging Compose And Environment Template

**Files:**
- Create: `docker-compose.staging.yml`
- Create: `.env.staging.example`
- Test: compose config command

- [ ] **Step 1: Write `docker-compose.staging.yml`**

Create `docker-compose.staging.yml` with this content:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USERNAME}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-staging-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USERNAME} -d ${DB_NAME}"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  backend:
    build: ./backend
    environment:
      SPRING_PROFILES_ACTIVE: ${SPRING_PROFILES_ACTIVE}
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: ${DB_NAME}
      DB_USERNAME: ${DB_USERNAME}
      DB_PASSWORD: ${DB_PASSWORD}
      FILE_STORAGE_ROOT: /app/uploads
      JWT_SECRET: ${JWT_SECRET}
    volumes:
      - upload-staging-data:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "${FRONTEND_HTTP_PORT}:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres-staging-data:
  upload-staging-data:
```

- [ ] **Step 2: Write `.env.staging.example`**

Create `.env.staging.example` with this content:

```dotenv
# Copy this file to .env.staging on the staging server.
# Do not commit .env.staging.
SPRING_PROFILES_ACTIVE=local
DB_NAME=approval_staging
DB_USERNAME=approval_staging
DB_PASSWORD=generate-a-long-random-db-password-before-running
JWT_SECRET=generate-a-long-random-jwt-secret-before-running
FRONTEND_HTTP_PORT=3000
STAGING_PUBLIC_URL=https://approval-staging.example.com
```

- [ ] **Step 3: Verify staging compose config**

Run:

```bash
cd /Users/kyh/theieum
docker compose --env-file .env.staging.example -f docker-compose.staging.yml config
```

Expected:

```text
services:
```

Also verify the rendered config includes only `postgres`, `backend`, and `frontend`, and does not expose backend `8080:8080`, postgres `5432:5432`, or postgres-test `55432:5432`. If Docker is unavailable, record the Docker error in the handoff and run this command later when Docker is available.

- [ ] **Step 4: Status checkpoint**

Run:

```bash
git status --short
```

Expected: `docker-compose.staging.yml` and `.env.staging.example` appear as untracked or modified files. Do not stage or commit yet.

---

### Task 2: External Tester Guide And Deployment Docs

**Files:**
- Create: `docs/staging-test-guide.md`
- Modify: `README.md`
- Modify: `docs/deployment-readiness-checklist.md`
- Modify: `docs/admin-user-guide.md`

- [ ] **Step 1: Create tester guide**

Create `docs/staging-test-guide.md`:

```markdown
# 외부 체험자 가이드

작성일: 2026-06-04

이 문서는 더이음 전자결재 앱을 외부 테스트 인원 5~10명이 사전 체험할 때 전달하는 안내서다. 이 환경은 정식 운영 환경이 아니며 실제 개인정보와 실제 영수증을 업로드하지 않는다.

## 1. 접속 정보

- 접속 URL: 스테이징 서버 준비 후 관리자에게 전달받은 HTTPS 주소
- 권장 브라우저: Chrome, Edge, Safari 최신 버전
- 모바일 사용: iOS Safari 또는 Android Chrome에서 홈 화면에 추가 후 사용

## 2. 첫 로그인

1. 전달받은 테스트 계정으로 로그인한다.
2. 우측 상단 `내 비밀번호 변경`을 눌러 임시 비밀번호를 변경한다.
3. 변경한 비밀번호를 분실하면 관리자에게 초기화를 요청한다.

## 3. 신청자 시나리오

1. `새 신청`으로 이동한다.
2. 신청일자, 영수증 일자, 사용처, 금액, 신청 내용을 입력한다.
3. 실제 영수증 대신 테스트용 이미지 또는 임의 이미지를 첨부한다.
4. 예상 결재선을 확인한다.
5. `제출`을 누른다.
6. `내 신청서`에서 상태가 `결재중`으로 보이는지 확인한다.

## 4. 결재자 시나리오

1. `결재함`으로 이동한다.
2. 결재 대기 신청서를 연다.
3. 사용처, 금액, 첨부 이미지를 확인한다.
4. 승인 또는 반려를 처리한다.
5. 반려 시 의견을 입력한다.

## 5. 관리자/매니저 시나리오

1. 관리 메뉴 접근 여부를 확인한다.
2. 사용자 관리에서 테스트 계정의 조직, 직위, 역할을 확인한다.
3. 결재선 관리에서 결재 유형과 단계가 한글로 보이는지 확인한다.
4. 전체 신청서에서 제출된 신청서를 확인한다.

## 6. 피드백 양식

- 사용 기기:
- 브라우저:
- 로그인 계정:
- 수행한 시나리오:
- 불편했던 화면:
- 기대한 동작:
- 실제 동작:
- 스크린샷 첨부 여부:

## 7. 금지 사항

- 실제 개인정보 입력 금지
- 실제 영수증 업로드 금지
- 테스트 계정을 다른 사람에게 재공유 금지
- 관리자 계정으로 임의 데이터 대량 삭제 금지
```

- [ ] **Step 2: Update README**

Add this link under the `## 문서` list in `README.md`:

```markdown
- [외부 체험자 가이드](docs/staging-test-guide.md): 스테이징 URL, 테스트 계정, 모바일 체험 시나리오 안내
```

Add this section after `## Docker 앱 실행`:

````markdown
## 스테이징 체험 환경

외부 테스트 인원 5~10명이 체험할 환경은 로컬 `docker-compose.yml`을 그대로 공개하지 않고 `docker-compose.staging.yml`과 `.env.staging`로 분리해 실행한다.

```bash
cp .env.staging.example .env.staging
docker compose --env-file .env.staging -f docker-compose.staging.yml config
docker compose --env-file .env.staging -f docker-compose.staging.yml up --build -d postgres backend frontend
```

스테이징 서버에서는 PostgreSQL과 backend 포트를 외부에 직접 공개하지 않는다. HTTPS는 서버 앞단의 Caddy, nginx+certbot, Cloudflare Tunnel, 또는 배포 플랫폼의 HTTPS 기능으로 적용한다.
````

- [ ] **Step 3: Update deployment checklist**

Append this section to `docs/deployment-readiness-checklist.md` before `## 8. 현재 차단/후속 후보`:

```markdown
## 8. 사전 체험 스테이징 체크리스트

- [ ] 스테이징 목적이 정식 운영이 아니라 5~10명 체험임을 공지한다.
- [ ] `docker-compose.staging.yml`과 `.env.staging`로 실행한다.
- [ ] `JWT_SECRET`, `DB_PASSWORD`는 `.env.staging.example` 값이 아니라 새 난수 값으로 교체한다.
- [ ] PostgreSQL과 backend 포트가 외부에 직접 공개되지 않는지 확인한다.
- [ ] HTTPS 접속 URL을 준비한다.
- [ ] 테스트 계정만 배포하고 실제 개인정보를 넣지 않는다.
- [ ] 체험자에게 `docs/staging-test-guide.md`를 전달한다.
- [ ] 테스트 종료 후 DB와 첨부 이미지 volume 보존 또는 삭제 여부를 결정한다.
```

Then renumber the old `## 8. 현재 차단/후속 후보` heading to `## 9. 현재 차단/후속 후보`.

- [ ] **Step 4: Update admin guide**

Add this subsection after `### 7.2 로컬 MVP compose와 운영 배포 분리` in `docs/admin-user-guide.md`:

````markdown
### 7.3 사전 체험 스테이징 실행

외부 테스트 인원 5~10명이 체험할 환경은 작은 스테이징 서버에서 실행한다. 로컬 MVP compose를 그대로 인터넷에 공개하지 않고, 단독 staging compose와 환경변수 파일을 사용한다.

```bash
cp .env.staging.example .env.staging
docker compose --env-file .env.staging -f docker-compose.staging.yml config
docker compose --env-file .env.staging -f docker-compose.staging.yml up --build -d postgres backend frontend
```

스테이징에서는 PostgreSQL과 backend 포트를 외부에 직접 열지 않는다. 외부 사용자는 HTTPS가 적용된 frontend URL로만 접속한다.
````

Then renumber the current `### 7.3 배포 후보 검증 명령` to `### 7.4 배포 후보 검증 명령`.

- [ ] **Step 5: Verify docs**

Run:

```bash
cd /Users/kyh/theieum
rg -n "staging|스테이징|외부 체험|docker-compose.staging" README.md docs
git diff --check
```

Expected: the new guide and links are found; `git diff --check` has no output.

---

### Task 3: PWA Manifest And HTML Metadata

**Files:**
- Create: `frontend/public/manifest.webmanifest`
- Create: `frontend/public/icons/icon.svg`
- Modify: `frontend/index.html`
- Test: `frontend npm run build`

- [ ] **Step 1: Create PWA icon**

Create `frontend/public/icons/icon.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title">
  <title id="title">더이음 결재</title>
  <rect width="512" height="512" rx="96" fill="#2159c6"/>
  <path d="M140 132h232c22 0 40 18 40 40v168c0 22-18 40-40 40H140c-22 0-40-18-40-40V172c0-22 18-40 40-40Z" fill="#ffffff"/>
  <path d="M152 190h208" stroke="#2159c6" stroke-width="28" stroke-linecap="round"/>
  <path d="M152 256h132" stroke="#2159c6" stroke-width="28" stroke-linecap="round"/>
  <path d="M152 322h92" stroke="#2159c6" stroke-width="28" stroke-linecap="round"/>
  <path d="m318 316 34 34 72-86" fill="none" stroke="#17a56b" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- [ ] **Step 2: Create manifest**

Create `frontend/public/manifest.webmanifest`:

```json
{
  "name": "더이음 전자결재",
  "short_name": "더이음 결재",
  "description": "영수증 첨부 전자결재 앱",
  "start_url": "/dashboard",
  "scope": "/",
  "display": "standalone",
  "background_color": "#f5f7fa",
  "theme_color": "#2159c6",
  "icons": [
    {
      "src": "/icons/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 3: Update `frontend/index.html`**

Replace the file with:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#2159c6" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="더이음 결재" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
    <title>더이음 전자결재</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Build verify**

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run build
```

Expected:

```text
✓ built
```

---

### Task 4: Mobile Bottom Navigation In AppLayout

**Files:**
- Modify: `frontend/src/shared/layout/AppLayout.tsx`
- Modify: `frontend/src/shared/layout/AppLayout.test.tsx`
- Modify: `frontend/src/app/styles.css`

- [ ] **Step 1: Add failing tests**

Append these tests inside `describe('AppLayout', () => { ... })` in `frontend/src/shared/layout/AppLayout.test.tsx`:

```tsx
  it('모바일 하단 탭에서 핵심 업무 메뉴를 제공한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })));

    render(<App />);

    expect(await screen.findByRole('navigation', { name: '모바일 주요 메뉴' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /대시보드/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /새 신청/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /내 신청서/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /결재함/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '더보기 메뉴 열기' })).toBeInTheDocument();
  });

  it('매니저는 모바일 더보기에서 관리 메뉴를 연다', async () => {
    localStorage.setItem('authUser', JSON.stringify({
      id: 10,
      loginId: 'manager01',
      name: '매니저01',
      roles: ['MANAGER', 'APPLICANT']
    }));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })));

    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: '더보기 메뉴 열기' }));

    expect(screen.getByRole('dialog', { name: '모바일 더보기 메뉴' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /사용자 관리/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /결재선 관리/ })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests and confirm fail**

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run test -- AppLayout
```

Expected: FAIL because `모바일 주요 메뉴` and `더보기 메뉴 열기` do not exist.

- [ ] **Step 3: Update `AppLayout.tsx` imports**

Add imports:

```tsx
  Menu,
  MoreHorizontal,
```

Keep existing imports sorted with the current lucide block.

- [ ] **Step 4: Add mobile menu state**

Inside `AppLayout`, after `isPasswordOpen` state:

```tsx
  const [isMobileMoreOpen, setMobileMoreOpen] = useState(false);
```

Add this helper before `return`:

```tsx
  function closeMobileMore() {
    setMobileMoreOpen(false);
  }
```

- [ ] **Step 5: Add mobile bottom nav before notification drawer**

Place this JSX immediately before `{isNotificationOpen ? ...}`:

```tsx
      <nav className="mobile-tabbar" aria-label="모바일 주요 메뉴">
        {workNavItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={closeMobileMore}>
            <Icon aria-hidden="true" size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          aria-label="더보기 메뉴 열기"
          aria-expanded={isMobileMoreOpen}
          onClick={() => setMobileMoreOpen((value) => !value)}
        >
          <MoreHorizontal aria-hidden="true" size={18} />
          <span>더보기</span>
        </button>
      </nav>
      {isMobileMoreOpen ? (
        <div className="mobile-more-panel" role="dialog" aria-label="모바일 더보기 메뉴">
          <div className="table-toolbar borderless-panel">
            <strong>더보기</strong>
            <button className="icon-button" type="button" aria-label="더보기 메뉴 닫기" onClick={closeMobileMore}>
              <Menu aria-hidden="true" size={18} />
            </button>
          </div>
          <nav className="mobile-more-links" aria-label="모바일 관리 메뉴">
            {canManage ? (
              <>
                {[...referenceNavItems, ...adminOnlyNavItems].map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} onClick={closeMobileMore}>
                    <Icon aria-hidden="true" size={18} />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </>
            ) : (
              <p className="panel-message">관리 메뉴 권한이 없습니다.</p>
            )}
          </nav>
        </div>
      ) : null}
```

- [ ] **Step 6: Add CSS**

Append before current `@media (max-width: 860px)`:

```css
.mobile-tabbar,
.mobile-more-panel {
  display: none;
}
```

Inside `@media (max-width: 620px)`, add:

```css
  .app-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    display: none;
  }

  .content {
    padding: 16px 14px 92px;
  }

  .mobile-tabbar {
    align-items: center;
    background: #ffffff;
    border-top: 1px solid #dce3eb;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    left: 0;
    min-height: 68px;
    padding: 6px max(8px, env(safe-area-inset-right)) max(6px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
    position: fixed;
    right: 0;
    z-index: 18;
  }

  .mobile-tabbar a,
  .mobile-tabbar button {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 6px;
    color: #536579;
    display: grid;
    font-size: 11px;
    font-weight: 800;
    gap: 3px;
    justify-items: center;
    min-height: 52px;
    padding: 4px 2px;
    text-decoration: none;
  }

  .mobile-tabbar a.active {
    background: #eaf1ff;
    color: #1f55bd;
  }

  .mobile-more-panel {
    background: #ffffff;
    border: 1px solid #d9e1ea;
    border-radius: 8px 8px 0 0;
    bottom: 68px;
    box-shadow: 0 -18px 45px rgba(15, 23, 42, 0.18);
    display: grid;
    left: 0;
    max-height: min(70vh, 520px);
    overflow-y: auto;
    position: fixed;
    right: 0;
    z-index: 19;
  }

  .mobile-more-links {
    display: grid;
    gap: 4px;
    padding: 10px;
  }

  .mobile-more-links a {
    align-items: center;
    border-radius: 6px;
    color: #263545;
    display: flex;
    gap: 10px;
    min-height: 44px;
    padding: 0 12px;
    text-decoration: none;
  }

  .mobile-more-links a.active {
    background: #eaf1ff;
    color: #1f55bd;
    font-weight: 800;
  }
```

- [ ] **Step 7: Run tests**

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run test -- AppLayout
```

Expected: PASS.

---

### Task 5: Mobile Application Form Actions And Attachment UX

**Files:**
- Modify: `frontend/src/applications/ApplicationForm.tsx`
- Modify: `frontend/src/applications/ApplicationForm.test.tsx`
- Modify: `frontend/src/app/styles.css`

- [ ] **Step 1: Add failing tests**

Append in `ApplicationForm.test.tsx`:

```tsx
  it('모바일 제출 액션 영역과 큰 첨부 영역을 렌더링한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })));

    render(<App />);

    expect(await screen.findByRole('group', { name: '신청서 저장 및 제출' })).toHaveClass('mobile-sticky-actions');
    expect(screen.getByTestId('receipt-upload-zone')).toHaveClass('receipt-upload-zone');
  });
```

- [ ] **Step 2: Run test and confirm fail**

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run test -- ApplicationForm
```

Expected: FAIL because the group and test id do not exist.

- [ ] **Step 3: Update attachment container**

In `ApplicationForm.tsx`, replace:

```tsx
        <div className="attachment-field">
```

with:

```tsx
        <div className="attachment-field receipt-upload-zone" data-testid="receipt-upload-zone">
```

- [ ] **Step 4: Update form actions container**

Replace:

```tsx
        <div className="form-actions">
```

with:

```tsx
        <div className="form-actions mobile-sticky-actions" role="group" aria-label="신청서 저장 및 제출">
```

- [ ] **Step 5: Add CSS**

Add near attachment styles:

```css
.receipt-upload-zone {
  background: #f8fafc;
  border: 1px dashed #b8c5d4;
  border-radius: 8px;
  padding: 14px;
}
```

Inside `@media (max-width: 620px)`, add:

```css
  .receipt-upload-zone {
    gap: 12px;
    padding: 16px;
  }

  .receipt-upload-zone input[type="file"] {
    background: #ffffff;
    border: 1px solid #c8d2dd;
    border-radius: 6px;
    min-height: 48px;
    padding: 10px;
    width: 100%;
  }

  .mobile-sticky-actions {
    background: #ffffff;
    border: 1px solid #d9e1ea;
    border-radius: 8px;
    bottom: 76px;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.14);
    display: grid;
    gap: 8px;
    grid-template-columns: 1fr 1fr;
    padding: 10px;
    position: sticky;
    z-index: 12;
  }

  .mobile-sticky-actions .secondary-button:last-child {
    grid-column: 1 / -1;
  }
```

- [ ] **Step 6: Run tests**

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run test -- ApplicationForm
```

Expected: PASS.

---

### Task 6: Mobile Approval Inbox Cards

**Files:**
- Modify: `frontend/src/approvals/ApprovalsInboxPage.tsx`
- Create: `frontend/src/approvals/ApprovalsInboxPage.test.tsx`
- Modify: `frontend/src/app/styles.css`

- [ ] **Step 1: Create failing test**

Create `frontend/src/approvals/ApprovalsInboxPage.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from '../app/App';

function createStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}

describe('ApprovalsInboxPage', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    localStorage.setItem('accessToken', 'approver-token');
    localStorage.setItem('authUser', JSON.stringify({
      id: 18,
      loginId: 'lead-dev',
      name: '개발팀장',
      roles: ['APPROVER']
    }));
    window.history.pushState({}, '', '/approvals');
  });

  afterEach(() => {
    cleanup();
    storage.clear();
    vi.unstubAllGlobals();
  });

  it('모바일 카드형 결재 대기 목록에서 승인한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/approvals/inbox') {
        return new Response(JSON.stringify([
          {
            stepId: 77,
            stepOrder: 1,
            stepStatus: 'PENDING',
            applicationId: 100,
            receiptDate: '2026-06-02',
            vendor: '문구점',
            amount: 12000,
            applicationStatus: 'IN_APPROVAL',
            applicantId: 3,
            applicantName: '직원01',
            organizationName: '개발팀',
            hasAttachment: true,
            receivedAt: '2026-06-03T01:00:00Z'
          }
        ]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url === '/api/approvals/steps/77/approve' && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 100, status: 'APPROVED' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    const mobileList = await screen.findByRole('list', { name: '모바일 결재 대기 목록' });
    const card = within(mobileList).getByRole('listitem', { name: /문구점/ });
    expect(card).toHaveTextContent('직원01');
    expect(card).toHaveTextContent('12,000원');

    await userEvent.click(within(card).getByRole('button', { name: '승인' }));

    expect(fetchMock).toHaveBeenCalledWith('/api/approvals/steps/77/approve', expect.objectContaining({
      method: 'POST'
    }));
  });
});
```

- [ ] **Step 2: Run test and confirm fail**

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run test -- ApprovalsInboxPage
```

Expected: FAIL because `모바일 결재 대기 목록` does not exist.

- [ ] **Step 3: Add mobile card list JSX**

In `ApprovalsInboxPage.tsx`, add this block immediately after the closing `</div>` of `.table-scroll` inside `.table-panel`:

```tsx
        <ul className="mobile-card-list" aria-label="모바일 결재 대기 목록">
          {!isLoading && items.length > 0 ? items.map((item) => (
            <li className="mobile-card-item" key={`mobile-${item.stepId}`} aria-label={`${item.vendor} ${item.applicantName}`}>
              <div className="section-title-row">
                <div>
                  <strong>{item.vendor}</strong>
                  <small>{item.applicantName} · {item.organizationName ?? '-'}</small>
                </div>
                <span className="status-pill compact">{applicationStatusLabel(item.applicationStatus)}</span>
              </div>
              <dl className="definition-grid compact-definition">
                <div>
                  <dt>금액</dt>
                  <dd>{formatMoney(item.amount)}</dd>
                </div>
                <div>
                  <dt>영수증</dt>
                  <dd>{formatDate(item.receiptDate)}</dd>
                </div>
                <div>
                  <dt>첨부</dt>
                  <dd>{attachmentLabel(item.hasAttachment)}</dd>
                </div>
                <div>
                  <dt>접수</dt>
                  <dd>{item.receivedAt ? formatDateTime(item.receivedAt) : '-'}</dd>
                </div>
              </dl>
              <label className="wide-field">
                결재 의견
                <input
                  className="comment-input"
                  value={comments[item.stepId] ?? ''}
                  onChange={(event) => setComments((current) => ({
                    ...current,
                    [item.stepId]: event.target.value
                  }))}
                  placeholder="의견"
                />
              </label>
              <div className="row-actions mobile-card-actions">
                <button className="primary-button" disabled={processingStepId === item.stepId} type="button" onClick={() => void handleApprove(item.stepId)}>
                  <Check aria-hidden="true" size={16} />
                  승인
                </button>
                <button className="secondary-button danger-button" disabled={processingStepId === item.stepId} type="button" onClick={() => void handleReject(item.stepId)}>
                  <X aria-hidden="true" size={16} />
                  반려
                </button>
                <Link className="secondary-button" to={`/applications/${item.applicationId}`}>
                  <Eye aria-hidden="true" size={16} />
                  상세
                </Link>
              </div>
            </li>
          )) : null}
        </ul>
```

- [ ] **Step 4: Add CSS**

Add:

```css
.mobile-card-list {
  display: none;
}

.compact-definition {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
```

Inside `@media (max-width: 620px)`, add:

```css
  .table-scroll {
    display: none;
  }

  .mobile-card-list {
    display: grid;
    gap: 12px;
    list-style: none;
    margin: 0;
    padding: 12px;
  }

  .mobile-card-item {
    background: #ffffff;
    border: 1px solid #d9e1ea;
    border-radius: 8px;
    display: grid;
    gap: 12px;
    padding: 14px;
  }

  .mobile-card-item small {
    color: #667789;
    display: block;
    margin-top: 4px;
  }

  .mobile-card-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
```

- [ ] **Step 5: Run test**

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run test -- ApprovalsInboxPage
```

Expected: PASS.

---

### Task 7: Mobile Application Detail Action And History Cards

**Files:**
- Modify: `frontend/src/applications/ApplicationDetailPage.tsx`
- Modify: `frontend/src/applications/ApplicationDetailPage.test.tsx`
- Modify: `frontend/src/app/styles.css`

- [ ] **Step 1: Add failing test**

Append to `ApplicationDetailPage.test.tsx`:

```tsx
  it('상세 화면에 모바일 액션 영역과 이력 카드 목록을 제공한다', async () => {
    const response = {
      ...applicationResponse,
      status: 'CANCELED',
      completedAt: '2026-06-03T01:10:00Z',
      attachments: [],
      approvalHistories: [
        {
          id: 801,
          stepOrder: 1,
          action: 'REJECTED',
          originalApprover: { id: 18, name: '개발팀장' },
          actor: { id: 18, name: '개발팀장' },
          adminOverride: false,
          adminReason: null,
          comment: '영수증 재첨부 필요',
          actedAt: '2026-06-03T02:00:00Z'
        }
      ]
    };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/applications/100') {
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(null, { status: 404 });
    }));

    render(<App />);

    expect(await screen.findByRole('group', { name: '신청서 상세 작업' })).toHaveClass('mobile-detail-actions');
    const historyCards = await screen.findByRole('list', { name: '모바일 결재 이력' });
    expect(historyCards).toHaveTextContent('영수증 재첨부 필요');
  });
```

- [ ] **Step 2: Run test and confirm fail**

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run test -- ApplicationDetailPage
```

Expected: FAIL because the group/list does not exist.

- [ ] **Step 3: Add action group attributes**

In `ApplicationDetailPage.tsx`, replace:

```tsx
        <div className="row-actions">
```

with:

```tsx
        <div className="row-actions mobile-detail-actions" role="group" aria-label="신청서 상세 작업">
```

- [ ] **Step 4: Add mobile history card list**

Inside the `결재 이력` section, after the `.table-scroll` div, add:

```tsx
            <ul className="mobile-card-list" aria-label="모바일 결재 이력">
              {application.approvalHistories && application.approvalHistories.length > 0 ? (
                application.approvalHistories.map((history) => (
                  <li className="mobile-card-item" key={`mobile-history-${history.id}`}>
                    <div className="section-title-row">
                      <strong>{approvalStepStatusLabel(history.action)}</strong>
                      <span>{formatDateTime(history.actedAt)}</span>
                    </div>
                    <dl className="definition-grid compact-definition">
                      <div>
                        <dt>단계</dt>
                        <dd>{history.stepOrder ?? '-'}</dd>
                      </div>
                      <div>
                        <dt>원 결재자</dt>
                        <dd>{history.originalApprover?.name ?? '-'}</dd>
                      </div>
                      <div>
                        <dt>처리자</dt>
                        <dd>{history.actor.name}</dd>
                      </div>
                      <div>
                        <dt>사유/메모</dt>
                        <dd>{history.adminReason ?? history.comment ?? '-'}</dd>
                      </div>
                    </dl>
                  </li>
                ))
              ) : null}
            </ul>
```

- [ ] **Step 5: Add CSS**

Inside `@media (max-width: 620px)`, add:

```css
  .mobile-detail-actions {
    background: #ffffff;
    border: 1px solid #d9e1ea;
    border-radius: 8px;
    display: grid;
    gap: 8px;
    grid-template-columns: 1fr;
    padding: 10px;
  }
```

- [ ] **Step 6: Run test**

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run test -- ApplicationDetailPage
```

Expected: PASS.

---

### Task 8: Admin Mobile Polish

**Files:**
- Modify: `frontend/src/admin/AdminReferencePage.tsx`
- Modify: `frontend/src/admin/AdminReferencePage.test.tsx`
- Modify: `frontend/src/app/styles.css`

- [ ] **Step 1: Add failing test**

Append to `AdminReferencePage.test.tsx`:

```tsx
  it('관리 기준정보 화면은 모바일 보조 컨테이너를 제공한다', async () => {
    setAuth(['MANAGER', 'APPLICANT']);
    window.history.pushState({}, '', '/admin/approval-lines');
    vi.stubGlobal('fetch', mockReferenceFetch());

    render(<App />);

    expect(await screen.findByRole('heading', { name: '결재선 관리' })).toBeInTheDocument();
    expect(screen.getByTestId('admin-mobile-reference')).toHaveClass('admin-mobile-reference');
  });
```

- [ ] **Step 2: Run test and confirm fail**

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run test -- AdminReferencePage
```

Expected: FAIL because `admin-mobile-reference` test id does not exist.

- [ ] **Step 3: Add mobile wrapper**

In `AdminReferencePage.tsx`, locate the main table/edit section wrapper and add:

```tsx
data-testid="admin-mobile-reference"
```

and class:

```tsx
className="admin-mobile-reference"
```

If the current wrapper already has a class, merge the class names rather than replacing existing styles.

- [ ] **Step 4: Add CSS**

Add:

```css
.admin-mobile-reference {
  min-width: 0;
}
```

Inside `@media (max-width: 620px)`, add:

```css
  .admin-mobile-reference .admin-edit-panel {
    padding: 14px;
  }

  .admin-mobile-reference .approval-line-step-row {
    grid-template-columns: 1fr;
  }

  .admin-mobile-reference .row-actions {
    display: grid;
    grid-template-columns: 1fr;
  }
```

- [ ] **Step 5: Run test**

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run test -- AdminReferencePage
```

Expected: PASS.

---

### Task 9: Mobile/PWA Playwright Smoke

**Files:**
- Create: `e2e/tests/mobile-pwa-staging.spec.ts`
- Test: `e2e npm run test -- mobile-pwa-staging.spec.ts`

- [ ] **Step 1: Create Playwright smoke spec**

Create `e2e/tests/mobile-pwa-staging.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});

test('mobile shell exposes pwa manifest and bottom navigation', async ({ page }) => {
  await page.goto('/login');

  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');

  await page.getByLabel('아이디').fill('employee01');
  await page.getByLabel('비밀번호').fill('password');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '모바일 주요 메뉴' })).toBeVisible();
  await page.getByRole('link', { name: /새 신청/ }).click();
  await expect(page.getByRole('heading', { name: '신청서 작성' })).toBeVisible();
});
```

- [ ] **Step 2: Run only this E2E when Docker app is running**

Run:

```bash
cd /Users/kyh/theieum/e2e
npm run test -- mobile-pwa-staging.spec.ts
```

Expected:

```text
1 passed
```

If Docker app is not running, record `not run: Docker app unavailable` in the Task 15 handoff.

---

### Task 10: Final Docs And Handoff

**Files:**
- Create: `docs/handoffs/2026-06-04-task-15-mobile-pwa-staging.md`
- Modify: `docs/handoff-2026-06-03.md`

- [ ] **Step 1: Create Task 15 handoff**

Create `docs/handoffs/2026-06-04-task-15-mobile-pwa-staging.md`:

````markdown
# Task 15 모바일/PWA 사용성 개선과 외부 체험 스테이징 인수인계

작성 시점: 2026-06-04, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
기준 설계: `docs/superpowers/specs/2026-06-04-mobile-pwa-staging-design.md`
구현 계획: `docs/superpowers/plans/2026-06-04-mobile-pwa-staging-implementation.md`

## 완료 범위

- 스테이징 compose와 env 예시 추가
- 외부 체험자 가이드 추가
- PWA manifest와 모바일 홈 화면 메타 추가
- 모바일 하단 탭과 더보기 관리 메뉴 추가
- 신청서 작성 모바일 첨부/액션 UX 개선
- 결재함 모바일 카드형 목록 추가
- 신청서 상세 모바일 이력 카드 추가
- 관리자 기준정보 화면 모바일 깨짐 완화

## 검증 결과

```text
frontend npm run test:
frontend npm run build:
docker compose config:
docker compose --env-file .env.staging.example -f docker-compose.staging.yml config:
e2e mobile-pwa-staging:
git diff --check:
```

## 다음 확인

- 실제 스테이징 서버에서 HTTPS URL 연결
- 테스트 계정 배포와 비밀번호 변경 안내
- 체험 종료 후 DB/첨부파일 정리
````

During implementation, write the actual pass/fail text into the verification lines before finalizing the handoff.

- [ ] **Step 2: Update root handoff**

Add a "최신 업데이트: Task 15" block near the top of `docs/handoff-2026-06-03.md`:

````markdown
## 최신 업데이트: Task 15 모바일/PWA 사용성 개선과 외부 체험 스테이징

Task 15 문서:

```text
docs/superpowers/specs/2026-06-04-mobile-pwa-staging-design.md
docs/superpowers/plans/2026-06-04-mobile-pwa-staging-implementation.md
docs/handoffs/2026-06-04-task-15-mobile-pwa-staging.md
```

핵심 내용:

- 외부 체험 기본 방식은 작은 스테이징 서버
- 로컬 MVP compose와 staging compose 분리
- 테스트 계정/체험자 가이드 추가
- PWA manifest와 모바일 홈 화면 메타 추가
- 모바일 하단 탭, 신청서 작성, 결재함, 상세 화면 사용성 개선
````

- [ ] **Step 3: Run full frontend verification**

Run:

```bash
cd /Users/kyh/theieum/frontend
npm run test
npm run build
```

Expected: tests pass and Vite build prints `✓ built`.

- [ ] **Step 4: Run compose and diff checks**

Run:

```bash
cd /Users/kyh/theieum
docker compose config
docker compose --env-file .env.staging.example -f docker-compose.staging.yml config
git diff --check
git status --short
```

Expected: compose config commands render services, `git diff --check` has no output, status shows intended Task 15 files only.

- [ ] **Step 5: Manual git checkpoint only**

Do not run `git add`, `git commit`, or `git push` unless the user explicitly asks. Report the changed files and verification output to the user.

---

## Self-Review Checklist

- Spec coverage: staging compose, tester guide, PWA manifest, mobile nav, application form, approval inbox, application detail, admin mobile polish, verification, handoff are covered.
- Placeholder scan: this plan intentionally uses example secret strings only in `.env.staging.example`; real `.env.staging` must be generated outside git.
- Type consistency: component names and route paths match current source files.
- Scope check: implementation stays within staging and mobile/PWA usability; production deployment and native app work remain excluded.
