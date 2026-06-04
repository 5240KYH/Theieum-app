package com.theieum.approval.application;

import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.theieum.approval.attachment.FileStorage;
import com.theieum.approval.common.ForbiddenOperationException;
import com.theieum.approval.common.ResourceNotFoundException;
import com.theieum.approval.common.WorkflowConflictException;

@Service
public class ApplicationHardDeleteService {

    private final JdbcTemplate jdbcTemplate;
    private final FileStorage fileStorage;

    public ApplicationHardDeleteService(JdbcTemplate jdbcTemplate, FileStorage fileStorage) {
        this.jdbcTemplate = jdbcTemplate;
        this.fileStorage = fileStorage;
    }

    @Transactional
    public void hardDeleteByApplicant(long applicationId, long actorId) {
        ApplicationDeleteTarget target = loadTarget(applicationId);
        if (target.applicantId() != actorId) {
            throw new ForbiddenOperationException("본인의 신청서만 삭제할 수 있습니다.");
        }
        hardDeleteAllowedApplication(target);
    }

    @Transactional
    public void hardDeleteByAdmin(long applicationId) {
        hardDeleteAllowedApplication(loadTarget(applicationId));
    }

    private void hardDeleteAllowedApplication(ApplicationDeleteTarget target) {
        if (target.status() != ApplicationStatus.DRAFT && target.status() != ApplicationStatus.CANCELED) {
            throw new WorkflowConflictException("임시저장 또는 취소 상태의 신청서만 삭제할 수 있습니다.");
        }
        requireNoHistories(target.id());

        List<String> filePaths = jdbcTemplate.queryForList(
                "select file_path from attachments where application_id = ?",
                String.class,
                target.id());

        jdbcTemplate.update("delete from notification_events where application_id = ?", target.id());
        jdbcTemplate.update("delete from application_approval_steps where application_id = ?", target.id());
        jdbcTemplate.update("delete from attachments where application_id = ?", target.id());
        jdbcTemplate.update("delete from applications where id = ?", target.id());

        for (String filePath : filePaths) {
            fileStorage.deleteIfExists(filePath);
        }
    }

    private ApplicationDeleteTarget loadTarget(long applicationId) {
        List<ApplicationDeleteTarget> targets = jdbcTemplate.query("""
                select id, applicant_id, status
                from applications
                where id = ?
                """,
                (rs, rowNum) -> new ApplicationDeleteTarget(
                        rs.getLong("id"),
                        rs.getLong("applicant_id"),
                        ApplicationStatus.valueOf(rs.getString("status"))),
                applicationId);
        if (targets.isEmpty()) {
            throw new ResourceNotFoundException("Application not found: " + applicationId);
        }
        return targets.getFirst();
    }

    private void requireNoHistories(long applicationId) {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from approval_histories where application_id = ?",
                Integer.class,
                applicationId);
        if (count != null && count > 0) {
            throw new WorkflowConflictException("결재 이력이 있는 신청서는 삭제할 수 없습니다.");
        }
    }

    private record ApplicationDeleteTarget(long id, long applicantId, ApplicationStatus status) {
    }
}
