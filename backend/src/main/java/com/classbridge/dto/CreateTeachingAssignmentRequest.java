package com.classbridge.dto;

import jakarta.validation.constraints.NotNull;

public class CreateTeachingAssignmentRequest {

    @NotNull
    private Long teacherAccountId;

    public Long getTeacherAccountId() {
        return teacherAccountId;
    }

    public void setTeacherAccountId(Long teacherAccountId) {
        this.teacherAccountId = teacherAccountId;
    }
}
