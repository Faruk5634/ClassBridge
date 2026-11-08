package com.classbridge.dto;

import java.time.Instant;

public class StudentProfileResponse {

    private Long id;
    private String schoolNumber;
    private String firstName;
    private String lastName;
    private Long schoolId;
    private Long classroomId;
    private Integer gradeLevel;
    private String sectionName;
    private boolean active;
    private Instant createdAt;
    private Instant updatedAt;

    private Long parentProfileId;
    private String parentFirstName;
    private String parentLastName;
    private String parentUsername;

    private Long studentUserAccountId;
    private String studentUsername;
    private String studentEmail;
    private boolean studentEmailVerified;
    private String studentPhoneNumber;
    private boolean mustChangePassword;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSchoolNumber() {
        return schoolNumber;
    }

    public void setSchoolNumber(String schoolNumber) {
        this.schoolNumber = schoolNumber;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public Long getSchoolId() {
        return schoolId;
    }

    public void setSchoolId(Long schoolId) {
        this.schoolId = schoolId;
    }

    public Long getClassroomId() {
        return classroomId;
    }

    public void setClassroomId(Long classroomId) {
        this.classroomId = classroomId;
    }

    public Integer getGradeLevel() {
        return gradeLevel;
    }

    public void setGradeLevel(Integer gradeLevel) {
        this.gradeLevel = gradeLevel;
    }

    public String getSectionName() {
        return sectionName;
    }

    public void setSectionName(String sectionName) {
        this.sectionName = sectionName;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Long getParentProfileId() {
        return parentProfileId;
    }

    public void setParentProfileId(Long parentProfileId) {
        this.parentProfileId = parentProfileId;
    }

    public String getParentFirstName() {
        return parentFirstName;
    }

    public void setParentFirstName(String parentFirstName) {
        this.parentFirstName = parentFirstName;
    }

    public String getParentLastName() {
        return parentLastName;
    }

    public void setParentLastName(String parentLastName) {
        this.parentLastName = parentLastName;
    }

    public String getParentUsername() {
        return parentUsername;
    }

    public void setParentUsername(String parentUsername) {
        this.parentUsername = parentUsername;
    }

    public Long getStudentUserAccountId() {
        return studentUserAccountId;
    }

    public void setStudentUserAccountId(Long studentUserAccountId) {
        this.studentUserAccountId = studentUserAccountId;
    }

    public String getStudentUsername() {
        return studentUsername;
    }

    public void setStudentUsername(String studentUsername) {
        this.studentUsername = studentUsername;
    }

    public String getStudentEmail() { return studentEmail; }

    public void setStudentEmail(String studentEmail) { this.studentEmail = studentEmail; }

    public boolean isStudentEmailVerified() { return studentEmailVerified; }

    public void setStudentEmailVerified(boolean studentEmailVerified) { this.studentEmailVerified = studentEmailVerified; }

    public String getStudentPhoneNumber() { return studentPhoneNumber; }

    public void setStudentPhoneNumber(String studentPhoneNumber) { this.studentPhoneNumber = studentPhoneNumber; }

    public boolean isMustChangePassword() { return mustChangePassword; }

    public void setMustChangePassword(boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }
}
