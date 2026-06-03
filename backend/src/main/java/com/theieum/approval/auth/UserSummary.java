package com.theieum.approval.auth;

import java.util.List;

import com.theieum.approval.user.User;

public record UserSummary(Long id, String loginId, String name, List<String> roles) {

    public static UserSummary from(User user) {
        return new UserSummary(user.getId(), user.getLoginId(), user.getName(), user.getRoleList());
    }
}
