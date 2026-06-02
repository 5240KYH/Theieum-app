package com.theieum.approval.auth;

public record LoginResponse(String accessToken, UserSummary user) {
}
