package com.classbridge.dto;

import com.classbridge.domain.UserRole;
import java.time.Instant;

public class ConversationResponse {
    private Long id;
    private Long schoolId;
    private Long studentProfileId;
    private String studentDisplayName;
    private Long otherParticipantAccountId;
    private String otherParticipantDisplayName;
    private AccountAppearanceResponse otherParticipantAppearance;
    private UserRole otherParticipantRole;
    private boolean readOnly;
    private long unreadCount;
    private String latestMessage;
    private Instant createdAt;
    private Instant lastMessageAt;

    public ConversationResponse(Long id, Long schoolId, Long studentProfileId, String studentDisplayName,
                                Long otherParticipantAccountId, String otherParticipantDisplayName,
                                UserRole otherParticipantRole, AccountAppearanceResponse otherParticipantAppearance, boolean readOnly, long unreadCount,
                                String latestMessage, Instant createdAt, Instant lastMessageAt) {
        this.id = id;
        this.schoolId = schoolId;
        this.studentProfileId = studentProfileId;
        this.studentDisplayName = studentDisplayName;
        this.otherParticipantAccountId = otherParticipantAccountId;
        this.otherParticipantDisplayName = otherParticipantDisplayName;
        this.otherParticipantAppearance = otherParticipantAppearance;
        this.otherParticipantRole = otherParticipantRole;
        this.readOnly = readOnly;
        this.unreadCount = unreadCount;
        this.latestMessage = latestMessage;
        this.createdAt = createdAt;
        this.lastMessageAt = lastMessageAt;
    }
    public Long getId() { return id; }
    public Long getSchoolId() { return schoolId; }
    public Long getStudentProfileId() { return studentProfileId; }
    public String getStudentDisplayName() { return studentDisplayName; }
    public Long getOtherParticipantAccountId() { return otherParticipantAccountId; }
    public String getOtherParticipantDisplayName() { return otherParticipantDisplayName; }
    public AccountAppearanceResponse getOtherParticipantAppearance() { return otherParticipantAppearance; }
    public UserRole getOtherParticipantRole() { return otherParticipantRole; }
    public boolean isReadOnly() { return readOnly; }
    public long getUnreadCount() { return unreadCount; }
    public String getLatestMessage() { return latestMessage; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getLastMessageAt() { return lastMessageAt; }
}
