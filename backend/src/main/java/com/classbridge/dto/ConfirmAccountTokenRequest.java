package com.classbridge.dto;

import jakarta.validation.constraints.NotBlank;

public class ConfirmAccountTokenRequest {

    @NotBlank
    @jakarta.validation.constraints.Pattern(regexp = "\\d{6}")
    private String code;

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }
}
