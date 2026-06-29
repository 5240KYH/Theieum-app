package com.theieum.approval.auth;

import java.util.Arrays;
import java.util.Collection;
import java.util.Locale;
import java.util.Objects;

public final class RoleAccess {

    private RoleAccess() {
    }

    public static boolean hasRole(AuthenticatedUser user, String role) {
        return user != null && hasRole(user.roles(), role);
    }

    public static boolean hasRole(Collection<String> roles, String role) {
        String expected = normalize(role);
        return roles != null && roles.stream()
                .map(RoleAccess::normalize)
                .anyMatch(expected::equals);
    }

    public static boolean hasAnyRole(AuthenticatedUser user, String... roles) {
        return user != null && hasAnyRole(user.roles(), roles);
    }

    public static boolean hasAnyRole(Collection<String> userRoles, String... roles) {
        if (userRoles == null || roles == null) {
            return false;
        }
        return Arrays.stream(roles)
                .filter(Objects::nonNull)
                .anyMatch(role -> hasRole(userRoles, role));
    }

    public static String normalize(String role) {
        if (role == null) {
            return "";
        }
        String normalized = role.trim().toUpperCase(Locale.ROOT);
        return normalized.equals("MANGER") ? "MANAGER" : normalized;
    }
}
