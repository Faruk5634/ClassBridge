package com.classbridge.dto;

import java.time.Instant;

public class MessageAttachmentResponse {
    private final Long id;
    private final String displayFilename;
    private final String contentType;
    private final Long size;
    private final Instant createdAt;

    public MessageAttachmentResponse(Long id, String displayFilename, String contentType, Long size, Instant createdAt) {
        this.id = id;
        this.displayFilename = displayFilename;
        this.contentType = contentType;
        this.size = size;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public String getDisplayFilename() { return displayFilename; }
    public String getContentType() { return contentType; }
    public Long getSize() { return size; }
    public Instant getCreatedAt() { return createdAt; }
}
