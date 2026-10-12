package com.classbridge.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class ClassroomRequest {

    @NotNull
    @Min(1)
    @Max(12)
    private Integer gradeLevel;

    @NotBlank
    @Size(max = 20)
    private String sectionName;

    @NotNull
    private Long homeroomTeacherAccountId;

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

    public Long getHomeroomTeacherAccountId() {
        return homeroomTeacherAccountId;
    }

    public void setHomeroomTeacherAccountId(Long homeroomTeacherAccountId) {
        this.homeroomTeacherAccountId = homeroomTeacherAccountId;
    }
}
