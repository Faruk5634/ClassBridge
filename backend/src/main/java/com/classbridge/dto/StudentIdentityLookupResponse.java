package com.classbridge.dto;

public class StudentIdentityLookupResponse {
    private String studentPublicId;
    private String firstName;
    private String lastName;
    private String previousSchoolNumber;
    private String previousSchoolName;
    private String studentUsername;
    private String email;
    private String phoneNumber;
    private String parentUsername;
    private boolean hasStudentAccount;

    public String getStudentPublicId() { return studentPublicId; }
    public void setStudentPublicId(String studentPublicId) { this.studentPublicId = studentPublicId; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public String getPreviousSchoolNumber() { return previousSchoolNumber; }
    public void setPreviousSchoolNumber(String previousSchoolNumber) { this.previousSchoolNumber = previousSchoolNumber; }
    public String getPreviousSchoolName() { return previousSchoolName; }
    public void setPreviousSchoolName(String previousSchoolName) { this.previousSchoolName = previousSchoolName; }
    public String getStudentUsername() { return studentUsername; }
    public void setStudentUsername(String studentUsername) { this.studentUsername = studentUsername; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public String getParentUsername() { return parentUsername; }
    public void setParentUsername(String parentUsername) { this.parentUsername = parentUsername; }
    public boolean isHasStudentAccount() { return hasStudentAccount; }
    public void setHasStudentAccount(boolean hasStudentAccount) { this.hasStudentAccount = hasStudentAccount; }
}
