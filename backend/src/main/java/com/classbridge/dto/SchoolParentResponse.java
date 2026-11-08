package com.classbridge.dto;

import java.util.List;
import java.time.Instant;

public class SchoolParentResponse {
    private Long parentProfileId;
    private Long userAccountId;
    private String username;
    private String firstName;
    private String lastName;
    private String email;
    private String phoneNumber;
    private boolean active;
    private boolean emailVerified;
    private boolean mustChangePassword;
    private Instant createdAt;
    private List<String> children;

    public Long getParentProfileId() { return parentProfileId; }
    public void setParentProfileId(Long parentProfileId) { this.parentProfileId = parentProfileId; }
    public Long getUserAccountId() { return userAccountId; }
    public void setUserAccountId(Long userAccountId) { this.userAccountId = userAccountId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isEmailVerified() { return emailVerified; }
    public void setEmailVerified(boolean emailVerified) { this.emailVerified = emailVerified; }
    public boolean isMustChangePassword() { return mustChangePassword; }
    public void setMustChangePassword(boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public List<String> getChildren() { return children; }
    public void setChildren(List<String> children) { this.children = children; }
}
