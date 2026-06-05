package com.theieum.approval.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.theieum.approval.application.Application;
import com.theieum.approval.application.ApplicationService;
import com.theieum.approval.common.TestDatabaseHarness;

@SpringBootTest(properties = {
        "spring.datasource.url=" + TestDatabaseHarness.JDBC_URL,
        "spring.datasource.username=" + TestDatabaseHarness.USERNAME,
        "spring.datasource.password=" + TestDatabaseHarness.PASSWORD,
        "spring.flyway.clean-disabled=false",
        "spring.flyway.locations=classpath:db/migration,classpath:db/seed",
        "app.security.jwt-secret=test-jwt-secret-that-is-long-enough-for-hmac",
        "app.file-storage.root-path=/private/tmp/theieum-approval-test",
        "app.attachments.max-image-bytes=8"
})
@AutoConfigureMockMvc
class ApiAuthorizationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationService applicationService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void applicantCannotApproveOthersPendingStep() throws Exception {
        long applicationId = submitApplication(3L, 1L);
        long stepId = stepId(applicationId, 1);
        String applicantToken = login("employee01");

        mockMvc.perform(post("/api/approvals/steps/{stepId}/approve", stepId)
                        .header("Authorization", bearer(applicantToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "comment": "제가 승인할 수 없습니다"
                                }
                                """))
                .andExpect(status().isForbidden());

        assertThat(stepStatus(applicationId, 1)).isEqualTo("PENDING");
    }

    @Test
    void approverCanOnlyApproveAssignedStep() throws Exception {
        long applicationId = submitApplication(3L, 1L);
        long stepId = stepId(applicationId, 1);
        String wrongApproverToken = login("approver01");
        String assignedApproverToken = login("lead-dev");

        mockMvc.perform(post("/api/approvals/steps/{stepId}/approve", stepId)
                        .header("Authorization", bearer(wrongApproverToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "comment": "배정되지 않은 결재자"
                                }
                                """))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/approvals/steps/{stepId}/approve", stepId)
                        .header("Authorization", bearer(assignedApproverToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "comment": "승인합니다"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(applicationId))
                .andExpect(jsonPath("$.status").value("APPROVED"));

        assertThat(stepStatus(applicationId, 1)).isEqualTo("APPROVED");
    }

