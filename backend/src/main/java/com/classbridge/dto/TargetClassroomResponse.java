package com.classbridge.dto;

public class TargetClassroomResponse {

    private Long id;
    private Long classroomId;
    private Integer gradeLevel;
    private String sectionName;

    public TargetClassroomResponse() {
    }

    public TargetClassroomResponse(Long id, Integer gradeLevel, String sectionName) {
        this.id = id;
        this.classroomId = id;
        this.gradeLevel = gradeLevel;
        this.sectionName = sectionName;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
        this.classroomId = id;
    }

    public Long getClassroomId() {
        return classroomId;
    }

    public void setClassroomId(Long classroomId) {
        this.classroomId = classroomId;
        this.id = classroomId;
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
}
