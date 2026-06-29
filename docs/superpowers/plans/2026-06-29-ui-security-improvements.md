# UI/UX Security Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자 편의 UI/UX와 보안 경계를 함께 개선하고, 병렬 AI 에이전트가 충돌 없이 개발하도록 작업 단위를 분리한다.

**Architecture:** 프론트는 기존 React/Vite 화면과 공통 CSS 패턴을 유지하면서 확인 모달, 필드별 안내, 위험 작업 확인을 각 화면 내부에 최소 추가한다. 백엔드는 역할 정규화 helper와 파일 저장소 root guard를 추가해 권한/첨부 보안 경계를 서버에서 고정한다. 검증은 화면별 Vitest, 백엔드 권한/저장소 테스트, build, `git diff --check` 순서로 수행한다.

**Tech Stack:** Spring Boot 3, Java 21, Gradle, React 18, Vite, TypeScript, Vitest, Testing Library, Docker Compose.

---

## Agent Team And Ownership

사용자가 최종 검증자다. 각 에이전트는 자기 소유 파일만 수정하고, 다른 에이전트 변경을 되돌리지 않는다.

- `Coordinator`: 계획 실행 순서, 충돌 조정, 통합 리뷰, 사용자 보고 담당.
- `Security/API Agent`: `backend/src/main/java/com/theieum/approval/auth/**`, `backend/src/main/java/com/theieum/approval/attachment/**`, 관련 backend tests.
- `UI Routing Agent`: `frontend/src/app/router.tsx`, `frontend/src/admin/AdminApplicationsPage.test.tsx`.
- `Application UX Agent`: `frontend/src/applications/ApplicationForm.tsx`, `frontend/src/applications/ApplicationForm.test.tsx`, 필요한 `frontend/src/app/styles.css` 일부.
- `Approval UX Agent`: `frontend/src/approvals/ApprovalsInboxPage.tsx`, `frontend/src/approvals/ApprovalsInboxPage.test.tsx`, 필요한 `frontend/src/app/styles.css` 일부.
- `Admin Safety Agent`: `frontend/src/admin/AdminReferencePage.tsx`, `frontend/src/admin/AdminReferencePage.test.tsx`, `frontend/src/admin/AdminApplicationsPage.tsx`, `frontend/src/admin/AdminApplicationsPage.test.tsx`, 필요한 `frontend/src/app/styles.css` 일부.
- `Verification/Docs Agent`: 테스트 실행 결과와 인수인계 문서 초안 담당.

`frontend/src/app/styles.css`는 통합 지점이다. UI 에이전트가 동시에 수정하지 않도록 Coordinator가 순서를 정한다.

## Parallel Waves

- Wave 1: Task 1, Task 2, Task 3은 병렬 가능하다.
- Wave 2: Task 4, Task 5, Task 6은 병렬 가능하지만 `styles.css` 수정은 Coordinator가 순차 통합한다.
- Wave 3: Task 7 검증과 문서 정리는 모든 구현 후 진행한다.

## File Structure

- Create: `backend/src/main/java/com/theieum/approval/auth/RoleAccess.java`
  - 역할 문자열 정규화와 `hasRole`, `hasAnyRole` 판단을 담당한다.
- Create: `backend/src/test/java/com/theieum/approval/auth/RoleAccessTest.java`
  - `MANGER` alias, trim, case normalization을 고정한다.
- Modify: `backend/src/main/java/com/theieum/approval/approval/ApprovalController.java`
  - `requireRole`에서 `RoleAccess.hasRole` 사용.
- Modify: `backend/src/main/java/com/theieum/approval/application/ApplicationController.java`
  - `requireRole`, `canRead`에서 `RoleAccess.hasRole` 사용.
- Modify: `backend/src/main/java/com/theieum/approval/application/ApplicationService.java`
  - 관리자 예외 결재 권한 판단에서 `RoleAccess.hasAnyRole` 사용.
- Modify: `backend/src/main/java/com/theieum/approval/admin/AdminController.java`
  - 기존 분산 role normalization을 `RoleAccess`로 이동.
- Modify: `backend/src/main/java/com/theieum/approval/calendar/CalendarEventService.java`
  - 일정 관리 권한 판단에서 `RoleAccess.hasAnyRole` 사용.
- Modify: `backend/src/main/java/com/theieum/approval/attachment/LocalFileStorage.java`
  - `read`와 `deleteIfExists`에서 storage root 하위 경로만 허용.
- Create: `backend/src/test/java/com/theieum/approval/attachment/LocalFileStorageTest.java`
  - root 밖 read/delete 차단 테스트.
- Modify: `frontend/src/app/router.tsx`
  - `/applications/:id` 접근 role에 `MANAGER` 포함.
- Modify: `frontend/src/admin/AdminApplicationsPage.test.tsx`
  - 매니저가 전체 신청서 상세로 이동 가능함을 고정.
- Modify: `frontend/src/applications/ApplicationForm.tsx`
  - 필드별 제출 차단 사유와 제출 전 확인 모달 추가.
- Modify: `frontend/src/applications/ApplicationForm.test.tsx`
  - 필드별 안내와 확인 후 제출을 테스트.
