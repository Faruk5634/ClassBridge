package com.classbridge.dto;

public class SchoolParentStudentResponse {
    private Long studentProfileId;
    private String firstName;
    private String lastName;
    private Integer gradeLevel;
    private String sectionName;
    private Long parentProfileId;
    private String parentDisplayName;

    public Long getStudentProfileId() { return studentProfileId; }
    public void setStudentProfileId(Long studentProfileId) { this.studentProfileId = studentProfileId; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public Integer getGradeLevel() { return gradeLevel; }
    public void setGradeLevel(Integer gradeLevel) { this.gradeLevel = gradeLevel; }
    public String getSectionName() { return sectionName; }
    public void setSectionName(String sectionName) { this.sectionName = sectionName; }
    public Long getParentProfileId() { return parentProfileId; }
    public void setParentProfileId(Long parentProfileId) { this.parentProfileId = parentProfileId; }
    public String getParentDisplayName() { return parentDisplayName; }
    public void setParentDisplayName(String parentDisplayName) { this.parentDisplayName = parentDisplayName; }
}
