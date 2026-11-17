package com.classbridge.dto;

import com.classbridge.domain.UserRole;
import jakarta.validation.constraints.NotNull;

public class AssignSchoolAdministratorRequest {

    @NotNull
    private Long userAccountId;

    private Long schoolId;

    private UserRole role;

    public Long getUserAccountId() {
        return userAccountId;
    }

    public void setUserAccountId(Long userAccountId) {
        this.userAccountId = userAccountId;
    }

    public Long getSchoolId() {
        return schoolId;
    }

    public void setSchoolId(Long schoolId) {
        this.schoolId = schoolId;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }
}
