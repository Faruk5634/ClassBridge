package com.classbridge.dto;

public class TeacherClassroomResponse {
    private final Long id;
    private final Integer gradeLevel;
    private final String sectionName;

    public TeacherClassroomResponse(Long id, Integer gradeLevel, String sectionName) {
        this.id = id;
        this.gradeLevel = gradeLevel;
        this.sectionName = sectionName;
    }

    public Long getId() { return id; }
    public Integer getGradeLevel() { return gradeLevel; }
    public String getSectionName() { return sectionName; }
}
