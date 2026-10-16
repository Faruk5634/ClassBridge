package com.classbridge.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CreateConversationRequest {
    private Long recipientAccountId;
    private Long studentProfileId;

    @NotBlank
    @Size(max = 5000)
    private String message;

    public Long getRecipientAccountId() { return recipientAccountId; }
    public void setRecipientAccountId(Long recipientAccountId) { this.recipientAccountId = recipientAccountId; }
    public Long getStudentProfileId() { return studentProfileId; }
    public void setStudentProfileId(Long studentProfileId) { this.studentProfileId = studentProfileId; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