    @Test
    void adminCanUseAdminOverride() throws Exception {
        long applicationId = submitApplication(3L, 1L);
        long stepId = stepId(applicationId, 1);
        String adminToken = login("admin");

        mockMvc.perform(post("/api/admin/approvals/steps/{stepId}/approve", stepId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "reason": "결재자 부재로 관리자 예외 승인"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(applicationId));

        assertThat(stepStatus(applicationId, 1)).isEqualTo("ADMIN_APPROVED");
        assertThat(historyAdminReason(applicationId))
                .isEqualTo("결재자 부재로 관리자 예외 승인");
    }

    @Test
    void applicationDetailIncludesApprovalAuditHistories() throws Exception {
        long applicationId = submitApplication(3L, 1L);
        long stepId = stepId(applicationId, 1);
        String adminToken = login("admin");
        String applicantToken = login("employee01");

        mockMvc.perform(post("/api/admin/approvals/steps/{stepId}/approve", stepId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "reason": "결재자 부재로 관리자 예외 승인"
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/applications/{id}", applicationId)
                        .header("Authorization", bearer(applicantToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.approvalHistories[0].stepOrder").value(1))
                .andExpect(jsonPath("$.approvalHistories[0].action").value("ADMIN_APPROVED"))
                .andExpect(jsonPath("$.approvalHistories[0].originalApprover.name").value("개발팀장"))
                .andExpect(jsonPath("$.approvalHistories[0].actor.name").value("관리자"))
                .andExpect(jsonPath("$.approvalHistories[0].adminOverride").value(true))
                .andExpect(jsonPath("$.approvalHistories[0].adminReason").value("결재자 부재로 관리자 예외 승인"));
    }

    @Test
    void applicantCanReadOwnApplicationOnly() throws Exception {
        long ownApplicationId = submitApplication(3L, 1L);
        long othersApplicationId = submitApplication(4L, 1L);
        String applicantToken = login("employee01");

        mockMvc.perform(get("/api/applications/{id}", ownApplicationId)
                        .header("Authorization", bearer(applicantToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(ownApplicationId))
                .andExpect(jsonPath("$.applicant.id").value(3));

        mockMvc.perform(get("/api/applications/{id}", othersApplicationId)
                        .header("Authorization", bearer(applicantToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void approverInboxShowsOnlyCurrentActionableSteps() throws Exception {
        long applicationId = submitApplication(9L, 1L);
        String firstApproverToken = login("approver01");
        String nextApproverToken = login("lead-sales");

        mockMvc.perform(get("/api/approvals/inbox")
                        .header("Authorization", bearer(nextApproverToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        mockMvc.perform(post("/api/approvals/steps/{stepId}/approve", stepId(applicationId, 1))
                        .header("Authorization", bearer(firstApproverToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "comment": "1차 승인"
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/approvals/inbox")
                        .header("Authorization", bearer(nextApproverToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].stepId").value(stepId(applicationId, 2)));
    }

    @Test
    void rejectedApplicationDoesNotExposeFutureSteps() throws Exception {
        long applicationId = submitApplication(9L, 1L);
        String firstApproverToken = login("approver01");
        String nextApproverToken = login("lead-sales");

        mockMvc.perform(post("/api/approvals/steps/{stepId}/reject", stepId(applicationId, 1))
                        .header("Authorization", bearer(firstApproverToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "comment": "영수증 정보가 부족합니다"
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/approvals/inbox")
                        .header("Authorization", bearer(nextApproverToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        mockMvc.perform(get("/api/applications/{id}", applicationId)
                        .header("Authorization", bearer(nextApproverToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void receiptAttachmentContentUsesApplicationReadPermission() throws Exception {
        long applicationId = submitApplication(9L, 1L);
        long attachmentId = attachmentId(applicationId);
        String applicantToken = login("employee07");
        String currentApproverToken = login("approver01");
        String futureApproverToken = login("lead-sales");
        String otherApplicantToken = login("employee01");
        String adminToken = login("admin");

        mockMvc.perform(get("/api/applications/{applicationId}/attachments/{attachmentId}/content",
                        applicationId,
                        attachmentId)
                        .header("Authorization", bearer(applicantToken)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentType()).isEqualTo("image/png"))
                .andExpect(result -> assertThat(result.getResponse().getContentAsByteArray()).isEqualTo(pngBytes()));

        mockMvc.perform(get("/api/applications/{applicationId}/attachments/{attachmentId}/content",
                        applicationId,
                        attachmentId)
                        .header("Authorization", bearer(currentApproverToken)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/applications/{applicationId}/attachments/{attachmentId}/content",
                        applicationId,
                        attachmentId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/applications/{applicationId}/attachments/{attachmentId}/content",
                        applicationId,
                        attachmentId)
                        .header("Authorization", bearer(futureApproverToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/applications/{applicationId}/attachments/{attachmentId}/content",
                        applicationId,
                        attachmentId)
                        .header("Authorization", bearer(otherApplicantToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void futureApproverCanReadApplicationAndAttachmentOnlyAfterTheirTurnStarts() throws Exception {
        long applicationId = submitApplication(9L, 1L);
        long attachmentId = attachmentId(applicationId);
        String currentApproverToken = login("approver01");
        String futureApproverToken = login("lead-sales");

        mockMvc.perform(get("/api/applications/{id}", applicationId)
                        .header("Authorization", bearer(currentApproverToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(applicationId));

        mockMvc.perform(get("/api/applications/{id}", applicationId)
                        .header("Authorization", bearer(futureApproverToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/applications/{applicationId}/attachments/{attachmentId}/content",
                        applicationId,
                        attachmentId)
                        .header("Authorization", bearer(futureApproverToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/approvals/steps/{stepId}/approve", stepId(applicationId, 1))
                        .header("Authorization", bearer(currentApproverToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "comment": "1차 승인"
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/applications/{id}", applicationId)
                        .header("Authorization", bearer(futureApproverToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(applicationId));

        mockMvc.perform(get("/api/applications/{applicationId}/attachments/{attachmentId}/content",
                        applicationId,
                        attachmentId)
                        .header("Authorization", bearer(futureApproverToken)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentAsByteArray()).isEqualTo(pngBytes()));

        mockMvc.perform(post("/api/approvals/steps/{stepId}/approve", stepId(applicationId, 2))
                        .header("Authorization", bearer(futureApproverToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "comment": "2차 승인"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_APPROVAL"));
    }

    @Test
    void notificationReadCanOnlyBeMarkedByRecipient() throws Exception {
        long applicationId = submitApplication(3L, 1L);
        long notificationId = notificationId(applicationId, 18L);
        String applicantToken = login("employee01");
        String approverToken = login("lead-dev");

        mockMvc.perform(patch("/api/notifications/{id}/read", notificationId)
                        .header("Authorization", bearer(applicantToken)))
                .andExpect(status().isForbidden());

        assertThat(notificationReadFlag(notificationId)).isFalse();

        mockMvc.perform(patch("/api/notifications/{id}/read", notificationId)
                        .header("Authorization", bearer(approverToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(notificationId))
                .andExpect(jsonPath("$.read").value(true));

        assertThat(notificationReadFlag(notificationId)).isTrue();
    }

    @Test
    void approvalActionReturnsFrontendFriendlyStatusCodes() throws Exception {
        long applicationId = submitApplication(3L, 1L);
        String applicantToken = login("employee01");
        String approverToken = login("approver01");

        mockMvc.perform(post("/api/approvals/steps/{stepId}/approve", 999_999L)
                        .header("Authorization", bearer(approverToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "comment": "없는 단계"
                                }
                                """))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/applications/{id}/submit", applicationId)
                        .header("Authorization", bearer(applicantToken)))
                .andExpect(status().isConflict());
    }

    @Test
    void adminApprovalLineRejectsInvalidStepConfiguration() throws Exception {
        String adminToken = login("admin");
        int beforeCount = approvalLineStepCount();

        mockMvc.perform(post("/api/admin/approval-lines")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "approvalTypeId": 1,
                                  "name": "잘못된 결재선",
                                  "steps": [
                                    {
                                      "stepOrder": 1,
                                      "stepType": "DIRECT_USER",
                                      "sortPolicy": "POSITION_ORDER"
                                    }
                                  ]
                                }
                                """))
                .andExpect(status().isBadRequest());

        assertThat(approvalLineStepCount()).isEqualTo(beforeCount);
    }

    @Test
    void adminCanManageOrganizationApprovalExceptions() throws Exception {
        String adminToken = login("admin");
        String applicantToken = login("employee01");
        int beforeCount = approvalOrgExceptionCount();

        mockMvc.perform(get("/api/admin/approval-org-exceptions")
                        .header("Authorization", bearer(applicantToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/approval-org-exceptions")
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].organizationName").value("개발팀"))
                .andExpect(jsonPath("$[0].approverName").value("개발팀장"));

        mockMvc.perform(post("/api/admin/approval-org-exceptions")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "approvalTypeId": 1,
                                  "organizationId": 4,
                                  "approverUserId": 19,
                                  "stepOrder": 1,
                                  "active": false
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organizationName").value("영업팀"))
                .andExpect(jsonPath("$.approverName").value("영업팀장"))
                .andExpect(jsonPath("$.active").value(false));

        assertThat(approvalOrgExceptionCount()).isEqualTo(beforeCount + 1);
    }

    @Test
    void managerCanManageNonUserAdminReferencesButApplicantsCannotAccessThem() throws Exception {
        String applicantToken = login("employee01");
        long managerId = createRoleTestUser("reference-manager", "MANAGER,APPLICANT");
        String managerToken = login("reference-manager");

        mockMvc.perform(get("/api/admin/approval-lines")
                        .header("Authorization", bearer(applicantToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/approval-lines")
                        .header("Authorization", bearer(managerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("영수증 첨부 신청 기본 결재선"));

        mockMvc.perform(put("/api/admin/positions/1")
                        .header("Authorization", bearer(applicantToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "수정된 사원",
                                  "rankOrder": 11,
                                  "sortOrder": 11,
                                  "active": true
                                }
                                """))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/admin/positions/1")
                        .header("Authorization", bearer(managerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "수정된 사원",
                                  "rankOrder": 11,
                                  "sortOrder": 11,
                                  "active": false
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("수정된 사원"))
                .andExpect(jsonPath("$.rank_order").value(11))
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(delete("/api/admin/positions/1")
                        .header("Authorization", bearer(managerToken)))
                .andExpect(status().isNoContent());

        assertThat(activeFlag("positions", 1L)).isFalse();
        assertThat(managerId).isPositive();
    }

    @Test
    void managerCanReadUsersButOnlyAdminCanMutateUsersAndPasswords() throws Exception {
        long managerId = createRoleTestUser("user-manager", "MANAGER,APPLICANT");
        String managerToken = login("user-manager");
        String adminToken = login("admin");

        mockMvc.perform(get("/api/admin/users")
                        .header("Authorization", bearer(managerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].login_id").exists());

        mockMvc.perform(put("/api/admin/users/{id}", managerId)
                        .header("Authorization", bearer(managerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "loginId": "user-manager",
                                  "name": "수정 시도",
                                  "email": "user-manager@theieum.local",
                                  "organizationId": 3,
                                  "positionId": 1,
                                  "roles": "MANAGER,APPLICANT",
                                  "active": true
                                }
                                """))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/admin/users/{id}/password", managerId)
                        .header("Authorization", bearer(managerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "newPassword": "changed-password"
                                }
                                """))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/admin/users/{id}", managerId)
                        .header("Authorization", bearer(managerToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/admin/users/{id}/password", managerId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "newPassword": "changed-password"
                                }
                                """))
                .andExpect(status().isNoContent());
    }

    @Test
    void allLoggedInUsersCanListCalendarEvents() throws Exception {
        String applicantToken = login("employee01");

        mockMvc.perform(get("/api/calendar/events")
                        .header("Authorization", bearer(applicantToken))
                        .param("from", "2026-06-01T00:00:00+09:00")
                        .param("to", "2026-07-01T00:00:00+09:00"))
                .andExpect(status().isOk());
    }

    @Test
    void applicantCannotManageCalendarEvents() throws Exception {
        String applicantToken = login("employee01");

        mockMvc.perform(post("/api/calendar/events")
                        .header("Authorization", bearer(applicantToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(calendarEventJson()))
                .andExpect(status().isForbidden());
    }

    @Test
    void managerCanCreateUpdateAndDeleteCalendarEvent() throws Exception {
        createRoleTestUser("calendar-manager", "MANAGER,APPLICANT");
        String managerToken = login("calendar-manager");

        String response = mockMvc.perform(post("/api/calendar/events")
                        .header("Authorization", bearer(managerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(calendarEventJson()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("월간 마감"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        long eventId = objectMapper.readTree(response).path("id").asLong();

        mockMvc.perform(put("/api/calendar/events/{id}", eventId)
                        .header("Authorization", bearer(managerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "수정된 일정",
                                  "description": "설명 수정",
                                  "location": "회의실 A",
                                  "startAt": "2026-06-11T09:00:00+09:00",
                                  "endAt": "2026-06-11T10:00:00+09:00",
                                  "allDay": false
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("수정된 일정"));

        mockMvc.perform(delete("/api/calendar/events/{id}", eventId)
                        .header("Authorization", bearer(managerToken)))
                .andExpect(status().isNoContent());
    }

    @Test
    void adminReferenceHardDeleteEndpointsRequireAdmin() throws Exception {
        long managerId = createRoleTestUser("hard-delete-manager", "MANAGER,APPLICANT");
        String managerToken = login("hard-delete-manager");

        mockMvc.perform(delete("/api/admin/users/{id}/hard-delete", managerId)
                        .header("Authorization", bearer(managerToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/admin/organizations/{id}/hard-delete", 3L)
                        .header("Authorization", bearer(managerToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/admin/positions/{id}/hard-delete", 1L)
                        .header("Authorization", bearer(managerToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/admin/approval-lines/{id}/hard-delete", 1L)
                        .header("Authorization", bearer(managerToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/admin/approval-org-exceptions/{id}/hard-delete", 1L)
                        .header("Authorization", bearer(managerToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminCanHardDeleteUnusedAdminReferences() throws Exception {
        String adminToken = login("admin");
        long userId = createRoleTestUser("hard-delete-user", "APPLICANT");
        long organizationId = jdbcTemplate.queryForObject("""
                insert into organizations (name, parent_id, level_no, sort_order, active)
                values ('완전 삭제 조직', null, 1, 901, true)
                returning id
                """, Long.class);
        long positionId = jdbcTemplate.queryForObject("""
                insert into positions (name, rank_order, sort_order, active)
                values ('완전 삭제 직위', 901, 901, true)
                returning id
                """, Long.class);
        long approvalLineId = jdbcTemplate.queryForObject("""
                insert into approval_lines (approval_type_id, name, active)
                values (1, '완전 삭제 결재선', true)
                returning id
                """, Long.class);
        jdbcTemplate.update("""
                insert into approval_line_steps (
                    approval_line_id, step_order, step_type, direct_user_id, sort_policy
                ) values (?, 1, 'DIRECT_USER', 2, 'POSITION_ORDER')
                """, approvalLineId);
        long exceptionId = jdbcTemplate.queryForObject("""
                insert into approval_org_exceptions (
                    approval_type_id, organization_id, approver_user_id, step_order, active
                ) values (1, 4, 19, 1, true)
                returning id
                """, Long.class);

        mockMvc.perform(delete("/api/admin/users/{id}/hard-delete", userId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/admin/organizations/{id}/hard-delete", organizationId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/admin/positions/{id}/hard-delete", positionId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/admin/approval-lines/{id}/hard-delete", approvalLineId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/admin/approval-org-exceptions/{id}/hard-delete", exceptionId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isNoContent());

        assertThat(rowCount("users", userId)).isZero();
        assertThat(rowCount("organizations", organizationId)).isZero();
        assertThat(rowCount("positions", positionId)).isZero();
        assertThat(rowCount("approval_lines", approvalLineId)).isZero();
        assertThat(rowCount("approval_org_exceptions", exceptionId)).isZero();
    }

    @Test
    void adminCanChangeManagedUserPassword() throws Exception {
        long managedUserId = createPasswordTestUser("password-admin-target");
        String adminToken = login("admin");
        String applicantToken = login("employee01");

        mockMvc.perform(put("/api/admin/users/{id}/password", managedUserId)
                        .header("Authorization", bearer(applicantToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "newPassword": "changed-password"
                                }
                                """))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/admin/users/{id}/password", managedUserId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "newPassword": "changed-password"
                                }
                                """))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "loginId": "password-admin-target",
                                  "password": "password"
                                }
                                """))
                .andExpect(status().isUnauthorized());
        assertThat(login("password-admin-target", "changed-password")).isNotBlank();
    }

    @Test
    void userCanChangeOwnPasswordWithCurrentPassword() throws Exception {
        createPasswordTestUser("password-self-target");
        String applicantToken = login("password-self-target");

        mockMvc.perform(post("/api/me/password")
                        .header("Authorization", bearer(applicantToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currentPassword": "wrong-password",
                                  "newPassword": "self-changed-password"
                                }
                                """))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/me/password")
                        .header("Authorization", bearer(applicantToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "currentPassword": "password",
                                  "newPassword": "self-changed-password"
                                }
                                """))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "loginId": "password-self-target",
                                  "password": "password"
                                }
                                """))
                .andExpect(status().isUnauthorized());
        assertThat(login("password-self-target", "self-changed-password")).isNotBlank();
    }

    @Test
    void applicantCanUpdateOwnDraftOnly() throws Exception {
        Application application = applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                3L,
                1L,
                LocalDate.of(2026, 6, 3),
                LocalDate.of(2026, 6, 2),
                "테스트 상점",
                new BigDecimal("12500.00"),
                "점심 식대"));
        String applicantToken = login("employee01");
        String otherApplicantToken = login("employee07");

        mockMvc.perform(put("/api/applications/{id}", application.getId())
                        .header("Authorization", bearer(otherApplicantToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "applicationDate": "2026-06-04",
                                  "receiptDate": "2026-06-03",
                                  "vendor": "수정 상점",
                                  "amount": 22000,
                                  "description": "수정된 식대"
                                }
                                """))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/applications/{id}", application.getId())
                        .header("Authorization", bearer(applicantToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "applicationDate": "2026-06-04",
                                  "receiptDate": "2026-06-03",
                                  "vendor": "수정 상점",
                                  "amount": 22000,
                                  "description": "수정된 식대"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vendor").value("수정 상점"))
                .andExpect(jsonPath("$.amount").value(22000))
                .andExpect(jsonPath("$.description").value("수정된 식대"));

        assertThat(applicationVendor(application.getId())).isEqualTo("수정 상점");
    }

    @Test
    void applicantCanReviseCanceledApplicationButNotInApprovalApprovedOrRejected() throws Exception {
        Application canceled = applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                3L,
                1L,
                LocalDate.of(2026, 6, 3),
                LocalDate.of(2026, 6, 2),
                "취소 전 상점",
                new BigDecimal("12500.00"),
                "취소 전 내용"));
        applicationService.cancelDraft(canceled.getId(), 3L);
        String applicantToken = login("employee01");

        mockMvc.perform(put("/api/applications/{id}", canceled.getId())
                        .header("Authorization", bearer(applicantToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "applicationDate": "2026-06-04",
                                  "receiptDate": "2026-06-03",
                                  "vendor": "재작성 상점",
                                  "amount": 22000,
                                  "description": "재작성 내용"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vendor").value("재작성 상점"))
                .andExpect(jsonPath("$.status").value("DRAFT"));

        long inApprovalId = submitApplication(3L, 1L);
        mockMvc.perform(put("/api/applications/{id}", inApprovalId)
                        .header("Authorization", bearer(applicantToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "applicationDate": "2026-06-04",
                                  "receiptDate": "2026-06-03",
                                  "vendor": "진행중 수정",
                                  "amount": 22000,
                                  "description": "진행중 수정"
                                }
                                """))
                .andExpect(status().isConflict());

        applicationService.adminApprove(stepId(inApprovalId, 1), 1L, "관리자 승인");
        mockMvc.perform(put("/api/applications/{id}", inApprovalId)
                        .header("Authorization", bearer(applicantToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "applicationDate": "2026-06-04",
                                  "receiptDate": "2026-06-03",
                                  "vendor": "완료 수정",
                                  "amount": 22000,
                                  "description": "완료 수정"
                                }
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void applicantCanPreviewResolvedApprovalLineBeforeSubmit() throws Exception {
        String applicantToken = login("employee01");

        mockMvc.perform(get("/api/applications/approval-preview")
                        .param("approvalTypeId", "1")
                        .header("Authorization", bearer(applicantToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].stepOrder").value(2))
                .andExpect(jsonPath("$[0].approver.name").value("개발팀장"));
    }

    @Test
    void applicantCanCancelOwnDraftOnly() throws Exception {
        Application application = applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                3L,
                1L,
                LocalDate.of(2026, 6, 3),
                LocalDate.of(2026, 6, 2),
                "테스트 상점",
                new BigDecimal("12500.00"),
                "점심 식대"));
        String applicantToken = login("employee01");
        String otherApplicantToken = login("employee07");

        mockMvc.perform(post("/api/applications/{id}/cancel", application.getId())
                        .header("Authorization", bearer(otherApplicantToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/applications/{id}/cancel", application.getId())
                        .header("Authorization", bearer(applicantToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELED"));

        assertThat(applicationStatus(application.getId())).isEqualTo("CANCELED");
    }

    @Test
    void applicantCanHardDeleteOwnDraftApplication() throws Exception {
        Application application = applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                3L,
                1L,
                LocalDate.of(2026, 6, 3),
                LocalDate.of(2026, 6, 2),
                "삭제 대상 상점",
                new BigDecimal("12500.00"),
                "삭제 대상 식대"));
        String applicantToken = login("employee01");

        mockMvc.perform(delete("/api/applications/{id}/hard-delete", application.getId())
                        .header("Authorization", bearer(applicantToken)))
                .andExpect(status().isNoContent());

        assertThat(rowCount("applications", application.getId())).isZero();
    }

    @Test
    void adminCanHardDeleteCanceledApplicationButManagerCannot() throws Exception {
        Application managerTarget = applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                3L,
                1L,
                LocalDate.of(2026, 6, 3),
                LocalDate.of(2026, 6, 2),
                "매니저 차단 상점",
                new BigDecimal("12500.00"),
                "매니저 차단 식대"));
        Application adminTarget = applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                3L,
                1L,
                LocalDate.of(2026, 6, 4),
                LocalDate.of(2026, 6, 3),
                "관리자 삭제 상점",
                new BigDecimal("22000.00"),
                "관리자 삭제 식대"));
        applicationService.cancelDraft(adminTarget.getId(), 3L);
        createRoleTestUser("application-hard-delete-manager", "MANAGER,APPLICANT");
        String managerToken = login("application-hard-delete-manager");
        String adminToken = login("admin");

        mockMvc.perform(delete("/api/admin/applications/{id}/hard-delete", managerTarget.getId())
                        .header("Authorization", bearer(managerToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/admin/applications/{id}/hard-delete", adminTarget.getId())
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isNoContent());

        assertThat(rowCount("applications", managerTarget.getId())).isOne();
        assertThat(rowCount("applications", adminTarget.getId())).isZero();
    }

    @Test
    void terminalApplicationsCannotBeHardDeletedThroughApplicantOrAdminApis() throws Exception {
        long approvedApplicationId = submitApplication(3L, 1L);
        applicationService.approve(stepId(approvedApplicationId, 1), 18L, "승인합니다");
        long rejectedApplicationId = submitApplication(3L, 1L);
        applicationService.reject(stepId(rejectedApplicationId, 1), 18L, "반려합니다");
        String applicantToken = login("employee01");
        String adminToken = login("admin");

        mockMvc.perform(delete("/api/applications/{id}/hard-delete", approvedApplicationId)
                        .header("Authorization", bearer(applicantToken)))
                .andExpect(status().isConflict());
        mockMvc.perform(delete("/api/admin/applications/{id}/hard-delete", approvedApplicationId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isConflict());
        mockMvc.perform(delete("/api/applications/{id}/hard-delete", rejectedApplicationId)
                        .header("Authorization", bearer(applicantToken)))
                .andExpect(status().isConflict());
        mockMvc.perform(delete("/api/admin/applications/{id}/hard-delete", rejectedApplicationId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isConflict());

        assertThat(rowCount("applications", approvedApplicationId)).isOne();
        assertThat(rowCount("applications", rejectedApplicationId)).isOne();
    }

    @Test
    void receiptAttachmentRejectsImagesLargerThanConfiguredLimit() throws Exception {
        Application application = applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                3L,
                1L,
                LocalDate.of(2026, 6, 3),
                LocalDate.of(2026, 6, 2),
                "테스트 상점",
                new BigDecimal("12500.00"),
                "점심 식대"));
        String applicantToken = login("employee01");
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "large-receipt.png",
                "image/png",
                pngBytes());

        mockMvc.perform(multipart("/api/applications/{id}/attachments", application.getId())
                        .file(file)
                        .header("Authorization", bearer(applicantToken)))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void adminCanDownloadMonthlyReceiptAttachmentZip() throws Exception {
        long juneApplicationId = createSubmittedApplication(3L, LocalDate.of(2026, 6, 2), "문구점");
        long julyApplicationId = createSubmittedApplication(3L, LocalDate.of(2026, 7, 1), "카페");
        String adminToken = login("admin");

        byte[] zipBytes = mockMvc.perform(get("/api/admin/attachments/monthly-download")
                        .param("month", "2026-06")
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(result.getResponse().getContentType()).isEqualTo("application/zip"))
                .andExpect(result -> assertThat(result.getResponse().getHeader("Content-Disposition"))
                        .contains("receipt-attachments-2026-06.zip"))
                .andReturn()
                .getResponse()
                .getContentAsByteArray();

        List<String> entries = zipEntryNames(zipBytes);
        assertThat(entries)
                .anySatisfy(entry -> {
                    assertThat(entry).contains("2026-06/application-" + juneApplicationId + "/");
                    assertThat(entry).contains("문구점");
                    assertThat(entry).contains("receipt.png");
                });
        assertThat(entries)
                .noneMatch(entry -> entry.contains("application-" + julyApplicationId + "/"));
    }

    @Test
    void managerCannotDownloadMonthlyReceiptAttachmentZip() throws Exception {
        long managerId = createRoleTestUser("monthly-download-manager", "MANAGER");
        String managerToken = login("monthly-download-manager");

        mockMvc.perform(get("/api/admin/attachments/monthly-download")
                        .param("month", "2026-06")
                        .header("Authorization", bearer(managerToken)))
                .andExpect(status().isForbidden());

        assertThat(rowCount("users", managerId)).isOne();
    }

    private long submitApplication(long applicantId, long approvalTypeId) {
        Application application = applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                applicantId,
                approvalTypeId,
                LocalDate.of(2026, 6, 3),
                LocalDate.of(2026, 6, 2),
                "테스트 상점",
                new BigDecimal("12500.00"),
                "점심 식대"));
        applicationService.attachReceiptImage(
                application.getId(),
                applicantId,
                "receipt.png",
                "image/png",
                pngBytes());
        applicationService.submit(application.getId(), applicantId);
        return application.getId();
    }

    private long createSubmittedApplication(long applicantId, LocalDate receiptDate, String vendor) {
        Application application = applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                applicantId,
                1L,
                receiptDate.plusDays(1),
                receiptDate,
                vendor,
                new BigDecimal("12500.00"),
                "월별 다운로드 테스트"));
        applicationService.attachReceiptImage(
                application.getId(),
                applicantId,
                "receipt.png",
                "image/png",
                pngBytes());
        applicationService.submit(application.getId(), applicantId);
        return application.getId();
    }

    private String login(String loginId) throws Exception {
        return login(loginId, "password");
    }

    private String login(String loginId, String password) throws Exception {
        String response = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "loginId": "%s",
                                  "password": "%s"
                                }
                                """.formatted(loginId, password)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String accessToken = objectMapper.readTree(response).path("accessToken").asText();
        assertThat(accessToken).isNotBlank();
        return accessToken;
    }

    private String bearer(String accessToken) {
        return "Bearer " + accessToken;
    }

    private String calendarEventJson() {
        return """
                {
                  "title": "월간 마감",
                  "description": "영수증 제출 마감",
                  "location": "본사",
                  "startAt": "2026-06-10T09:00:00+09:00",
                  "endAt": "2026-06-10T10:00:00+09:00",
                  "allDay": false
                }
                """;
    }

    private long stepId(long applicationId, int stepOrder) {
        return jdbcTemplate.queryForObject(
                """
                select id
                from application_approval_steps
                where application_id = ? and step_order = ?
                """,
                Long.class,
                applicationId,
                stepOrder);
    }

    private String stepStatus(long applicationId, int stepOrder) {
        return jdbcTemplate.queryForObject(
                """
                select status
                from application_approval_steps
                where application_id = ? and step_order = ?
                """,
                String.class,
                applicationId,
                stepOrder);
    }

    private String historyAdminReason(long applicationId) {
        return jdbcTemplate.queryForObject(
                """
                select admin_reason
                from approval_histories
                where application_id = ?
                order by id desc
                limit 1
                """,
                String.class,
                applicationId);
    }

    private int approvalLineStepCount() {
        return jdbcTemplate.queryForObject(
                "select count(*) from approval_line_steps",
                Integer.class);
    }

    private int approvalOrgExceptionCount() {
        return jdbcTemplate.queryForObject(
                "select count(*) from approval_org_exceptions",
                Integer.class);
    }

    private String applicationVendor(long applicationId) {
        return jdbcTemplate.queryForObject(
                "select vendor from applications where id = ?",
                String.class,
                applicationId);
    }

    private String applicationStatus(long applicationId) {
        return jdbcTemplate.queryForObject(
                "select status from applications where id = ?",
                String.class,
                applicationId);
    }

    private boolean activeFlag(String tableName, long id) {
        return jdbcTemplate.queryForObject(
                "select active from " + tableName + " where id = ?",
                Boolean.class,
                id);
    }

    private int rowCount(String tableName, long id) {
        return jdbcTemplate.queryForObject(
                "select count(*) from " + tableName + " where id = ?",
                Integer.class,
                id);
    }

    private long createPasswordTestUser(String loginId) {
        return createRoleTestUser(loginId, "APPLICANT");
    }

    private long createRoleTestUser(String loginId, String roles) {
        return jdbcTemplate.queryForObject(
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
                ) values (?, null, ?, ?, ?, 3, 1, ?, true)
                returning id
                """,
                Long.class,
                loginId,
                passwordEncoder.encode("password"),
                loginId,
                loginId + "@theieum.local",
                roles);
    }

    private long attachmentId(long applicationId) {
        return jdbcTemplate.queryForObject(
                """
                select id
                from attachments
                where application_id = ?
                """,
                Long.class,
                applicationId);
    }

    private List<String> zipEntryNames(byte[] zipBytes) throws Exception {
        List<String> entries = new ArrayList<>();
        try (ZipInputStream zipInputStream = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
            ZipEntry entry;
            while ((entry = zipInputStream.getNextEntry()) != null) {
                entries.add(entry.getName());
            }
        }
        return entries;
    }

    private long notificationId(long applicationId, long recipientId) {
        return jdbcTemplate.queryForObject(
                """
                select id
                from notification_events
                where application_id = ? and recipient_id = ?
                order by id asc
                limit 1
                """,
                Long.class,
                applicationId,
                recipientId);
    }

    private boolean notificationReadFlag(long notificationId) {
        return jdbcTemplate.queryForObject(
                "select read_flag from notification_events where id = ?",
                Boolean.class,
                notificationId);
    }

    private byte[] pngBytes() {
        return new byte[] {
                (byte) 0x89,
                0x50,
                0x4e,
                0x47,
                0x0d,
                0x0a,
                0x1a,
                0x0a,
                0x00
        };
    }

    @TestConfiguration
    static class CleanFlywayConfiguration {

        @Bean
        FlywayMigrationStrategy cleanAndMigrate() {
            return TestDatabaseHarness::cleanAndMigrate;
        }
    }
}
