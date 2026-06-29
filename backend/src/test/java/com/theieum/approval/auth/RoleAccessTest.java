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
