package com.theieum.approval.auth;

import java.util.List;

public record JwtTokenPayload(String subject, Long userId, List<String> roles, long expiresAt) {
}
