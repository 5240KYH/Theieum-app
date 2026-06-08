package com.theieum.approval.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import com.theieum.approval.common.TestDatabaseHarness;

@SpringBootTest(properties = {
        "spring.datasource.url=" + TestDatabaseHarness.JDBC_URL,
        "spring.datasource.username=" + TestDatabaseHarness.USERNAME,
        "spring.datasource.password=" + TestDatabaseHarness.PASSWORD,
        "spring.flyway.clean-disabled=false",
        "spring.flyway.locations=classpath:db/migration,classpath:db/seed",
        "app.security.jwt-secret=test-jwt-secret-that-is-long-enough-for-hmac"
})
@AutoConfigureMockMvc
class AuthIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void loginReturnsTokenForSeedAdmin() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "loginId": "admin",
                                  "password": "password"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.user.id").value(1))
                .andExpect(jsonPath("$.user.loginId").value("admin"))
                .andExpect(jsonPath("$.user.name").value("관리자"))
                .andExpect(jsonPath("$.user.roles[0]").value("ADMIN"))
                .andExpect(jsonPath("$.user.roles[1]").value("APPROVER"))
                .andExpect(jsonPath("$.user.roles[2]").value("APPLICANT"));
    }

    @Test
    void loginRejectsWrongPassword() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "loginId": "admin",
                                  "password": "wrong"
                                }
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meReturnsAuthenticatedUser() throws Exception {
        String accessToken = loginAsAdmin();

        mockMvc.perform(get("/api/me")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.loginId").value("admin"))
                .andExpect(jsonPath("$.name").value("관리자"))
                .andExpect(jsonPath("$.roles[0]").value("ADMIN"))
                .andExpect(jsonPath("$.roles[1]").value("APPROVER"))
                .andExpect(jsonPath("$.roles[2]").value("APPLICANT"));
    }

    @Test
    void meRejectsMissingToken() throws Exception {
        mockMvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meRejectsTamperedToken() throws Exception {
        String accessToken = loginAsAdmin();
        String[] tokenParts = accessToken.split("\\.");
        String signature = tokenParts[2];
        String tamperedSignature = (signature.charAt(0) == 'a' ? "b" : "a") + signature.substring(1);
        String tamperedToken = tokenParts[0] + "." + tokenParts[1] + "." + tamperedSignature;

        mockMvc.perform(get("/api/me")
                        .header("Authorization", "Bearer " + tamperedToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meRejectsInactiveUserAfterTokenIssue() throws Exception {
        String accessToken = loginAsAdmin();
        try {
            jdbcTemplate.update("update users set active = false where login_id = ?", "admin");

            mockMvc.perform(get("/api/me")
                            .header("Authorization", "Bearer " + accessToken))
                    .andExpect(status().isUnauthorized());
        } finally {
            jdbcTemplate.update("update users set active = true where login_id = ?", "admin");
        }
    }

    @Test
    void nonApiPathsAreDeniedByDefault() throws Exception {
        mockMvc.perform(get("/internal-health"))
                .andExpect(status().isUnauthorized());
    }

    private String loginAsAdmin() throws Exception {
        String response = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "loginId": "admin",
                                  "password": "password"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String accessToken = response.replaceAll(".*\\\"accessToken\\\":\\\"([^\\\"]+)\\\".*", "$1");
        assertThat(accessToken).isNotBlank();
        return accessToken;
    }

    @TestConfiguration
    static class CleanFlywayConfiguration {

        @Bean
        FlywayMigrationStrategy cleanAndMigrate() {
            return TestDatabaseHarness::cleanAndMigrate;
        }
    }
}
