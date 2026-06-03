# Rejected Application Resubmission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow an applicant to create a new editable draft from a rejected application while preserving the original rejected application's approval steps and audit histories.

**Architecture:** Use a clone-and-resubmit policy instead of reopening the same application ID. The original application remains `REJECTED`; the backend creates a new `DRAFT` application with copied receipt fields and attachment rows that point to the same immutable stored file. Existing draft update, attachment preview, and submit endpoints handle the new application normally.

**Tech Stack:** Spring Boot 3, Spring Data JPA, PostgreSQL/Flyway, React/Vite, Vitest, Playwright.

---

## Policy Decision

- Rejected application resubmission creates a **new application ID**.
- The source application stays `REJECTED` with its original `application_approval_steps` and `approval_histories`.
- The new application starts as `DRAFT`.
- The new application copies source fields: `approvalType`, `applicationDate`, `receiptDate`, `vendor`, `amount`, `description`.
- The new application copies attachment rows by referencing the same stored file path and metadata. Stored receipt files are treated as immutable.
- Only the original applicant can create the resubmission draft.
- Only `REJECTED` applications can be copied for resubmission.

## Files

- Modify: `backend/src/main/java/com/theieum/approval/application/ApplicationService.java`
- Modify: `backend/src/main/java/com/theieum/approval/application/ApplicationController.java`
- Modify: `backend/src/main/java/com/theieum/approval/attachment/Attachment.java`
- Modify: `backend/src/main/java/com/theieum/approval/attachment/AttachmentRepository.java`
- Modify: `backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java`
- Modify: `frontend/src/applications/applicationApi.ts`
- Modify: `frontend/src/applications/ApplicationDetailPage.tsx`
- Modify: `frontend/src/applications/ApplicationDetailPage.test.tsx`
- Modify: `e2e/tests/receipt-approval-flow.spec.ts`

---

### Task 1: Backend Resubmission API

**Files:**
- Modify: `backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java`
- Modify: `backend/src/main/java/com/theieum/approval/application/ApplicationService.java`
- Modify: `backend/src/main/java/com/theieum/approval/application/ApplicationController.java`
- Modify: `backend/src/main/java/com/theieum/approval/attachment/Attachment.java`
- Modify: `backend/src/main/java/com/theieum/approval/attachment/AttachmentRepository.java`

- [ ] **Step 1: Write the failing API test**

Add this test to `ApiAuthorizationTest`:

```java
@Test
void applicantCanCreateDraftFromOwnRejectedApplication() throws Exception {
    long sourceApplicationId = submitApplication(3L, 1L);
    long stepId = stepId(sourceApplicationId, 1);
    String applicantToken = login("employee01");
    String approverToken = login("lead-dev");
    String otherApplicantToken = login("employee07");

    mockMvc.perform(post("/api/approvals/steps/{stepId}/reject", stepId)
                    .header("Authorization", bearer(approverToken))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {
                              "comment": "영수증 금액 확인 필요"
                            }
                            """))
            .andExpect(status().isOk());

    mockMvc.perform(post("/api/applications/{id}/resubmit", sourceApplicationId)
                    .header("Authorization", bearer(otherApplicantToken)))
            .andExpect(status().isForbidden());

    mockMvc.perform(post("/api/applications/{id}/resubmit", sourceApplicationId)
                    .header("Authorization", bearer(applicantToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").isNumber())
            .andExpect(jsonPath("$.id").value(org.hamcrest.Matchers.not((int) sourceApplicationId)))
            .andExpect(jsonPath("$.status").value("DRAFT"))
            .andExpect(jsonPath("$.vendor").value("테스트 상점"))
            .andExpect(jsonPath("$.attachments.length()").value(1));

    assertThat(applicationStatus(sourceApplicationId)).isEqualTo("REJECTED");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test --tests 'com.theieum.approval.api.ApiAuthorizationTest.applicantCanCreateDraftFromOwnRejectedApplication'
```

Expected: fail with 404 for `POST /api/applications/{id}/resubmit`.

- [ ] **Step 3: Add attachment clone support**

Add a static factory to `Attachment.java`:

```java
public static Attachment copyFor(Application application, Attachment source, User uploadedBy) {
    return new Attachment(
            application,
            source.getOriginalFilename(),
            new StoredFile(
                    source.getStoredFilename(),
                    source.getFilePath(),
                    source.getFileSize(),
                    source.getMimeType()),
            uploadedBy);
}
```