- Modify: `frontend/src/approvals/ApprovalsInboxPage.tsx`
  - 승인 전 확인 모달 추가, 비활성 첨부 버튼 제거 또는 상세 링크로 대체.
- Modify: `frontend/src/approvals/ApprovalsInboxPage.test.tsx`
  - 승인 전 확인 모달을 거친 뒤 승인 API 호출 테스트.
- Modify: `frontend/src/admin/AdminReferencePage.tsx`
  - 역할 변경 요약, 비밀번호 확인 입력, 완전 삭제 확인 문구 추가.
- Modify: `frontend/src/admin/AdminReferencePage.test.tsx`
  - 위험 작업 확인 절차 테스트.
- Modify: `frontend/src/admin/AdminApplicationsPage.tsx`
  - 월별 첨부 ZIP 다운로드 전 확인 모달 추가.
- Modify: `frontend/src/app/styles.css`
  - 기존 modal/form/table 패턴 안에서 확인 모달과 안내 목록 스타일만 보강.
- Create: `docs/handoffs/2026-06-29-task-28-ui-security-improvements.md`
  - 작업 종료 후 변경 요약과 검증 결과 기록.
- Modify: `docs/handoff-2026-06-03.md`
  - Task 28 최신 상태 요약 추가.

## Task 1: Manager Detail Route Alignment

**Agent:** UI Routing Agent

