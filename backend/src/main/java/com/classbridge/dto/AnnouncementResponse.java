package com.classbridge.dto;

import com.classbridge.domain.AnnouncementType;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class AnnouncementResponse {

    private Long id;
    private Long schoolId;
    private String title;
    private String body;
    private AnnouncementType type;
    private Long authorAccountId;
    private String authorDisplayName;
    private List<TargetClassroomResponse> targetClassrooms = new ArrayList<>();
    private List<AnnouncementAttachmentResponse> attachments = new ArrayList<>();
    private Instant createdAt;
    private Instant updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getSchoolId() {
        return schoolId;
    }

    public void setSchoolId(Long schoolId) {
        this.schoolId = schoolId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public AnnouncementType getType() { return type; }

    public void setType(AnnouncementType type) { this.type = type; }

    public Long getAuthorAccountId() {
        return authorAccountId;
    }

    public void setAuthorAccountId(Long authorAccountId) {
        this.authorAccountId = authorAccountId;
    }

    public String getAuthorDisplayName() {
        return authorDisplayName;
    }

    public void setAuthorDisplayName(String authorDisplayName) {
        this.authorDisplayName = authorDisplayName;
    }

    public List<TargetClassroomResponse> getTargetClassrooms() {
        return targetClassrooms;
    }

    public void setTargetClassrooms(List<TargetClassroomResponse> targetClassrooms) {
        this.targetClassrooms = targetClassrooms;
    }

    public List<AnnouncementAttachmentResponse> getAttachments() {
        return attachments;
    }

    public void setAttachments(List<AnnouncementAttachmentResponse> attachments) {
        this.attachments = attachments;
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
