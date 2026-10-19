package com.classbridge.dto;

public class TeacherStudentResponse {
    private final Long id;
    private final String schoolNumber;
    private final String firstName;
    private final String lastName;
    private final Long classroomId;
    private final Integer gradeLevel;
    private final String sectionName;

    public TeacherStudentResponse(Long id, String schoolNumber, String firstName, String lastName,
                                  Long classroomId, Integer gradeLevel, String sectionName) {
        this.id = id;
        this.schoolNumber = schoolNumber;
        this.firstName = firstName;
        this.lastName = lastName;
        this.classroomId = classroomId;
        this.gradeLevel = gradeLevel;
        this.sectionName = sectionName;
    }

    public Long getId() { return id; }
    public String getSchoolNumber() { return schoolNumber; }
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public Long getClassroomId() { return classroomId; }
    public Integer getGradeLevel() { return gradeLevel; }
    public String getSectionName() { return sectionName; }
}
