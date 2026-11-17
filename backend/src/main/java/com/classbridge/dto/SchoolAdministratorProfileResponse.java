package com.classbridge.dto;

import com.classbridge.domain.SchoolLevel;
import com.classbridge.domain.UserRole;

import java.time.Instant;

public class SchoolAdministratorProfileResponse {

    private Long userAccountId;
    private Long staffProfileId;
    private Long schoolMembershipId;
    private Long schoolId;
    private String schoolName;
    private SchoolLevel schoolEducationLevel;
    private String username;
    private String publicId;
    private String firstName;
    private String lastName;
    private UserRole role;
    private String email;
    private boolean emailVerified;
    private String phoneNumber;
    private boolean active;
    private boolean mustChangePassword;
    private long otherActiveAdministratorsInSchool;
    private Instant createdAt;

    public Long getUserAccountId() { return userAccountId; }
    public void setUserAccountId(Long userAccountId) { this.userAccountId = userAccountId; }
    public Long getStaffProfileId() { return staffProfileId; }
    public void setStaffProfileId(Long staffProfileId) { this.staffProfileId = staffProfileId; }
    public Long getSchoolMembershipId() { return schoolMembershipId; }
    public void setSchoolMembershipId(Long schoolMembershipId) { this.schoolMembershipId = schoolMembershipId; }
    public Long getSchoolId() { return schoolId; }
    public void setSchoolId(Long schoolId) { this.schoolId = schoolId; }
    public String getSchoolName() { return schoolName; }
    public void setSchoolName(String schoolName) { this.schoolName = schoolName; }
    public SchoolLevel getSchoolEducationLevel() { return schoolEducationLevel; }
    public void setSchoolEducationLevel(SchoolLevel schoolEducationLevel) { this.schoolEducationLevel = schoolEducationLevel; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPublicId() { return publicId; }
    public void setPublicId(String publicId) { this.publicId = publicId; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public UserRole getRole() { return role; }
    public void setRole(UserRole role) { this.role = role; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public boolean isEmailVerified() { return emailVerified; }
    public void setEmailVerified(boolean emailVerified) { this.emailVerified = emailVerified; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isMustChangePassword() { return mustChangePassword; }
    public void setMustChangePassword(boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }
    public long getOtherActiveAdministratorsInSchool() { return otherActiveAdministratorsInSchool; }
    public void setOtherActiveAdministratorsInSchool(long otherActiveAdministratorsInSchool) { this.otherActiveAdministratorsInSchool = otherActiveAdministratorsInSchool; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
