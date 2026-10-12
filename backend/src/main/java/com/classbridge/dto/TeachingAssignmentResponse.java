package com.classbridge.dto;

import java.time.Instant;

public class TeachingAssignmentResponse {

    private Long id;
    private Long classroomId;
    private Long teacherAccountId;
    private Instant createdAt;
    private Instant updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getClassroomId() {
        return classroomId;
    }

    public void setClassroomId(Long classroomId) {
        this.classroomId = classroomId;
    }

    public Long getTeacherAccountId() {
        return teacherAccountId;
    }

    public void setTeacherAccountId(Long teacherAccountId) {
        this.teacherAccountId = teacherAccountId;
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
}
