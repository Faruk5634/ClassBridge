package com.classbridge.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class SendMessageRequest {
    @NotBlank
    @Size(max = 5000)
    private String message;

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
