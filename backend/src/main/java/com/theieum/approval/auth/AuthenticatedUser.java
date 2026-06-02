package com.theieum.approval.auth;

import java.util.List;

import com.theieum.approval.user.User;

public record AuthenticatedUser(Long id, String loginId, String name, List<String> roles) {

    public static AuthenticatedUser from(User user) {
        return new AuthenticatedUser(user.getId(), user.getLoginId(), user.getName(), user.getRoleList());
    }

    public UserSummary toSummary() {
        return new UserSummary(id, name, roles);
    }
}
