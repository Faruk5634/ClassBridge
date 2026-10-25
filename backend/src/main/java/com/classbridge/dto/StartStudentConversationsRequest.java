package com.classbridge.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public class StartStudentConversationsRequest {
    @NotEmpty
    @Size(max = 1)
    private List<Long> studentProfileIds;

    @NotBlank
    @Size(max = 5000)
    private String message;

    public List<Long> getStudentProfileIds() { return studentProfileIds; }
    public void setStudentProfileIds(List<Long> studentProfileIds) { this.studentProfileIds = studentProfileIds; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
