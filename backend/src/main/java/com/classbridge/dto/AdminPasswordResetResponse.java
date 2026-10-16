package com.classbridge.dto;

import com.classbridge.domain.UserRole;

public class AdminPasswordResetResponse {

    private Long userAccountId;
    private String username;
    private UserRole role;
    private String temporaryPassword;

    public AdminPasswordResetResponse(Long userAccountId, String username, UserRole role, String temporaryPassword) {
        this.userAccountId = userAccountId;
        this.username = username;
        this.role = role;
        this.temporaryPassword = temporaryPassword;
    }

    public Long getUserAccountId() {
        return userAccountId;
    }

    public String getUsername() {
        return username;
    }

    public UserRole getRole() {
        return role;
    }

    public String getTemporaryPassword() {
        return temporaryPassword;
    }
}
