package com.theieum.approval.user;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.theieum.approval.common.ForbiddenOperationException;

@Service
public class UserOrganizationService {

    private final JdbcTemplate jdbcTemplate;

    public UserOrganizationService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public List<MembershipSummary> findMemberships(long userId) {
        return jdbcTemplate.query(
                """
                select uo.organization_id,
                       organization.name as organization_name,
                       uo.position_id,
                       position.name as position_name,
                       uo.primary_flag,
                       uo.active,
                       uo.sort_order
                from user_organizations uo
                join organizations organization on organization.id = uo.organization_id
                join positions position on position.id = uo.position_id
                where uo.user_id = ?
                order by uo.sort_order asc, uo.id asc
                """,
                (rs, rowNum) -> new MembershipSummary(
                        rs.getLong("organization_id"),
                        rs.getString("organization_name"),
                        rs.getLong("position_id"),
                        rs.getString("position_name"),
                        rs.getBoolean("primary_flag"),
                        rs.getBoolean("active"),
                        rs.getInt("sort_order")),
                userId);
    }

    @Transactional(readOnly = true)
    public List<ApprovalOrganizationSummary> findActiveApprovalOrganizations(long userId) {
        return jdbcTemplate.query(
                """
                select organization.id as organization_id,
                       organization.name as organization_name,
                       organization.parent_id,
                       organization.level_no,
                       uo.primary_flag
                from user_organizations uo
                join organizations organization on organization.id = uo.organization_id
                where uo.user_id = ?
                  and uo.active = true
                  and organization.active = true
                order by uo.primary_flag desc, uo.sort_order asc, uo.id asc
                """,
                (rs, rowNum) -> new ApprovalOrganizationSummary(
                        rs.getLong("organization_id"),
                        rs.getString("organization_name"),
                        nullableLong(rs.getObject("parent_id")),
                        rs.getInt("level_no"),
                        rs.getBoolean("primary_flag")),
                userId);
    }

    @Transactional
    public void saveMemberships(long userId, List<MembershipCommand> memberships) {
        validateMemberships(memberships);
        long primaryOrganizationId = activePrimaryOrganizationId(memberships);
        long primaryPositionId = activePrimaryPositionId(memberships);

        jdbcTemplate.update("delete from user_organizations where user_id = ?", userId);
        for (MembershipCommand membership : memberships) {
            jdbcTemplate.update(
                    """
                    insert into user_organizations (
                        user_id,
                        organization_id,
                        position_id,
                        primary_flag,
                        active,
                        sort_order
                    ) values (?, ?, ?, ?, ?, ?)
                    """,
                    userId,
                    membership.organizationId(),
                    membership.positionId(),
                    membership.primary(),
                    membership.active(),
                    membership.sortOrder());
        }
        jdbcTemplate.update(
                "update users set organization_id = ?, position_id = ? where id = ?",
                primaryOrganizationId,
                primaryPositionId,
                userId);
    }

    @Transactional(readOnly = true)
    public long requireActiveMembership(long userId, long organizationId) {
        Boolean allowed = jdbcTemplate.queryForObject(
                """
                select exists (
                    select 1
                    from user_organizations uo
                    join organizations organization on organization.id = uo.organization_id
                    where uo.user_id = ?
                      and uo.organization_id = ?
                      and uo.active = true
                      and organization.active = true
                )
                """,
                Boolean.class,
                userId,
                organizationId);
        if (!Boolean.TRUE.equals(allowed)) {
            throw new ForbiddenOperationException("신청자의 활성 소속이 아닙니다: " + organizationId);
        }
        return organizationId;
    }

    private void validateMemberships(List<MembershipCommand> memberships) {
        if (memberships == null || memberships.isEmpty()) {
            throw new IllegalArgumentException("소속을 1개 이상 입력해주세요.");
        }

        Set<Long> organizationIds = new HashSet<>();
        int activePrimaryCount = 0;
        for (MembershipCommand membership : memberships) {
            if (membership.organizationId() == null) {
                throw new IllegalArgumentException("소속 조직을 입력해주세요.");
            }
            if (membership.positionId() == null) {
                throw new IllegalArgumentException("소속 직위를 입력해주세요.");
            }
            if (!organizationIds.add(membership.organizationId())) {
                throw new IllegalArgumentException("중복된 소속 조직입니다: " + membership.organizationId());
            }
            requireActiveOrganization(membership.organizationId());
            requireActivePosition(membership.positionId());
            if (membership.primary() && !membership.active()) {
                throw new IllegalArgumentException("대표 소속은 활성 상태여야 합니다.");
            }
            if (membership.active() && membership.primary()) {
                activePrimaryCount++;
            }
        }

        if (activePrimaryCount != 1) {
            throw new IllegalArgumentException("활성 대표 소속은 정확히 1개여야 합니다.");
        }
    }

    private long activePrimaryOrganizationId(List<MembershipCommand> memberships) {
        return memberships.stream()
                .filter(membership -> membership.active() && membership.primary())
                .map(MembershipCommand::organizationId)
                .findFirst()
                .orElseThrow();
    }

    private long activePrimaryPositionId(List<MembershipCommand> memberships) {
        return memberships.stream()
                .filter(membership -> membership.active() && membership.primary())
                .map(MembershipCommand::positionId)
                .findFirst()
                .orElseThrow();
    }

    private void requireActiveOrganization(Long organizationId) {
        Boolean exists = jdbcTemplate.queryForObject(
                """
                select exists (
                    select 1
                    from organizations
                    where id = ?
                      and active = true
                )
                """,
                Boolean.class,
                organizationId);
        if (!Boolean.TRUE.equals(exists)) {
            throw new IllegalArgumentException("활성 조직이 아닙니다: " + organizationId);
        }
    }

    private void requireActivePosition(Long positionId) {
        Boolean exists = jdbcTemplate.queryForObject(
                """
                select exists (
                    select 1
                    from positions
                    where id = ?
                      and active = true
                )
                """,
                Boolean.class,
                positionId);
        if (!Boolean.TRUE.equals(exists)) {
            throw new IllegalArgumentException("활성 직위가 아닙니다: " + positionId);
        }
    }

    private static Long nullableLong(Object value) {
        return value == null ? null : ((Number) value).longValue();
    }

    public record MembershipCommand(Long organizationId, Long positionId, boolean primary, boolean active, int sortOrder) {
    }

    public record MembershipSummary(
            Long organizationId,
            String organizationName,
            Long positionId,
            String positionName,
            boolean primary,
            boolean active,
            int sortOrder) {
    }

    public record ApprovalOrganizationSummary(
            Long organizationId,
            String organizationName,
            Long parentId,
            int levelNo,
            boolean primary) {
    }
}
