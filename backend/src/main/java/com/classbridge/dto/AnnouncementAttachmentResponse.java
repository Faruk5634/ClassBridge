package com.classbridge.dto;

import java.time.Instant;

public class AnnouncementAttachmentResponse {

    private Long id;
    private String displayFilename;
    private String contentType;
    private Long size;
    private Instant createdAt;

    public AnnouncementAttachmentResponse() {
    }

    public AnnouncementAttachmentResponse(Long id, String displayFilename, String contentType, Long size, Instant createdAt) {
        this.id = id;
        this.displayFilename = displayFilename;
        this.contentType = contentType;
        this.size = size;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDisplayFilename() {
        return displayFilename;
    }

    public void setDisplayFilename(String displayFilename) {
        this.displayFilename = displayFilename;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public Long getSize() {
        return size;
    }

    public void setSize(Long size) {
        this.size = size;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
