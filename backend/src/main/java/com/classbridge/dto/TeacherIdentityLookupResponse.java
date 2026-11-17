package com.classbridge.dto;

public class TeacherIdentityLookupResponse {
    private String publicId;
    private String firstName;
    private String lastName;
    private String username;
    private String email;
    private String phoneNumber;
    private String previousBranch;
    private String previousSchoolName;

    public String getPublicId() { return publicId; }
    public void setPublicId(String publicId) { this.publicId = publicId; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public String getPreviousBranch() { return previousBranch; }
    public void setPreviousBranch(String previousBranch) { this.previousBranch = previousBranch; }
    public String getPreviousSchoolName() { return previousSchoolName; }
    public void setPreviousSchoolName(String previousSchoolName) { this.previousSchoolName = previousSchoolName; }
}
