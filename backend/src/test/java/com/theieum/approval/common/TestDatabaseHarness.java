package com.theieum.approval.common;

import java.sql.SQLException;

import org.flywaydb.core.Flyway;

public final class TestDatabaseHarness {

    public static final String JDBC_URL = "jdbc:postgresql://localhost:55432/approval_test";
    public static final String USERNAME = "approval";
    public static final String PASSWORD = "approval";

    private TestDatabaseHarness() {
    }

    public static void cleanAndMigrate(Flyway flyway) {
        assertIsDedicatedTestDatabase(flyway);
        flyway.clean();
        flyway.migrate();
    }

    private static void assertIsDedicatedTestDatabase(Flyway flyway) {
        try (var connection = flyway.getConfiguration().getDataSource().getConnection()) {
            String actualUrl = connection.getMetaData().getURL();
            if (!JDBC_URL.equals(actualUrl)) {
                throw new IllegalStateException("Refusing to clean non-test database: " + actualUrl);
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Unable to verify test database before clean", ex);
        }
    }
}
