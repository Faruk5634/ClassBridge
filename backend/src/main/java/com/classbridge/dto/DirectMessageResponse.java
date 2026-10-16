package com.classbridge.dto;

import com.classbridge.domain.UserRole;
import java.time.Instant;

public class DirectMessageResponse {
    private Long id;
    private Long senderAccountId;
    private String senderDisplayName;
    private UserRole senderRole;
    private boolean parentAuthored;
    private String message;
    private Instant createdAt;
    private Instant readAt;

    public DirectMessageResponse(Long id, Long senderAccountId, String senderDisplayName, UserRole senderRole,
                                 boolean parentAuthored, String message, Instant createdAt, Instant readAt) {
        this.id = id;
        this.senderAccountId = senderAccountId;
        this.senderDisplayName = senderDisplayName;
        this.senderRole = senderRole;
        this.parentAuthored = parentAuthored;
        this.message = message;
        this.createdAt = createdAt;
        this.readAt = readAt;
    }
    public Long getId() { return id; }
    public Long getSenderAccountId() { return senderAccountId; }
    public String getSenderDisplayName() { return senderDisplayName; }
    public UserRole getSenderRole() { return senderRole; }
    public boolean isParentAuthored() { return parentAuthored; }
    public String getMessage() { return message; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getReadAt() { return readAt; }
}