Ensure `StoredFile` is imported if needed:

```java
import com.theieum.approval.attachment.StoredFile;
```

- [ ] **Step 4: Add repository helper**

`AttachmentRepository` already has:

```java
List<Attachment> findByApplicationIdOrderByIdAsc(Long applicationId);
```

No extra repository method is required for MVP cloning.

- [ ] **Step 5: Implement service method**

Add this method to `ApplicationService`:

```java
public Application createResubmissionDraft(long applicationId, long actorId) {
    Application source = findApplication(applicationId);
    User actor = findActiveUser(actorId);
    if (!source.getApplicant().getId().equals(actor.getId())) {
        throw new ForbiddenOperationException("Only the applicant can resubmit this application");
    }
    if (source.getStatus() != ApplicationStatus.REJECTED) {
        throw new WorkflowConflictException("Only rejected applications can be resubmitted");
    }

    Application draft = new Application(
            actor,
            source.getApprovalType(),
            source.getApplicationDate(),
            source.getReceiptDate(),
            source.getVendor(),
            source.getAmount(),
            source.getDescription());
    Application saved = applicationRepository.save(draft);

    List<Attachment> copiedAttachments = attachmentRepository
            .findByApplicationIdOrderByIdAsc(source.getId())
            .stream()
            .map(attachment -> Attachment.copyFor(saved, attachment, actor))
            .toList();
    attachmentRepository.saveAll(copiedAttachments);

    return saved;
}
```

- [ ] **Step 6: Add controller endpoint**

Add this endpoint to `ApplicationController`:

```java
@PostMapping("/{id}/resubmit")
@Transactional
public ApplicationResponse resubmit(
        @AuthenticationPrincipal AuthenticatedUser user,
        @PathVariable long id) {
    requireRole(user, "APPLICANT");
    return toResponse(applicationService.createResubmissionDraft(id, user.id()));
}
```

- [ ] **Step 7: Run API test to verify it passes**

Run:

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test --tests 'com.theieum.approval.api.ApiAuthorizationTest.applicantCanCreateDraftFromOwnRejectedApplication'
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 8: Commit backend API**

```bash
git add backend/src/main/java/com/theieum/approval/application/ApplicationService.java \
  backend/src/main/java/com/theieum/approval/application/ApplicationController.java \
  backend/src/main/java/com/theieum/approval/attachment/Attachment.java \
  backend/src/main/java/com/theieum/approval/attachment/AttachmentRepository.java \
  backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java
git commit -m "feat: create draft from rejected application"
```

---

### Task 2: Frontend Resubmission Action

**Files:**
- Modify: `frontend/src/applications/applicationApi.ts`
- Modify: `frontend/src/applications/ApplicationDetailPage.tsx`
- Modify: `frontend/src/applications/ApplicationDetailPage.test.tsx`

- [ ] **Step 1: Write failing detail-page test**

Add this test to `ApplicationDetailPage.test.tsx`:

```tsx
it('반려 신청서에서 재상신 임시저장을 생성한다', async () => {
  const rejectedResponse = {
    ...applicationResponse,
    status: 'REJECTED',
    completedAt: '2026-06-03T03:00:00Z',
    attachments: []
  };
  const resubmissionDraft = {
    ...rejectedResponse,
    id: 101,
    status: 'DRAFT',
    submittedAt: null,
    completedAt: null
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url === '/api/applications/100/resubmit' && init?.method === 'POST') {
      return new Response(JSON.stringify(resubmissionDraft), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url === '/api/applications/100') {
      return new Response(JSON.stringify(rejectedResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(null, { status: 404 });
  });

  vi.stubGlobal('fetch', fetchMock);
  render(<App />);

  await screen.findByText('반려');
  await screen.getByRole('button', { name: '재상신 작성' }).click();

  expect(await screen.findByText('임시저장')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/applications/100/resubmit', expect.objectContaining({
    method: 'POST'
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd frontend
npm run test -- ApplicationDetailPage.test.tsx
```

Expected: fail because `재상신 작성` button does not exist.

- [ ] **Step 3: Add API function**

Add to `applicationApi.ts`:

```ts
export function createResubmissionDraft(applicationId: number) {
  return api<ApplicationResponse>(`/applications/${applicationId}/resubmit`, {
    method: 'POST'
  });
}
```