**Files:**
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/admin/AdminApplicationsPage.test.tsx`

- [ ] **Step 1: Write failing manager detail navigation test**

Append this test to `frontend/src/admin/AdminApplicationsPage.test.tsx` after the existing detail navigation test:

```tsx
  it('매니저는 전체 신청서에서 상세 화면으로 이동할 수 있다', async () => {
    localStorage.setItem('accessToken', 'manager-token');
    localStorage.setItem('authUser', JSON.stringify({
      id: 20,
      loginId: 'manager01',
      name: '매니저',
      roles: ['MANAGER']
    }));
    window.history.pushState({}, '', '/admin/applications');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === '/api/admin/applications') {
          return new Response(JSON.stringify(adminApplications), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (url === '/api/applications/10') {
          return new Response(JSON.stringify({ ...applicationDetail, attachments: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );

    render(<App />);

    const row = await screen.findByRole('row', { name: /문구점/ });
    await userEvent.click(within(row).getByRole('link', { name: '신청서 10 상세' }));

    expect(await screen.findByRole('heading', { name: '신청서 상세' })).toBeInTheDocument();
    expect(await screen.findByText('회의 준비 문구류')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the targeted test and confirm failure**

Run:

```bash
cd frontend && npm run test -- AdminApplicationsPage.test.tsx
```

Expected before implementation: the manager reaches `/dashboard` or the detail heading is not found because `/applications/:id` excludes `MANAGER`.

- [ ] **Step 3: Add `MANAGER` to detail route roles**

Change `frontend/src/app/router.tsx`:

```tsx
          <Route element={<ProtectedRoute requiredAnyRole={['APPLICANT', 'APPROVER', 'ADMIN', 'MANAGER']} />}>
            <Route path="/applications/:id" element={<ApplicationDetailPage />} />
          </Route>
```

- [ ] **Step 4: Run the targeted test and confirm pass**

Run:

```bash
cd frontend && npm run test -- AdminApplicationsPage.test.tsx
```

Expected: `AdminApplicationsPage.test.tsx` passes.

## Task 2: Backend Role Normalization

**Agent:** Security/API Agent

**Files:**
- Create: `backend/src/main/java/com/theieum/approval/auth/RoleAccess.java`
- Create: `backend/src/test/java/com/theieum/approval/auth/RoleAccessTest.java`
- Modify: `backend/src/main/java/com/theieum/approval/approval/ApprovalController.java`
- Modify: `backend/src/main/java/com/theieum/approval/application/ApplicationController.java`
- Modify: `backend/src/main/java/com/theieum/approval/application/ApplicationService.java`
- Modify: `backend/src/main/java/com/theieum/approval/admin/AdminController.java`
- Modify: `backend/src/main/java/com/theieum/approval/calendar/CalendarEventService.java`
- Test: `backend/src/test/java/com/theieum/approval/api/ApiAuthorizationTest.java`

- [ ] **Step 1: Write role helper test**

Create `backend/src/test/java/com/theieum/approval/auth/RoleAccessTest.java`:

```java
package com.theieum.approval.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

class RoleAccessTest {

    @Test
    void normalizesRoleCaseWhitespaceAndManagerTypo() {
        assertThat(RoleAccess.hasRole(List.of(" manager "), "MANAGER")).isTrue();
        assertThat(RoleAccess.hasRole(List.of("MANGER"), "MANAGER")).isTrue();
        assertThat(RoleAccess.hasRole(List.of("applicant"), "APPLICANT")).isTrue();
    }

    @Test
    void matchesAnyRoleAfterNormalization() {
        assertThat(RoleAccess.hasAnyRole(List.of("MANGER"), "ADMIN", "MANAGER")).isTrue();
        assertThat(RoleAccess.hasAnyRole(List.of("APPLICANT"), "ADMIN", "MANAGER")).isFalse();
    }
}
```

- [ ] **Step 2: Run the helper test and confirm failure**

Run:

```bash
cd backend && TMPDIR=/private/tmp GRADLE_USER_HOME=/Users/kyh/theieum/.gradle-home JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test --tests com.theieum.approval.auth.RoleAccessTest
```

Expected before implementation: compilation fails because `RoleAccess` does not exist.

- [ ] **Step 3: Add `RoleAccess` helper**

Create `backend/src/main/java/com/theieum/approval/auth/RoleAccess.java`:

```java
package com.theieum.approval.auth;

import java.util.Arrays;
import java.util.Collection;
import java.util.Locale;
import java.util.Objects;

public final class RoleAccess {

    private RoleAccess() {
    }

    public static boolean hasRole(AuthenticatedUser user, String role) {
        return user != null && hasRole(user.roles(), role);
    }

    public static boolean hasRole(Collection<String> roles, String role) {
        String expected = normalize(role);
        return roles != null && roles.stream()
                .map(RoleAccess::normalize)
                .anyMatch(expected::equals);
    }

    public static boolean hasAnyRole(AuthenticatedUser user, String... roles) {
        return user != null && hasAnyRole(user.roles(), roles);
    }

    public static boolean hasAnyRole(Collection<String> userRoles, String... roles) {
        if (userRoles == null || roles == null) {
            return false;
        }
        return Arrays.stream(roles)
                .filter(Objects::nonNull)
                .anyMatch(role -> hasRole(userRoles, role));
    }

    public static String normalize(String role) {
        if (role == null) {
            return "";
        }
        String normalized = role.trim().toUpperCase(Locale.ROOT);
        return normalized.equals("MANGER") ? "MANAGER" : normalized;
    }
}
```

- [ ] **Step 4: Update server role checks to use `RoleAccess`**

Use these replacements:

```java
// ApprovalController
import com.theieum.approval.auth.RoleAccess;

private void requireRole(AuthenticatedUser user, String role) {
    if (!RoleAccess.hasRole(user, role)) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }
}
```

```java
// ApplicationController
import com.theieum.approval.auth.RoleAccess;

private boolean canRead(AuthenticatedUser user, Application application) {
    if (user == null) {
        return false;
    }
    return RoleAccess.hasAnyRole(user, "ADMIN", "MANAGER")
            || application.getApplicant().getId().equals(user.id())
            || approvalStepRepository.existsReadableByApplicationIdAndApproverId(application.getId(), user.id());
}

private void requireRole(AuthenticatedUser user, String role) {
    if (!RoleAccess.hasRole(user, role)) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }
}
```

```java
// ApplicationService
import com.theieum.approval.auth.RoleAccess;

private boolean hasManagementRole(User user) {
    return RoleAccess.hasAnyRole(user.getRoleList(), "ADMIN", "MANAGER");
}
```

```java
// AdminController
import com.theieum.approval.auth.RoleAccess;

private void requireAdmin(AuthenticatedUser user) {
    if (!RoleAccess.hasRole(user, "ADMIN")) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }
}

private void requireManager(AuthenticatedUser user) {
    if (!RoleAccess.hasAnyRole(user, "ADMIN", "MANAGER")) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }
}

private boolean hasRole(AuthenticatedUser user, String role) {
    return RoleAccess.hasRole(user, role);
}
```

```java
// CalendarEventService
import com.theieum.approval.auth.RoleAccess;

private void requireManagePermission(AuthenticatedUser user) {
    if (!RoleAccess.hasAnyRole(user, "ADMIN", "MANAGER")) {
        throw new ForbiddenOperationException("일정 관리 권한이 없습니다.");
    }
}
```

- [ ] **Step 5: Run role-related tests**

Run:

```bash
cd backend && TMPDIR=/private/tmp GRADLE_USER_HOME=/Users/kyh/theieum/.gradle-home JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test --tests com.theieum.approval.auth.RoleAccessTest --tests com.theieum.approval.api.ApiAuthorizationTest --tests com.theieum.approval.calendar.CalendarEventServiceTest
```

Expected: all selected tests pass.

## Task 3: Attachment Storage Root Guard

**Agent:** Security/API Agent

**Files:**
- Modify: `backend/src/main/java/com/theieum/approval/attachment/LocalFileStorage.java`
- Create: `backend/src/test/java/com/theieum/approval/attachment/LocalFileStorageTest.java`

- [ ] **Step 1: Write root guard tests**

Create `backend/src/test/java/com/theieum/approval/attachment/LocalFileStorageTest.java`:

```java
package com.theieum.approval.attachment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import com.theieum.approval.common.FileStorageException;

class LocalFileStorageTest {

    @TempDir
    Path tempDir;

    @Test
    void readsStoredFileInsideRoot() {
        LocalFileStorage storage = new LocalFileStorage(tempDir);
        StoredFile stored = storage.store("receipt.png", "image/png", new byte[] {1, 2, 3});

        assertThat(storage.read(stored.filePath())).containsExactly(1, 2, 3);
    }

    @Test
    void rejectsReadOutsideRoot() throws Exception {
        LocalFileStorage storage = new LocalFileStorage(tempDir.resolve("attachments"));
        Path outside = tempDir.resolve("outside.txt");
        Files.writeString(outside, "secret");

        assertThatThrownBy(() -> storage.read(outside.toString()))
                .isInstanceOf(FileStorageException.class)
                .hasMessageContaining("outside configured storage root");
    }

    @Test
    void rejectsDeleteOutsideRoot() throws Exception {
        LocalFileStorage storage = new LocalFileStorage(tempDir.resolve("attachments"));
        Path outside = tempDir.resolve("outside.txt");
        Files.writeString(outside, "secret");

        assertThatThrownBy(() -> storage.deleteIfExists(outside.toString()))
                .isInstanceOf(FileStorageException.class)
                .hasMessageContaining("outside configured storage root");
        assertThat(Files.exists(outside)).isTrue();
    }
}
```

- [ ] **Step 2: Run storage tests and confirm failure**

Run:

```bash
cd backend && TMPDIR=/private/tmp GRADLE_USER_HOME=/Users/kyh/theieum/.gradle-home JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test --tests com.theieum.approval.attachment.LocalFileStorageTest
```

Expected before implementation: outside root tests fail because `read` and `deleteIfExists` accept arbitrary paths.

- [ ] **Step 3: Add root path resolution guard**

Modify `backend/src/main/java/com/theieum/approval/attachment/LocalFileStorage.java`:

```java
package com.theieum.approval.attachment;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.theieum.approval.common.FileStorageException;

@Component
public class LocalFileStorage implements FileStorage {

    private final Path storageDirectory;

    public LocalFileStorage(@Value("${app.file-storage.root-path}") Path storageDirectory) {
        this.storageDirectory = storageDirectory.toAbsolutePath().normalize();
    }

    @Override
    public StoredFile store(String originalFilename, String contentType, byte[] bytes) {
        Objects.requireNonNull(bytes, "bytes must not be null");

        String extension = extractExtension(originalFilename);
        String storedFilename = UUID.randomUUID() + extension;
        Path storedPath = storageDirectory.resolve(storedFilename).normalize();

        try {
            Files.createDirectories(storageDirectory);
            Files.write(storedPath, bytes);
        } catch (IOException ex) {
            throw new FileStorageException("Unable to store attachment", ex);
        }

        return new StoredFile(storedFilename, storedPath.toString(), bytes.length, contentType);
    }

    @Override
    public byte[] read(String path) {
        Path resolvedPath = resolveInsideRoot(path);
        try {
            return Files.readAllBytes(resolvedPath);
        } catch (IOException ex) {
            throw new FileStorageException("Unable to read attachment", ex);
        }
    }

    @Override
    public void deleteIfExists(String path) {
        Path resolvedPath = resolveInsideRoot(path);
        try {
            Files.deleteIfExists(resolvedPath);
        } catch (IOException ex) {
            throw new FileStorageException("Unable to delete attachment", ex);
        }
    }

    private Path resolveInsideRoot(String path) {
        Path resolvedPath = Path.of(path).toAbsolutePath().normalize();
        if (!resolvedPath.startsWith(storageDirectory)) {
            throw new FileStorageException("Attachment path is outside configured storage root");
        }
        return resolvedPath;
    }

    private String extractExtension(String originalFilename) {
        if (originalFilename == null) {
            return "";
        }

        int dotIndex = originalFilename.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == originalFilename.length() - 1) {
            return "";
        }

        return originalFilename.substring(dotIndex);
    }
}
```

- [ ] **Step 4: Run storage and authorization tests**

Run:

```bash
cd backend && TMPDIR=/private/tmp GRADLE_USER_HOME=/Users/kyh/theieum/.gradle-home JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test --tests com.theieum.approval.attachment.LocalFileStorageTest --tests com.theieum.approval.api.ApiAuthorizationTest
```

Expected: selected tests pass.

## Task 4: Application Form Guidance And Submit Confirmation

**Agent:** Application UX Agent

**Files:**
- Modify: `frontend/src/applications/ApplicationForm.tsx`
- Modify: `frontend/src/applications/ApplicationForm.test.tsx`
- Modify: `frontend/src/app/styles.css`

- [ ] **Step 1: Write field guidance and confirm-submit tests**

Add tests to `frontend/src/applications/ApplicationForm.test.tsx`:

```tsx
  it('필수 항목별 제출 차단 사유를 보여준다', async () => {
    vi.stubGlobal('fetch', mockDefaultApprovalFetch());

    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: '제출' }));

    expect(screen.getByRole('alert')).toHaveTextContent('필수 항목을 입력하면 제출할 수 있습니다.');
    expect(screen.getByText('영수증 일자를 입력해주세요.')).toBeInTheDocument();
    expect(screen.getByText('사용처를 입력해주세요.')).toBeInTheDocument();
    expect(screen.getByText('금액을 입력해주세요.')).toBeInTheDocument();
    expect(screen.getByText('신청 내용을 입력해주세요.')).toBeInTheDocument();
    expect(screen.getByText('영수증 이미지를 1개 이상 첨부해주세요.')).toBeInTheDocument();
  });

  it('제출 전 요약을 확인한 뒤 신청서를 제출한다', async () => {
    const file = new File(['receipt'], 'receipt.png', { type: 'image/png' });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/applications/approval-organizations') {
        return jsonResponse(approvalOrganizations);
      }

      if (url === '/api/applications/approval-preview?approvalTypeId=1&approvalOrganizationId=3') {
        return jsonResponse([]);
      }

      if (url === '/api/applications' && init?.method === 'POST') {
        return jsonResponse(draftResponse);
      }

      if (url === '/api/applications/100/attachments' && init?.method === 'POST') {
        return jsonResponse({ id: 1, originalFilename: 'receipt.png', mimeType: 'image/png', fileSize: 7 });
      }

      if (url === '/api/applications/100/submit' && init?.method === 'POST') {
        return jsonResponse(submittedResponse);
      }

      return jsonResponse([]);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await userEvent.type(await screen.findByLabelText('영수증 일자'), '20260602');
    await userEvent.type(screen.getByLabelText('사용처'), '문구점');
    await userEvent.type(screen.getByLabelText('금액'), '12000');
    await userEvent.type(screen.getByLabelText('신청 내용'), '회의 준비 문구류 구입');
    await userEvent.upload(screen.getByLabelText('영수증 이미지 첨부'), file);
    await userEvent.click(screen.getByRole('button', { name: '제출' }));

    const dialog = await screen.findByRole('dialog', { name: '신청서 제출 확인' });
    expect(dialog).toHaveTextContent('문구점');
    expect(dialog).toHaveTextContent('12,000원');

    await userEvent.click(within(dialog).getByRole('button', { name: '제출 확정' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/applications/100/submit', expect.objectContaining({
        method: 'POST'
      }));
    });
  });
```

- [ ] **Step 2: Run the targeted test and confirm failure**

Run:

```bash
cd frontend && npm run test -- ApplicationForm.test.tsx
```

Expected before implementation: field-specific messages and `신청서 제출 확인` dialog are missing.

- [ ] **Step 3: Add validation issue helper and confirm state**

In `ApplicationForm.tsx`, add after `fileKey`:

```tsx
function validationIssues(params: {
  receiptDate: string;
  vendor: string;
  amount: string;
  description: string;
  receiptFilesLength: number;
  existingAttachmentCount: number;
}) {
  const issues: string[] = [];
  if (!toIsoDate(params.receiptDate)) {
    issues.push('영수증 일자를 입력해주세요.');
  }
  if (!params.vendor.trim()) {
    issues.push('사용처를 입력해주세요.');
  }
  if (!params.amount) {
    issues.push('금액을 입력해주세요.');
  }
  if (!params.description.trim()) {
    issues.push('신청 내용을 입력해주세요.');
  }
  if (params.receiptFilesLength + params.existingAttachmentCount < 1) {
    issues.push('영수증 이미지를 1개 이상 첨부해주세요.');
  }
  return issues;
}
```

Inside `ApplicationForm`, add state:

```tsx
  const [submitIssues, setSubmitIssues] = useState<string[]>([]);
  const [pendingSubmit, setPendingSubmit] = useState(false);
```

Add a memo:

```tsx
  const currentSubmitIssues = useMemo(() => validationIssues({
    receiptDate,
    vendor,
    amount,
    description,
    receiptFilesLength: receiptFiles.length,
    existingAttachmentCount
  }), [amount, description, existingAttachmentCount, receiptDate, receiptFiles.length, vendor]);
```

- [ ] **Step 4: Route submit click through confirmation**

Where the current submit button calls the existing save/submit handler, change the submit path so an incomplete form sets `submitIssues` and a complete form opens confirmation:

```tsx
  function requestSubmitConfirmation() {
    if (currentSubmitIssues.length > 0) {
      setSubmitIssues(currentSubmitIssues);
      setError('필수 항목을 입력하면 제출할 수 있습니다.');
      return;
    }
    setSubmitIssues([]);
    setError('');
    setPendingSubmit(true);
  }
```

Keep the existing save draft path unchanged. Rename the existing submit implementation to `confirmSubmitApplication` if needed, and call it only from the modal confirm button.

- [ ] **Step 5: Render issue list and submit confirmation dialog**

Near the top-level error/message rendering, add:

```tsx
      {submitIssues.length > 0 ? (
        <ul className="validation-list" aria-label="제출 전 확인할 항목">
          {submitIssues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
```

Before the preview modal block or near other modals, add:

```tsx
      {pendingSubmit ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="submit-confirm-title">
          <div className="preview-modal compact-modal">
            <div className="table-toolbar borderless-panel">
              <strong id="submit-confirm-title">신청서 제출 확인</strong>
              <button className="icon-button" type="button" aria-label="닫기" onClick={() => setPendingSubmit(false)}>×</button>
            </div>
            <dl className="definition-grid compact-definition">
              <div>
                <dt>사용처</dt>
                <dd>{vendor.trim()}</dd>
              </div>
              <div>
                <dt>금액</dt>
                <dd>{formatAmountInput(amount)}원</dd>
              </div>
              <div>
                <dt>첨부</dt>
                <dd>{receiptFiles.length + existingAttachmentCount}개</dd>
              </div>
            </dl>
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setPendingSubmit(false)}>취소</button>
              <button className="primary-button" type="button" onClick={() => void confirmSubmitApplication()}>
                제출 확정
              </button>
            </div>
          </div>
        </div>
      ) : null}
```

- [ ] **Step 6: Add minimal CSS**

Append to `frontend/src/app/styles.css` near form or modal helpers:

```css
.validation-list {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem 0.75rem 1.25rem;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fff1f2;
  color: #991b1b;
}
```

- [ ] **Step 7: Run targeted tests**

Run:

```bash
cd frontend && npm run test -- ApplicationForm.test.tsx
```

Expected: targeted tests pass.

## Task 5: Approval Inbox Confirmation

**Agent:** Approval UX Agent

**Files:**
- Modify: `frontend/src/approvals/ApprovalsInboxPage.tsx`
- Modify: `frontend/src/approvals/ApprovalsInboxPage.test.tsx`
- Modify: `frontend/src/app/styles.css`

- [ ] **Step 1: Update approval test to require confirmation**

In `ApprovalsInboxPage.test.tsx`, update the mobile approval test after clicking `승인`:

```tsx
    await userEvent.click(within(card as HTMLElement).getByRole('button', { name: '승인' }));

    const dialog = await screen.findByRole('dialog', { name: '승인 확인' });
    expect(dialog).toHaveTextContent('문구점');
    expect(dialog).toHaveTextContent('직원01');
    expect(dialog).toHaveTextContent('12,000원');
    await userEvent.click(within(dialog).getByRole('button', { name: '승인 확정' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/approvals/steps/900/approve', expect.objectContaining({
        method: 'POST'
      }));
    });
```

- [ ] **Step 2: Run targeted test and confirm failure**

Run:

```bash
cd frontend && npm run test -- ApprovalsInboxPage.test.tsx
```

Expected before implementation: `승인 확인` dialog is missing.

- [ ] **Step 3: Add approve target state and request helper**

In `ApprovalsInboxPage.tsx`, add state:

```tsx
  const [approveTarget, setApproveTarget] = useState<ApprovalInboxItem | null>(null);
```

Add helper:

```tsx
  function requestApprove(item: ApprovalInboxItem) {
    setError('');
    setApproveTarget(item);
  }
```

Change approve buttons from:

```tsx
onClick={() => void handleApprove(item.stepId)}
```

to:

```tsx
onClick={() => requestApprove(item)}
```

- [ ] **Step 4: Render approve confirmation dialog**

Before `</section>`, add:

```tsx
      {approveTarget ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="approve-confirm-title">
          <div className="preview-modal compact-modal">
            <div className="table-toolbar borderless-panel">
              <strong id="approve-confirm-title">승인 확인</strong>
              <button className="icon-button" type="button" aria-label="닫기" onClick={() => setApproveTarget(null)}>×</button>
            </div>
            <dl className="definition-grid compact-definition">
              <div>
                <dt>신청자</dt>
                <dd>{approveTarget.applicantName}</dd>
              </div>
              <div>
                <dt>사용처</dt>
                <dd>{approveTarget.vendor}</dd>
              </div>
              <div>
                <dt>금액</dt>
                <dd>{formatMoney(approveTarget.amount)}</dd>
              </div>
              <div>
                <dt>첨부</dt>
                <dd>{attachmentLabel(approveTarget.hasAttachment)}</dd>
              </div>
            </dl>
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setApproveTarget(null)}>취소</button>
              <button
                className="primary-button"
                type="button"
                disabled={processingStepId === approveTarget.stepId}
                onClick={() => void handleApprove(approveTarget.stepId).then(() => setApproveTarget(null))}
              >
                승인 확정
              </button>
            </div>
          </div>
        </div>
      ) : null}
```

Remove the disabled `첨부 확대 보기` button. Keep the existing detail icon link as the attachment/detail inspection path.

- [ ] **Step 5: Run targeted tests**

Run:

```bash
cd frontend && npm run test -- ApprovalsInboxPage.test.tsx
```

Expected: targeted tests pass.

## Task 6: Admin Risk Confirmations

**Agent:** Admin Safety Agent

**Files:**
- Modify: `frontend/src/admin/AdminReferencePage.tsx`
- Modify: `frontend/src/admin/AdminReferencePage.test.tsx`
- Modify: `frontend/src/admin/AdminApplicationsPage.tsx`
- Modify: `frontend/src/admin/AdminApplicationsPage.test.tsx`
- Modify: `frontend/src/app/styles.css`

- [ ] **Step 1: Update password and hard-delete tests**

In `AdminReferencePage.test.tsx`, update the password test to type confirmation:

```tsx
    await userEvent.click(within(row).getByRole('button', { name: '비밀번호 변경' }));
    await userEvent.type(screen.getByLabelText('새 비밀번호'), 'changed-password');
    await userEvent.type(screen.getByLabelText('새 비밀번호 확인'), 'changed-password');
    await userEvent.click(screen.getByRole('button', { name: '변경 저장' }));
```

Update the hard delete test to require target name:

```tsx
    const dialog = screen.getByRole('dialog', { name: '완전 삭제' });
    expect(dialog).toHaveTextContent('복구할 수 없습니다');
    await userEvent.type(within(dialog).getByLabelText('삭제 확인 문구'), '사원');
    await userEvent.click(within(dialog).getByRole('button', { name: '완전 삭제' }));
```

Add role change summary assertion to the role checkbox test:

```tsx
    await userEvent.click(screen.getByRole('checkbox', { name: 'MANAGER' }));
    expect(screen.getByText('변경 후 역할: MANAGER,APPLICANT')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
```

- [ ] **Step 2: Add monthly attachment download confirmation test**

In `AdminApplicationsPage.test.tsx`, update the monthly download test so clicking first opens a dialog:

```tsx
    await userEvent.click(screen.getByRole('button', { name: '월별 첨부 다운로드' }));

    const dialog = await screen.findByRole('dialog', { name: '월별 첨부 다운로드 확인' });
    expect(dialog).toHaveTextContent('2026-06');
    expect(dialog).toHaveTextContent('민감한 영수증 이미지');
    await userEvent.click(within(dialog).getByRole('button', { name: '다운로드 시작' }));
```

- [ ] **Step 3: Run targeted tests and confirm failure**

Run:

```bash
cd frontend && npm run test -- AdminReferencePage.test.tsx AdminApplicationsPage.test.tsx
```

Expected before implementation: confirmation fields and download dialog are missing.

- [ ] **Step 4: Add password confirmation**

In `AdminReferencePage.tsx`, add state:

```tsx
  const [passwordConfirm, setPasswordConfirm] = useState('');
```

Clear it when closing or submitting password modal:

```tsx
setPasswordConfirm('');
```

In `handlePasswordSubmit`, add:

```tsx
    if (password !== passwordConfirm) {
      setError('새 비밀번호와 확인 값이 일치하지 않습니다.');
      return;
    }
```

In the password modal, add:

```tsx
            <label>
              새 비밀번호 확인
              <input
                aria-label="새 비밀번호 확인"
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
              />
            </label>
```

- [ ] **Step 5: Add role change summary**

Below `RoleCheckboxGroup`, render:

```tsx
                      <p className="muted-copy role-change-summary">
                        변경 후 역할: {String(draft.roles ?? 'APPLICANT') || 'APPLICANT'}
                      </p>
```

- [ ] **Step 6: Add hard delete typed confirmation**

Add state:

```tsx
  const [hardDeleteConfirmText, setHardDeleteConfirmText] = useState('');
```

Clear it in `openHardDelete` and `closeHardDelete`.

In the hard-delete modal, add:

```tsx
              <label>
                삭제 확인 문구
                <input
                  aria-label="삭제 확인 문구"
                  value={hardDeleteConfirmText}
                  onChange={(event) => setHardDeleteConfirmText(event.target.value)}
                  placeholder={itemDisplayName(kind, hardDeleteTarget)}
                />
              </label>
```

Disable the confirm button unless it matches:

```tsx
disabled={isHardDeleting || hardDeleteConfirmText.trim() !== itemDisplayName(kind, hardDeleteTarget)}
```

- [ ] **Step 7: Add monthly download confirmation modal**

In `AdminApplicationsPage.tsx`, add state:

```tsx
  const [downloadConfirmMonth, setDownloadConfirmMonth] = useState('');
```

Change the download button to open confirmation:

```tsx
onClick={() => {
  if (!downloadMonth) {
    setError('다운로드할 월을 선택해주세요.');
    return;
  }
  setDownloadConfirmMonth(downloadMonth);
}}
```

Render modal:

```tsx
      {downloadConfirmMonth ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="monthly-download-confirm-title">
          <div className="preview-modal compact-modal">
            <div className="table-toolbar borderless-panel">
              <strong id="monthly-download-confirm-title">월별 첨부 다운로드 확인</strong>
              <button className="icon-button" type="button" aria-label="닫기" onClick={() => setDownloadConfirmMonth('')}>×</button>
            </div>
            <p className="muted-copy">
              {downloadConfirmMonth} 월의 민감한 영수증 이미지가 ZIP 파일로 다운로드됩니다.
            </p>
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setDownloadConfirmMonth('')}>취소</button>
              <button
                className="primary-button"
                type="button"
                disabled={isDownloadingAttachments}
                onClick={() => void handleMonthlyAttachmentDownload(downloadConfirmMonth)}
              >
                다운로드 시작
              </button>
            </div>
          </div>
        </div>
      ) : null}
```

Change `handleMonthlyAttachmentDownload` to accept a month:

```tsx
  async function handleMonthlyAttachmentDownload(targetMonth = downloadMonth) {
    if (!targetMonth) {
      setError('다운로드할 월을 선택해주세요.');
      return;
    }
    ...
    const blob = await downloadMonthlyReceiptAttachments(targetMonth);
    ...
    link.download = `receipt-attachments-${targetMonth}.zip`;
    ...
    setMessage(`${targetMonth} 첨부파일 다운로드를 시작했습니다.`);
    setDownloadConfirmMonth('');
  }
```

- [ ] **Step 8: Run targeted tests**

Run:

```bash
cd frontend && npm run test -- AdminReferencePage.test.tsx AdminApplicationsPage.test.tsx
```

Expected: targeted tests pass.

## Task 7: Verification And Handoff

**Agent:** Verification/Docs Agent

**Files:**
- Create: `docs/handoffs/2026-06-29-task-28-ui-security-improvements.md`
- Modify: `docs/handoff-2026-06-03.md`

- [ ] **Step 1: Run frontend targeted tests**

Run:

```bash
cd frontend && npm run test -- AdminApplicationsPage.test.tsx ApplicationForm.test.tsx ApprovalsInboxPage.test.tsx AdminReferencePage.test.tsx
```

Expected: all targeted tests pass.

- [ ] **Step 2: Run frontend full test and build**

Run:

```bash
cd frontend && npm run test
cd frontend && npm run build
```

Expected: both commands pass.

- [ ] **Step 3: Run backend targeted tests**

Run:

```bash
cd backend && TMPDIR=/private/tmp GRADLE_USER_HOME=/Users/kyh/theieum/.gradle-home JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test --tests com.theieum.approval.auth.RoleAccessTest --tests com.theieum.approval.attachment.LocalFileStorageTest --tests com.theieum.approval.api.ApiAuthorizationTest --tests com.theieum.approval.calendar.CalendarEventServiceTest
```

Expected: all selected backend tests pass.

- [ ] **Step 4: Run backend full test if targeted tests pass**

Run:

```bash
cd backend && TMPDIR=/private/tmp GRADLE_USER_HOME=/Users/kyh/theieum/.gradle-home JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ./gradlew test
```

Expected: backend full test passes.

- [ ] **Step 5: Run static config and whitespace checks**

Run:

```bash
docker compose config
git diff --check
```

Expected: both commands pass. Do not run `docker compose down -v`.

- [ ] **Step 6: Browser verification**

Start the app only if no suitable local app is already running:

```bash
docker compose up --build -d postgres backend frontend
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

Expected: HTTP `200`.

Manual scenarios:

- Login as `admin / password`.
- Open `/admin/applications`, set download month, click `월별 첨부 다운로드`, confirm the warning dialog.
- Open `/admin/users`, change a user password with mismatched confirmation and confirm the error, then matched confirmation and confirm success.
- Open `/admin/users`, start editing roles and confirm the role summary appears.
- Open `/admin/positions`, open hard delete dialog and confirm delete button stays disabled until the target name is typed.
- Login as a manager account, open `/admin/applications`, click `신청서 10 상세` or an available detail link, confirm detail page is not redirected away.
- Login as an approver, open `/approvals`, click `승인`, confirm the approval dialog appears before the API action.
- Login as an applicant, open `/applications/new`, submit empty form, confirm field-specific guidance appears, then complete form and confirm submit confirmation dialog.

- [ ] **Step 7: Write handoff document**

Create `docs/handoffs/2026-06-29-task-28-ui-security-improvements.md` with:

```markdown
# Task 28 UI/UX 보안 개선 및 병렬 에이전트 운영 인수인계

작성일: 2026-06-29, Asia/Seoul
작업 경로: `/Users/kyh/theieum`
현재 브랜치: `main`
기준 커밋: Task 7 실행 시 `git rev-parse --short HEAD` 출력값을 기록한다.

## 재시작 프롬프트

Task 28 UI/UX 보안 개선 및 병렬 에이전트 운영 작업을 이어서 확인해주세요.
작업 경로는 `/Users/kyh/theieum`입니다.
먼저 `AGENTS.md`, `docs/handoff-2026-06-03.md`, `docs/superpowers/specs/2026-06-29-ui-security-improvements-design.md`, `docs/superpowers/plans/2026-06-29-ui-security-improvements.md`, 이 인수인계 문서를 확인해주세요.

## 변경 요약

- 매니저 전체 신청서 상세 접근 라우팅을 서버 권한과 맞췄다.
- 역할 정규화 helper를 추가해 `MANGER` alias와 대소문자/공백 처리를 통일했다.
- 첨부 파일 저장소 root 밖 read/delete를 차단했다.
- 신청서 작성 제출 전 필드별 안내와 제출 확인을 추가했다.
- 결재 승인 전 확인 모달을 추가했다.
- 관리자 위험 작업 확인 절차를 보강했다.
- 월별 첨부 ZIP 다운로드 확인 모달을 추가했다.

## 주요 변경 파일

`git diff --name-only` 출력 기준으로 코드, 테스트, 문서 파일을 구분해 적는다.

## 검증 명령과 결과

실행한 명령을 코드 블록으로 적고, 각 명령 아래에 `결과: PASS` 또는 실패 원인과 미해결 상태를 적는다.

## 남은 확인 사항

- 사용자 최종 검증에서 실제 운영 데이터 기준 문구와 확인 절차가 과하지 않은지 확인한다.
- 커밋/푸시는 사용자가 별도로 요청할 때만 진행한다.
```

- [ ] **Step 8: Update root handoff summary**

At the top of `docs/handoff-2026-06-03.md`, add a latest update section for Task 28 with the changed files, verification results, and handoff path.

- [ ] **Step 9: Final status check**

Run:

```bash
git status --short
git diff --check
```

Expected: only intended files are modified or added, and whitespace check passes.

## Self-Review

- Spec coverage: manager detail route alignment, application form guidance, approval confirmation, admin risk confirmation, monthly ZIP confirmation, role normalization, attachment root guard, verification, handoff, and agent-team reporting are all mapped to tasks.
- Blank-field scan: no `TBD`, `TODO`, or unresolved blank fields are used as implementation instructions. The handoff section tells the worker which command output to record instead of leaving blanks.
- Type consistency: new helper names are consistently `RoleAccess.hasRole`, `RoleAccess.hasAnyRole`, and `RoleAccess.normalize`. Frontend modal labels are consistently `신청서 제출 확인`, `승인 확인`, and `월별 첨부 다운로드 확인`.
