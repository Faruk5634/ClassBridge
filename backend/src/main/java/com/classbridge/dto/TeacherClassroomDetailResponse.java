package com.classbridge.dto;

import java.util.List;

public class TeacherClassroomDetailResponse {
    private final Long id;
    private final Integer gradeLevel;
    private final String sectionName;
    private final List<TeacherStudentResponse> students;

    public TeacherClassroomDetailResponse(Long id, Integer gradeLevel, String sectionName,
                                          List<TeacherStudentResponse> students) {
        this.id = id;
        this.gradeLevel = gradeLevel;
        this.sectionName = sectionName;
        this.students = students;
    }

    public Long getId() { return id; }
    public Integer getGradeLevel() { return gradeLevel; }
    public String getSectionName() { return sectionName; }
    public List<TeacherStudentResponse> getStudents() { return students; }
}
