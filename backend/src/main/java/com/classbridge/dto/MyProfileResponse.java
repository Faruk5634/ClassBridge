package com.classbridge.dto;

import com.classbridge.domain.UserRole;

public class MyProfileResponse {

    private final Long userAccountId;
    private final String username;
    private final UserRole role;
    private final String firstName;
    private final String lastName;
    private final String email;
    private final boolean emailVerified;
    private final String phoneNumber;
    private final String schoolName;
    private final boolean mustChangePassword;

    public MyProfileResponse(Long userAccountId, String username, UserRole role,
                             String firstName, String lastName, String email,
                             boolean emailVerified, String phoneNumber, String schoolName, boolean mustChangePassword) {
        this.userAccountId = userAccountId;
        this.username = username;
        this.role = role;
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.emailVerified = emailVerified;
        this.phoneNumber = phoneNumber;
        this.schoolName = schoolName;
        this.mustChangePassword = mustChangePassword;
    }

    public Long getUserAccountId() { return userAccountId; }
    public String getUsername() { return username; }
    public UserRole getRole() { return role; }
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public String getEmail() { return email; }
    public boolean isEmailVerified() { return emailVerified; }
    public String getPhoneNumber() { return phoneNumber; }
    public String getSchoolName() { return schoolName; }
    public boolean isMustChangePassword() { return mustChangePassword; }
}
