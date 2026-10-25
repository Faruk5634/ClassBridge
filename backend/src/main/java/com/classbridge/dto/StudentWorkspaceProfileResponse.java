package com.classbridge.dto;

public class StudentWorkspaceProfileResponse {
    private Long studentProfileId;
    private Long schoolId;
    private String schoolName;
    private Long classroomId;
    private Integer gradeLevel;
    private String sectionName;
    private String homeroomTeacherName;

    public StudentWorkspaceProfileResponse(Long studentProfileId, Long schoolId, String schoolName,
                                           Long classroomId, Integer gradeLevel, String sectionName,
                                           String homeroomTeacherName) {
        this.studentProfileId = studentProfileId;
        this.schoolId = schoolId;
        this.schoolName = schoolName;
        this.classroomId = classroomId;
        this.gradeLevel = gradeLevel;
        this.sectionName = sectionName;
        this.homeroomTeacherName = homeroomTeacherName;
    }

    public Long getStudentProfileId() { return studentProfileId; }
    public Long getSchoolId() { return schoolId; }
    public String getSchoolName() { return schoolName; }
    public Long getClassroomId() { return classroomId; }
    public Integer getGradeLevel() { return gradeLevel; }
    public String getSectionName() { return sectionName; }
    public String getHomeroomTeacherName() { return homeroomTeacherName; }
}