- [ ] **Step 4: Add detail button and handler**

Modify `ApplicationDetailPage.tsx` imports:

```ts
import {
  cancelApplication,
  createResubmissionDraft,
  getApplication,
  getAttachmentContent
} from './applicationApi';
```

Add handler:

```ts
async function handleCreateResubmissionDraft() {
  if (!application) {
    return;
  }

  setError('');

  try {
    setApplication(await createResubmissionDraft(application.id));
  } catch (requestError) {
    setError(errorMessage(requestError));
  }
}
```

Add button next to refresh/cancel actions:

```tsx
{application?.status === 'REJECTED' ? (
  <button className="secondary-button" type="button" onClick={handleCreateResubmissionDraft}>
    재상신 작성
  </button>
) : null}
```

- [ ] **Step 5: Run frontend test to verify it passes**

Run:

```bash
cd frontend
npm run test -- ApplicationDetailPage.test.tsx
```

Expected: `ApplicationDetailPage.test.tsx` passes.

- [ ] **Step 6: Commit frontend action**

```bash
git add frontend/src/applications/applicationApi.ts \
  frontend/src/applications/ApplicationDetailPage.tsx \
  frontend/src/applications/ApplicationDetailPage.test.tsx
git commit -m "feat: add rejected resubmission action"
```

---

### Task 3: E2E Coverage and Final Verification

**Files:**
- Modify: `e2e/tests/receipt-approval-flow.spec.ts`

- [ ] **Step 1: Add E2E reject/resubmit check**

Add a second Playwright test to `receipt-approval-flow.spec.ts`:

```ts
test('반려된 신청서에서 재상신 임시저장을 생성한다', async ({ page }) => {
  const uniqueVendor = `반려 재상신 E2E ${Date.now()}`;

  await login(page, 'employee01');
  await page.getByRole('link', { name: '새 신청' }).click();
  await page.getByLabel('신청일자').fill('2026-06-03');
  await page.getByLabel('영수증 일자').fill('2026-06-03');
  await page.getByLabel('사용처').fill(uniqueVendor);
  await page.getByLabel('금액').fill('12000');
  await page.getByLabel('신청 내용').fill('재상신 검증용 신청');
  await page.getByLabel('영수증 이미지 첨부').setInputFiles('fixtures/receipt.png');
  await page.getByRole('button', { name: '제출' }).click();
  const sourcePath = new URL(page.url()).pathname;

  await login(page, 'lead-dev');
  await page.getByRole('link', { name: '결재함' }).click();
  const approvalRow = page.getByRole('row').filter({ hasText: uniqueVendor });
  await approvalRow.getByLabel('반려 의견').fill('E2E 반려');
  await approvalRow.getByRole('button', { name: '반려' }).click();
  await expect(approvalRow).toBeHidden();

  await login(page, 'employee01');
  await page.goto(sourcePath);
  await expect(page.getByText('반려')).toBeVisible();
  await page.getByRole('button', { name: '재상신 작성' }).click();
  await expect(page.getByText('임시저장')).toBeVisible();
  await expect(page.getByText(uniqueVendor)).toBeVisible();
  await expect(page.getByAltText('receipt.png 미리보기')).toBeVisible();
});
```

- [ ] **Step 2: Run E2E to verify it passes**

Run:

```bash
cd /Users/kyh/theieum
docker compose -p theieum_resubmit_e2e up --build -d postgres backend frontend
cd e2e
npm run test
cd ..
docker compose -p theieum_resubmit_e2e down -v
```

Expected: Playwright reports all tests passed.

- [ ] **Step 3: Run final verification**

Run:

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test
```

```bash
cd frontend
npm run test
npm run build
```

```bash
cd /Users/kyh/theieum
docker compose config
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 4: Commit E2E and final changes**

```bash
git add e2e/tests/receipt-approval-flow.spec.ts
git commit -m "test: cover rejected resubmission flow"
```

---

## Self-Review

- Spec coverage: backend ownership/status validation, new draft creation, attachment carry-forward, frontend action, E2E, and final verification are covered.
- Placeholder scan: no TBD/TODO/fill-in instructions remain.
- Type consistency: endpoint is consistently `POST /api/applications/{id}/resubmit`; frontend function is `createResubmissionDraft`; status remains existing `DRAFT`/`REJECTED`.
