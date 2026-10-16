package com.classbridge.dto;

import com.classbridge.domain.UserRole;

public class MessageRecipientResponse {
    private Long accountId;
    private UserRole role;
    private String displayName;
    private Long studentProfileId;
    private String schoolNumber;
    private Long schoolId;

    public MessageRecipientResponse(Long accountId, UserRole role, String displayName, Long studentProfileId, String schoolNumber, Long schoolId) {
        this.accountId = accountId;
        this.role = role;
        this.displayName = displayName;
        this.studentProfileId = studentProfileId;
        this.schoolNumber = schoolNumber;
        this.schoolId = schoolId;
    }
    public Long getAccountId() { return accountId; }
    public UserRole getRole() { return role; }
    public String getDisplayName() { return displayName; }
    public Long getStudentProfileId() { return studentProfileId; }
    public String getSchoolNumber() { return schoolNumber; }
    public Long getSchoolId() { return schoolId; }
}
