package com.theieum.approval.admin;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.theieum.approval.common.ResourceNotFoundException;
import com.theieum.approval.common.WorkflowConflictException;

@Service
public class AdminHardDeleteService {

    private final JdbcTemplate jdbcTemplate;

    public AdminHardDeleteService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public void hardDeleteUser(long id) {
        requireExists("users", id, "User not found: " + id);
        requireUnused("select count(*) from applications where applicant_id = ?", id,
                "신청서 또는 결재 이력에서 사용 중인 사용자입니다. 비활성화만 가능합니다.");
        requireUnused("select count(*) from application_approval_steps where original_approver_id = ?", id,
                "결재 단계에서 사용 중인 사용자입니다. 비활성화만 가능합니다.");
        requireUnused("""
                select count(*)
                from approval_histories
                where original_approver_id = ? or actor_id = ?
                """, "결재 이력에서 사용 중인 사용자입니다. 비활성화만 가능합니다.", id, id);
        requireUnused("select count(*) from attachments where uploaded_by = ?", id,
                "첨부파일에서 사용 중인 사용자입니다. 비활성화만 가능합니다.");
        requireUnused("select count(*) from notification_events where recipient_id = ?", id,
                "알림에서 사용 중인 사용자입니다. 비활성화만 가능합니다.");
        requireUnused("select count(*) from approval_line_steps where direct_user_id = ?", id,
                "결재선에서 사용 중인 사용자입니다. 비활성화만 가능합니다.");
        requireUnused("select count(*) from approval_org_exceptions where approver_user_id = ?", id,
                "조직별 예외 결재자에서 사용 중인 사용자입니다. 비활성화만 가능합니다.");
        requireUnused("select count(*) from organizations where leader_user_id = ?", id,
                "조직장으로 지정된 사용자입니다. 조직장을 먼저 변경해 주세요.");
        jdbcTemplate.update("delete from user_organizations where user_id = ?", id);
        jdbcTemplate.update("delete from users where id = ?", id);
    }

    @Transactional
    public void hardDeleteOrganization(long id) {
        requireExists("organizations", id, "Organization not found: " + id);
        requireUnused("select count(*) from organizations where parent_id = ?", id,
                "하위 조직이 있는 조직입니다. 하위 조직을 먼저 정리해 주세요.");
        requireUnused("select count(*) from users where organization_id = ?", id,
                "소속 사용자가 있는 조직입니다. 사용자를 먼저 이동하거나 비활성화해 주세요.");
        requireUnused("select count(*) from user_organizations where organization_id = ?", id,
                "소속 사용자가 있는 조직입니다. 사용자를 먼저 이동하거나 비활성화해 주세요.");
        requireUnused("select count(*) from applications where approval_organization_id = ?", id,
                "신청서에서 결재 기준 조직으로 사용 중인 조직입니다. 비활성화만 가능합니다.");
        requireUnused("select count(*) from approval_org_exceptions where organization_id = ?", id,
                "조직별 예외 결재자에서 사용 중인 조직입니다. 예외 설정을 먼저 정리해 주세요.");
        jdbcTemplate.update("delete from organizations where id = ?", id);
    }

    @Transactional
    public void hardDeletePosition(long id) {
        requireExists("positions", id, "Position not found: " + id);
        long userCount = count("select count(*) from users where position_id = ?", id);
        long membershipCount = count("select count(*) from user_organizations where position_id = ?", id);
        long stepCount = count("select count(*) from approval_line_steps where position_id = ?", id);
        if (userCount + stepCount > 0) {
            throw new WorkflowConflictException("사용자가 있거나 결재선에서 사용 중인 직위입니다. 비활성화만 가능합니다.");
        }
        if (membershipCount > 0) {
            throw new WorkflowConflictException("소속에서 사용 중인 직위입니다. 비활성화만 가능합니다.");
        }
        jdbcTemplate.update("delete from positions where id = ?", id);
    }

    @Transactional
    public void hardDeleteApprovalLine(long id) {
        requireExists("approval_lines", id, "Approval line not found: " + id);
        jdbcTemplate.update("delete from approval_line_steps where approval_line_id = ?", id);
        jdbcTemplate.update("delete from approval_lines where id = ?", id);
    }

    @Transactional
    public void hardDeleteApprovalOrgException(long id) {
        requireExists("approval_org_exceptions", id, "Approval organization exception not found: " + id);
        jdbcTemplate.update("delete from approval_org_exceptions where id = ?", id);
    }

    private void requireExists(String tableName, long id, String message) {
        Boolean exists = jdbcTemplate.queryForObject(
                "select exists (select 1 from " + tableName + " where id = ?)",
                Boolean.class,
                id);
        if (!Boolean.TRUE.equals(exists)) {
            throw new ResourceNotFoundException(message);
        }
    }

    private void requireUnused(String sql, long id, String message) {
        requireUnused(sql, message, id);
    }

    private void requireUnused(String sql, String message, Object... args) {
        if (count(sql, args) > 0) {
            throw new WorkflowConflictException(message);
        }
    }

    private long count(String sql, Object... args) {
        Long count = jdbcTemplate.queryForObject(sql, Long.class, args);
        return count == null ? 0L : count;
    }
}
