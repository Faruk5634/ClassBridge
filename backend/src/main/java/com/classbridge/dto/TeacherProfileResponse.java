package com.classbridge.dto;

import java.time.Instant;
import java.util.List;

public class TeacherProfileResponse {

    private Long userAccountId;
    private Long staffProfileId;
    private Long schoolMembershipId;
    private Long schoolId;
    private String username;
    private String firstName;
    private String lastName;
    private String branch;
    private String email;
    private boolean emailVerified;
    private String phoneNumber;
    private boolean active;
    private boolean mustChangePassword;
    private List<TeacherHomeroomClassroomResponse> homeroomClassrooms;
    private Instant createdAt;

    public Long getUserAccountId() { return userAccountId; }
    public void setUserAccountId(Long userAccountId) { this.userAccountId = userAccountId; }
    public Long getStaffProfileId() { return staffProfileId; }
    public void setStaffProfileId(Long staffProfileId) { this.staffProfileId = staffProfileId; }
    public Long getSchoolMembershipId() { return schoolMembershipId; }
    public void setSchoolMembershipId(Long schoolMembershipId) { this.schoolMembershipId = schoolMembershipId; }
    public Long getSchoolId() { return schoolId; }
    public void setSchoolId(Long schoolId) { this.schoolId = schoolId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
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
    public List<TeacherHomeroomClassroomResponse> getHomeroomClassrooms() { return homeroomClassrooms; }
    public void setHomeroomClassrooms(List<TeacherHomeroomClassroomResponse> homeroomClassrooms) { this.homeroomClassrooms = homeroomClassrooms; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
