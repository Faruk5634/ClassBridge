package com.classbridge.dto;

import com.classbridge.domain.SchoolLevel;
import com.classbridge.domain.UserRole;

/**
 * Minimal Superadmin list row for a school administrator or vice-administrator.
 * It intentionally excludes contact details and credential-related fields.
 */
public class SchoolAdministratorSummaryResponse {

    private final Long userAccountId;
    private final String firstName;
    private final String lastName;
    private final String username;
    private final UserRole role;
    private final boolean active;
    private final Long schoolId;
    private final String schoolName;
    private final SchoolLevel schoolEducationLevel;

    public SchoolAdministratorSummaryResponse(Long userAccountId, String firstName, String lastName, String username,
                                              UserRole role, boolean active, Long schoolId, String schoolName,
                                              SchoolLevel schoolEducationLevel) {
        this.userAccountId = userAccountId;
        this.firstName = firstName;
        this.lastName = lastName;
        this.username = username;
        this.role = role;
        this.active = active;
        this.schoolId = schoolId;
        this.schoolName = schoolName;
        this.schoolEducationLevel = schoolEducationLevel;
    }

    public Long getUserAccountId() {
        return userAccountId;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getUsername() {
        return username;
    }

    public UserRole getRole() {
        return role;
    }

    public boolean isActive() {
        return active;
    }

    public Long getSchoolId() {
        return schoolId;
    }

    public String getSchoolName() {
        return schoolName;
    }

    public SchoolLevel getSchoolEducationLevel() {
        return schoolEducationLevel;
    }
}
