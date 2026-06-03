package com.theieum.approval.admin;

import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.theieum.approval.application.Application;
import com.theieum.approval.application.ApplicationRepository;
import com.theieum.approval.application.ApplicationService;
import com.theieum.approval.approval.ApprovalStepType;
import com.theieum.approval.auth.AuthenticatedUser;
import com.theieum.approval.notification.NotificationEventRepository;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private static final Set<String> ALLOWED_ROLES = Set.of("ADMIN", "MANAGER", "MANGER", "APPROVER", "APPLICANT");
    private static final Set<String> ALLOWED_ORGANIZATION_SCOPES = Set.of("APPLICANT_ORG");
    private static final Set<String> ALLOWED_SORT_POLICIES = Set.of("POSITION_ORDER", "INPUT_ORDER");

    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;
    private final ApplicationService applicationService;
    private final ApplicationRepository applicationRepository;
    private final NotificationEventRepository notificationEventRepository;

    public AdminController(
            JdbcTemplate jdbcTemplate,
            PasswordEncoder passwordEncoder,
            ApplicationService applicationService,
            ApplicationRepository applicationRepository,
            NotificationEventRepository notificationEventRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
        this.applicationService = applicationService;
        this.applicationRepository = applicationRepository;
        this.notificationEventRepository = notificationEventRepository;
    }

    @GetMapping("/users")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> users(@AuthenticationPrincipal AuthenticatedUser user) {
        requireManager(user);
        return jdbcTemplate.queryForList("""
                select u.id,
                       u.login_id,
                       u.name,
                       u.email,
                       u.organization_id,
                       o.name as organization_name,
                       u.position_id,
                       p.name as position_name,
                       u.roles,
                       u.active
                from users u
                join organizations o on o.id = u.organization_id
                join positions p on p.id = u.position_id
                order by u.id asc
                """);
    }

    @PostMapping("/users")
    @Transactional
    public Map<String, Object> createUser(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CreateUserRequest request) {
        requireAdmin(user);
        validateUserRequest(request);
        Long id = jdbcTemplate.queryForObject(
                """
                insert into users (
                    login_id,
                    external_subject,
                    password_hash,
                    name,
                    email,
                    organization_id,
                    position_id,
                    roles,
                    active
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                returning id
                """,
                Long.class,
                request.loginId,
                request.externalSubject,
                passwordEncoder.encode(request.password),
                request.name,
                request.email,
                request.organizationId,
                request.positionId,
                request.roles == null || request.roles.isBlank() ? "APPLICANT" : request.roles,
                request.active == null || request.active);
        return one("select id, login_id, name, email, organization_id, position_id, roles, active from users where id = ?", id);
    }

    @PutMapping("/users/{id}")
    @Transactional
    public Map<String, Object> updateUser(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id,
            @Valid @RequestBody UpdateUserRequest request) {
        requireAdmin(user);
        validateUserRequest(request);
        int updated = jdbcTemplate.update(
                """
                update users
                set login_id = ?,
                    external_subject = ?,
                    name = ?,
                    email = ?,
                    organization_id = ?,
                    position_id = ?,
                    roles = ?,
                    active = ?
                where id = ?
                """,
                request.loginId,
                request.externalSubject,
                request.name,
                request.email,
                request.organizationId,
                request.positionId,
                request.roles == null || request.roles.isBlank() ? "APPLICANT" : request.roles,
                request.active == null || request.active,
                id);
        requireUpdated(updated, "User not found: " + id);
        return userRow(id);
    }

    @PutMapping("/users/{id}/password")
    @Transactional
    public ResponseEntity<Void> updateUserPassword(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id,
            @Valid @RequestBody AdminPasswordChangeRequest request) {
        requireAdmin(user);
        int updated = jdbcTemplate.update(
                "update users set password_hash = ? where id = ?",
                passwordEncoder.encode(request.newPassword),
                id);
        requireUpdated(updated, "User not found: " + id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{id}")
    @Transactional
    public ResponseEntity<Void> deleteUser(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id) {
        requireAdmin(user);
        int updated = jdbcTemplate.update("update users set active = false where id = ?", id);
        requireUpdated(updated, "User not found: " + id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/organizations")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> organizations(@AuthenticationPrincipal AuthenticatedUser user) {
        requireManager(user);
        return jdbcTemplate.queryForList("""
                select id, name, parent_id, level_no, sort_order, active
                from organizations
                order by sort_order asc, id asc
                """);
    }

    @PostMapping("/organizations")
    @Transactional
    public Map<String, Object> createOrganization(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CreateOrganizationRequest request) {
        requireManager(user);
        if (request.parentId != null) {
            requireExists("organizations", request.parentId, "Parent organization not found: " + request.parentId);
        }
        Long id = jdbcTemplate.queryForObject(
                """
                insert into organizations (name, parent_id, level_no, sort_order, active)
                values (?, ?, ?, ?, ?)
                returning id
                """,
                Long.class,
                request.name,
                request.parentId,
                request.levelNo == null ? 1 : request.levelNo,
                request.sortOrder == null ? nextSortOrder("organizations") : request.sortOrder,
                request.active == null || request.active);
        return one("select id, name, parent_id, level_no, sort_order, active from organizations where id = ?", id);
    }

    @PutMapping("/organizations/{id}")
    @Transactional
    public Map<String, Object> updateOrganization(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id,
            @Valid @RequestBody CreateOrganizationRequest request) {
        requireManager(user);
        if (request.parentId != null) {
            if (request.parentId == id) {
                throw new IllegalArgumentException("Organization cannot be its own parent");
            }
            requireExists("organizations", request.parentId, "Parent organization not found: " + request.parentId);
        }
        int levelNo = request.levelNo == null ? organizationLevel(request.parentId) : request.levelNo;
        int updated = jdbcTemplate.update(
                """
                update organizations
                set name = ?,
                    parent_id = ?,
                    level_no = ?,
                    sort_order = ?,
                    active = ?
                where id = ?
                """,
                request.name,
                request.parentId,
                levelNo,
                request.sortOrder == null ? nextSortOrder("organizations") : request.sortOrder,
                request.active == null || request.active,
                id);
        requireUpdated(updated, "Organization not found: " + id);
        return one("select id, name, parent_id, level_no, sort_order, active from organizations where id = ?", id);
    }

    @DeleteMapping("/organizations/{id}")
    @Transactional
    public ResponseEntity<Void> deleteOrganization(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id) {
        requireManager(user);
        int updated = jdbcTemplate.update("update organizations set active = false where id = ?", id);
        requireUpdated(updated, "Organization not found: " + id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/positions")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> positions(@AuthenticationPrincipal AuthenticatedUser user) {
        requireManager(user);
        return jdbcTemplate.queryForList("""
                select id, name, rank_order, sort_order, active
                from positions
                order by sort_order asc, id asc
                """);
    }

    @PostMapping("/positions")
    @Transactional
    public Map<String, Object> createPosition(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CreatePositionRequest request) {
        requireManager(user);
        Long id = jdbcTemplate.queryForObject(
                """
                insert into positions (name, rank_order, sort_order, active)
                values (?, ?, ?, ?)
                returning id
                """,
                Long.class,
                request.name,
                request.rankOrder == null ? nextSortOrder("positions") : request.rankOrder,
                request.sortOrder == null ? nextSortOrder("positions") : request.sortOrder,
                request.active == null || request.active);
        return one("select id, name, rank_order, sort_order, active from positions where id = ?", id);
    }

    @PutMapping("/positions/{id}")
    @Transactional
    public Map<String, Object> updatePosition(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id,
            @Valid @RequestBody CreatePositionRequest request) {
        requireManager(user);
        int updated = jdbcTemplate.update(
                """
                update positions
                set name = ?,
                    rank_order = ?,
                    sort_order = ?,
                    active = ?
                where id = ?
                """,
                request.name,
                request.rankOrder == null ? nextSortOrder("positions") : request.rankOrder,
                request.sortOrder == null ? nextSortOrder("positions") : request.sortOrder,
                request.active == null || request.active,
                id);
        requireUpdated(updated, "Position not found: " + id);
        return one("select id, name, rank_order, sort_order, active from positions where id = ?", id);
    }

    @DeleteMapping("/positions/{id}")
    @Transactional
    public ResponseEntity<Void> deletePosition(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id) {
        requireManager(user);
        int updated = jdbcTemplate.update("update positions set active = false where id = ?", id);
        requireUpdated(updated, "Position not found: " + id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/approval-lines")
    @Transactional(readOnly = true)
    public List<ApprovalLineResponse> approvalLines(@AuthenticationPrincipal AuthenticatedUser user) {
        requireManager(user);
        return jdbcTemplate.queryForList("""
                select id, approval_type_id, name, active
                from approval_lines
                order by id asc
                """).stream()
                .map(row -> new ApprovalLineResponse(
                        ((Number) row.get("id")).longValue(),
                        ((Number) row.get("approval_type_id")).longValue(),
                        (String) row.get("name"),
                        (Boolean) row.get("active"),
                        approvalLineSteps(((Number) row.get("id")).longValue())))
                .toList();
    }

    @PostMapping("/approval-lines")
    @Transactional
    public ApprovalLineResponse createApprovalLine(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CreateApprovalLineRequest request) {
        requireManager(user);
        validateApprovalLineRequest(request);
        Long id = jdbcTemplate.queryForObject(
                """
                insert into approval_lines (approval_type_id, name, active)
                values (?, ?, ?)
                returning id
                """,
                Long.class,
                request.approvalTypeId,
                request.name,
                request.active == null || request.active);
        if (request.steps != null) {
            for (CreateApprovalLineStepRequest step : request.steps) {
                jdbcTemplate.update(
                        """
                        insert into approval_line_steps (
                            approval_line_id,
                            step_order,
                            step_type,
                            organization_scope,
                            position_id,
                            direct_user_id,
                            sort_policy
                        ) values (?, ?, ?, ?, ?, ?, ?)
                        """,
                        id,
                        step.stepOrder,
                        step.stepType,
                        step.organizationScope,
                        step.positionId,
                        step.directUserId,
                        step.sortPolicy == null || step.sortPolicy.isBlank() ? "POSITION_ORDER" : step.sortPolicy);
            }
        }
        return approvalLines(user).stream()
                .filter(line -> line.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR));
    }

    @PutMapping("/approval-lines/{id}")
    @Transactional
    public ApprovalLineResponse updateApprovalLine(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id,
            @Valid @RequestBody CreateApprovalLineRequest request) {
        requireManager(user);
        validateApprovalLineRequest(request);
        int updated = jdbcTemplate.update(
                """
                update approval_lines
                set approval_type_id = ?,
                    name = ?,
                    active = ?
                where id = ?
                """,
                request.approvalTypeId,
                request.name,
                request.active == null || request.active,
                id);
        requireUpdated(updated, "Approval line not found: " + id);
        jdbcTemplate.update("delete from approval_line_steps where approval_line_id = ?", id);
        for (CreateApprovalLineStepRequest step : request.steps) {
            jdbcTemplate.update(
                    """
                    insert into approval_line_steps (
                        approval_line_id,
                        step_order,
                        step_type,
                        organization_scope,
                        position_id,
                        direct_user_id,
                        sort_policy
                    ) values (?, ?, ?, ?, ?, ?, ?)
                    """,
                    id,
                    step.stepOrder,
                    step.stepType,
                    step.organizationScope,
                    step.positionId,
                    step.directUserId,
                    step.sortPolicy == null || step.sortPolicy.isBlank() ? "POSITION_ORDER" : step.sortPolicy);
        }
        return approvalLines(user).stream()
                .filter(line -> line.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR));
    }

    @DeleteMapping("/approval-lines/{id}")
    @Transactional
    public ResponseEntity<Void> deleteApprovalLine(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id) {
        requireManager(user);
        int updated = jdbcTemplate.update("update approval_lines set active = false where id = ?", id);
        requireUpdated(updated, "Approval line not found: " + id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/approval-org-exceptions")
    @Transactional(readOnly = true)
    public List<ApprovalOrgExceptionResponse> approvalOrgExceptions(@AuthenticationPrincipal AuthenticatedUser user) {
        requireManager(user);
        return approvalOrgExceptionRows();
    }

    @PostMapping("/approval-org-exceptions")
    @Transactional
    public ApprovalOrgExceptionResponse createApprovalOrgException(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CreateApprovalOrgExceptionRequest request) {
        requireManager(user);
        validateApprovalOrgExceptionRequest(request);
        Long id = jdbcTemplate.queryForObject(
                """
                insert into approval_org_exceptions (
                    approval_type_id,
                    organization_id,
                    approver_user_id,
                    step_order,
                    active
                ) values (?, ?, ?, ?, ?)
                returning id
                """,
                Long.class,
                request.approvalTypeId,
                request.organizationId,
                request.approverUserId,
                request.stepOrder,
                request.active == null || request.active);
        return approvalOrgExceptionRows().stream()
                .filter(exception -> exception.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR));
    }

    @PutMapping("/approval-org-exceptions/{id}")
    @Transactional
    public ApprovalOrgExceptionResponse updateApprovalOrgException(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id,
            @Valid @RequestBody CreateApprovalOrgExceptionRequest request) {
        requireManager(user);
        validateApprovalOrgExceptionRequest(request);
        int updated = jdbcTemplate.update(
                """
                update approval_org_exceptions
                set approval_type_id = ?,
                    organization_id = ?,
                    approver_user_id = ?,
                    step_order = ?,
                    active = ?
                where id = ?
                """,
                request.approvalTypeId,
                request.organizationId,
                request.approverUserId,
                request.stepOrder,
                request.active == null || request.active,
                id);
        requireUpdated(updated, "Approval organization exception not found: " + id);
        return approvalOrgExceptionRows().stream()
                .filter(exception -> exception.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR));
    }

    @DeleteMapping("/approval-org-exceptions/{id}")
    @Transactional
    public ResponseEntity<Void> deleteApprovalOrgException(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long id) {
        requireManager(user);
        int updated = jdbcTemplate.update("update approval_org_exceptions set active = false where id = ?", id);
        requireUpdated(updated, "Approval organization exception not found: " + id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/approvals/steps/{stepId}/approve")
    @Transactional
    public AdminApprovalResponse adminApprove(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable long stepId,
            @Valid @RequestBody AdminApprovalRequest request) {
        requireManager(user);
        return AdminApprovalResponse.from(applicationService.adminApprove(stepId, user.id(), request.reason));
    }

    @GetMapping("/applications")
    @Transactional(readOnly = true)
    public List<AdminApplicationResponse> applications(@AuthenticationPrincipal AuthenticatedUser user) {
        requireManager(user);
        return applicationRepository.findAll()
                .stream()
                .map(AdminApplicationResponse::from)
                .toList();
    }

    @GetMapping("/notification-events")
    @Transactional(readOnly = true)
    public List<AdminNotificationEventResponse> notificationEvents(@AuthenticationPrincipal AuthenticatedUser user) {
        requireManager(user);
        return notificationEventRepository.findAll()
                .stream()
                .map(AdminNotificationEventResponse::from)
                .toList();
    }

    private List<ApprovalLineStepResponse> approvalLineSteps(long approvalLineId) {
        return jdbcTemplate.queryForList(
                """
                select id, step_order, step_type, organization_scope, position_id, direct_user_id, sort_policy
                from approval_line_steps
                where approval_line_id = ?
                order by step_order asc
                """,
                approvalLineId).stream()
                .map(row -> new ApprovalLineStepResponse(
                        ((Number) row.get("id")).longValue(),
                        ((Number) row.get("step_order")).intValue(),
                        (String) row.get("step_type"),
                        (String) row.get("organization_scope"),
                        toLong(row.get("position_id")),
                        toLong(row.get("direct_user_id")),
                        (String) row.get("sort_policy")))
                .toList();
    }

    private List<ApprovalOrgExceptionResponse> approvalOrgExceptionRows() {
        return jdbcTemplate.queryForList("""
                select e.id,
                       e.approval_type_id,
                       e.organization_id,
                       o.name as organization_name,
                       e.approver_user_id,
                       u.name as approver_name,
                       e.step_order,
                       e.active
                from approval_org_exceptions e
                join organizations o on o.id = e.organization_id
                join users u on u.id = e.approver_user_id
                order by e.id asc
                """).stream()
                .map(row -> new ApprovalOrgExceptionResponse(
                        ((Number) row.get("id")).longValue(),
                        ((Number) row.get("approval_type_id")).longValue(),
                        ((Number) row.get("organization_id")).longValue(),
                        (String) row.get("organization_name"),
                        ((Number) row.get("approver_user_id")).longValue(),
                        (String) row.get("approver_name"),
                        ((Number) row.get("step_order")).intValue(),
                        (Boolean) row.get("active")))
                .toList();
    }

    private Long toLong(Object value) {
        return value == null ? null : ((Number) value).longValue();
    }

    private int nextSortOrder(String tableName) {
        Integer maxSortOrder = jdbcTemplate.queryForObject(
                "select coalesce(max(sort_order), 0) from " + tableName,
                Integer.class);
        return maxSortOrder + 10;
    }

    private int organizationLevel(Long parentId) {
        if (parentId == null) {
            return 1;
        }
        Integer parentLevel = jdbcTemplate.queryForObject(
                "select level_no from organizations where id = ?",
                Integer.class,
                parentId);
        return parentLevel + 1;
    }

    private void validateUserRequest(CreateUserRequest request) {
        requireExists("organizations", request.organizationId, "Organization not found: " + request.organizationId);
        requireExists("positions", request.positionId, "Position not found: " + request.positionId);
        validateRoles(request.roles == null || request.roles.isBlank() ? "APPLICANT" : request.roles);
    }

    private void validateUserRequest(UpdateUserRequest request) {
        requireExists("organizations", request.organizationId, "Organization not found: " + request.organizationId);
        requireExists("positions", request.positionId, "Position not found: " + request.positionId);
        validateRoles(request.roles == null || request.roles.isBlank() ? "APPLICANT" : request.roles);
    }

    private void validateRoles(String roles) {
        for (String role : roles.split(",")) {
            String normalized = role.trim();
            if (normalized.isEmpty() || !ALLOWED_ROLES.contains(normalized)) {
                throw new IllegalArgumentException("Unsupported role: " + role);
            }
        }
    }

    private void validateApprovalLineRequest(CreateApprovalLineRequest request) {
        requireExists("approval_types", request.approvalTypeId, "Approval type not found: " + request.approvalTypeId);
        if (request.steps == null || request.steps.isEmpty()) {
            throw new IllegalArgumentException("Approval line must have at least one step");
        }
        for (CreateApprovalLineStepRequest step : request.steps) {
            validateApprovalLineStep(step);
        }
    }

    private void validateApprovalLineStep(CreateApprovalLineStepRequest step) {
        ApprovalStepType stepType = parseStepType(step.stepType);
        String sortPolicy = step.sortPolicy == null || step.sortPolicy.isBlank() ? "POSITION_ORDER" : step.sortPolicy;
        if (!ALLOWED_SORT_POLICIES.contains(sortPolicy)) {
            throw new IllegalArgumentException("Unsupported sort policy: " + step.sortPolicy);
        }
        if (step.organizationScope != null && !step.organizationScope.isBlank()
                && !ALLOWED_ORGANIZATION_SCOPES.contains(step.organizationScope)) {
            throw new IllegalArgumentException("Unsupported organization scope: " + step.organizationScope);
        }
        if (stepType == ApprovalStepType.DIRECT_USER) {
            if (step.directUserId == null) {
                throw new IllegalArgumentException("DIRECT_USER step requires directUserId");
            }
            requireActiveApprover(step.directUserId);
            if (step.positionId != null) {
                throw new IllegalArgumentException("DIRECT_USER step must not include positionId");
            }
        } else if (stepType == ApprovalStepType.ORG_POSITION) {
            if (step.positionId == null) {
                throw new IllegalArgumentException("ORG_POSITION step requires positionId");
            }
            requireExists("positions", step.positionId, "Position not found: " + step.positionId);
            if (step.directUserId != null) {
                throw new IllegalArgumentException("ORG_POSITION step must not include directUserId");
            }
        }
    }

    private void validateApprovalOrgExceptionRequest(CreateApprovalOrgExceptionRequest request) {
        requireExists("approval_types", request.approvalTypeId, "Approval type not found: " + request.approvalTypeId);
        requireExists("organizations", request.organizationId, "Organization not found: " + request.organizationId);
        requireActiveApprover(request.approverUserId);
    }

    private ApprovalStepType parseStepType(String value) {
        try {
            return ApprovalStepType.valueOf(value);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Unsupported approval step type: " + value, exception);
        }
    }

    private void requireActiveApprover(Long userId) {
        Boolean exists = jdbcTemplate.queryForObject(
                """
                select exists (
                    select 1
                    from users
                    where id = ?
                      and active = true
                      and roles like '%APPROVER%'
                )
                """,
                Boolean.class,
                userId);
        if (!Boolean.TRUE.equals(exists)) {
            throw new IllegalArgumentException("Active approver not found: " + userId);
        }
    }

    private void requireExists(String tableName, Long id, String message) {
        Boolean exists = jdbcTemplate.queryForObject(
                "select exists (select 1 from " + tableName + " where id = ?)",
                Boolean.class,
                id);
        if (!Boolean.TRUE.equals(exists)) {
            throw new IllegalArgumentException(message);
        }
    }

    private Map<String, Object> one(String sql, Object id) {
        return jdbcTemplate.queryForMap(sql, id);
    }

    private Map<String, Object> userRow(long id) {
        return one("select id, login_id, name, email, organization_id, position_id, roles, active from users where id = ?", id);
    }

    private void requireUpdated(int updated, String message) {
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, message);
        }
    }

    private void requireAdmin(AuthenticatedUser user) {
        if (!hasRole(user, "ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
    }

    private void requireManager(AuthenticatedUser user) {
        if (!hasRole(user, "ADMIN") && !hasRole(user, "MANAGER")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
    }

    private boolean hasRole(AuthenticatedUser user, String role) {
        if (user == null) {
            return false;
        }
        return user.roles().stream()
                .map(value -> value.trim().toUpperCase())
                .anyMatch(value -> value.equals(role) || (role.equals("MANAGER") && value.equals("MANGER")));
    }

    public record CreateUserRequest(
            @NotBlank String loginId,
            String externalSubject,
            @NotBlank @Size(min = 8) String password,
            @NotBlank String name,
            @NotBlank @Email String email,
            @NotNull Long organizationId,
            @NotNull Long positionId,
            String roles,
            Boolean active) {
    }

    public record UpdateUserRequest(
            @NotBlank String loginId,
            String externalSubject,
            @NotBlank String name,
            @NotBlank @Email String email,
            @NotNull Long organizationId,
            @NotNull Long positionId,
            String roles,
            Boolean active) {
    }

    public record CreateOrganizationRequest(
            @NotBlank String name,
            Long parentId,
            @Positive Integer levelNo,
            @Positive Integer sortOrder,
            Boolean active) {
    }

    public record CreatePositionRequest(
            @NotBlank String name,
            @Positive Integer rankOrder,
            @Positive Integer sortOrder,
            Boolean active) {
    }

    public record CreateApprovalLineRequest(
            @NotNull Long approvalTypeId,
            @NotBlank String name,
            Boolean active,
            List<@Valid CreateApprovalLineStepRequest> steps) {
    }

    public record CreateApprovalLineStepRequest(
            @Positive int stepOrder,
            @NotBlank String stepType,
            String organizationScope,
            Long positionId,
            Long directUserId,
            String sortPolicy) {
    }

    public record CreateApprovalOrgExceptionRequest(
            @NotNull Long approvalTypeId,
            @NotNull Long organizationId,
            @NotNull Long approverUserId,
            @Positive int stepOrder,
            Boolean active) {
    }

    public record AdminPasswordChangeRequest(@NotBlank @Size(min = 8) String newPassword) {
    }

    public record AdminApprovalRequest(@NotBlank String reason) {
    }

    public record ApprovalLineResponse(
            Long id,
            Long approvalTypeId,
            String name,
            boolean active,
            List<ApprovalLineStepResponse> steps) {
    }

    public record ApprovalLineStepResponse(
            Long id,
            int stepOrder,
            String stepType,
            String organizationScope,
            Long positionId,
            Long directUserId,
            String sortPolicy) {
    }

    public record ApprovalOrgExceptionResponse(
            Long id,
            Long approvalTypeId,
            Long organizationId,
            String organizationName,
            Long approverUserId,
            String approverName,
            int stepOrder,
            boolean active) {
    }

    public record AdminApprovalResponse(Long id, String status) {

        static AdminApprovalResponse from(Application application) {
            return new AdminApprovalResponse(application.getId(), application.getStatus().name());
        }
    }

    public record AdminApplicationResponse(
            Long id,
            Long applicantId,
            String applicantName,
            String status,
            String vendor) {

        static AdminApplicationResponse from(Application application) {
            return new AdminApplicationResponse(
                    application.getId(),
                    application.getApplicant().getId(),
                    application.getApplicant().getName(),
                    application.getStatus().name(),
                    application.getVendor());
        }
    }

    public record AdminNotificationEventResponse(
            Long id,
            Long recipientId,
            Long applicationId,
            String notificationType,
            String channel,
            String status,
            boolean read) {

        static AdminNotificationEventResponse from(com.theieum.approval.notification.NotificationEvent event) {
            return new AdminNotificationEventResponse(
                    event.getId(),
                    event.getRecipient().getId(),
                    event.getApplication() == null ? null : event.getApplication().getId(),
                    event.getNotificationType().name(),
                    event.getChannel().name(),
                    event.getStatus().name(),
                    event.isReadFlag());
        }
    }
}
