package com.theieum.approval.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;

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
        "app.file-storage.root-path=/private/tmp/theieum-approval-test"
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
                                  "active": true
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organizationName").value("영업팀"))
                .andExpect(jsonPath("$.approverName").value("영업팀장"));

        assertThat(approvalOrgExceptionCount()).isEqualTo(beforeCount + 1);
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
    void receiptAttachmentRejectsOversizedImages() throws Exception {
        Application application = applicationService.createDraft(new ApplicationService.CreateDraftCommand(
                3L,
                1L,
                LocalDate.of(2026, 6, 3),
                LocalDate.of(2026, 6, 2),
                "테스트 상점",
                new BigDecimal("12500.00"),
                "점심 식대"));
        String applicantToken = login("employee01");
        byte[] oversizedPng = new byte[5 * 1024 * 1024 + 9];
        System.arraycopy(pngBytes(), 0, oversizedPng, 0, pngBytes().length);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "large-receipt.png",
                "image/png",
                oversizedPng);

        mockMvc.perform(multipart("/api/applications/{id}/attachments", application.getId())
                        .file(file)
                        .header("Authorization", bearer(applicantToken)))
                .andExpect(status().isPayloadTooLarge());
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

    private String login(String loginId) throws Exception {
        String response = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "loginId": "%s",
                                  "password": "password"
                                }
                                """.formatted(loginId)))
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
