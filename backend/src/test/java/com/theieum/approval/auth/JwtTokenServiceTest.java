package com.theieum.approval.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.theieum.approval.user.User;

class JwtTokenServiceTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String TEST_SECRET = "test-jwt-secret-that-is-long-enough-for-hmac";
    private static final Clock NOW = Clock.fixed(Instant.parse("2026-06-03T00:00:00Z"), ZoneOffset.UTC);

    @Test
    void rejectsKnownDevelopmentSecret() {
        assertThatThrownBy(() -> new JwtTokenService(
                        OBJECT_MAPPER,
                        "local-development-secret-change-me",
                        NOW,
                        Duration.ofHours(1)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsBlankSecret() {
        assertThatThrownBy(() -> new JwtTokenService(
                        OBJECT_MAPPER,
                        " ",
                        NOW,
                        Duration.ofHours(1)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsExpiredToken() {
        JwtTokenService issuer = new JwtTokenService(OBJECT_MAPPER, TEST_SECRET, NOW, Duration.ofSeconds(1));
        JwtTokenService verifier = new JwtTokenService(
                OBJECT_MAPPER,
                TEST_SECRET,
                Clock.fixed(Instant.parse("2026-06-03T00:00:02Z"), ZoneOffset.UTC),
                Duration.ofSeconds(1));

        String token = issuer.createAccessToken(userWithRole("ADMIN"));

        assertThat(verifier.verify(token)).isEmpty();
    }

    @Test
    void rejectsMalformedToken() {
        JwtTokenService service = new JwtTokenService(OBJECT_MAPPER, TEST_SECRET, NOW, Duration.ofHours(1));

        assertThat(service.verify("not-a-jwt")).isEmpty();
    }

    private User userWithRole(String role) {
        User user = mock(User.class);
        when(user.getId()).thenReturn(1L);
        when(user.getLoginId()).thenReturn("admin");
        when(user.getRoleList()).thenReturn(java.util.List.of(role));
        return user;
    }
}
