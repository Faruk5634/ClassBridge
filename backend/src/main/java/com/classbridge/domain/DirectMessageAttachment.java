package com.classbridge.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "direct_message_attachments")
public class DirectMessageAttachment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "message_id", nullable = false)
    private DirectMessage message;

    @Column(name = "storage_key", nullable = false, unique = true, length = 255)
    private String storageKey;

    @Column(name = "display_filename", nullable = false, length = 255)
    private String displayFilename;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private Long fileSize;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public DirectMessageAttachment() { }

    public DirectMessageAttachment(DirectMessage message, String storageKey, String displayFilename, String contentType, Long fileSize) {
        this.message = message;
        this.storageKey = storageKey;
        this.displayFilename = displayFilename;
        this.contentType = contentType;
        this.fileSize = fileSize;
    }

    public Long getId() { return id; }
    public DirectMessage getMessage() { return message; }
    public void setMessage(DirectMessage message) { this.message = message; }
    public String getStorageKey() { return storageKey; }
    public String getDisplayFilename() { return displayFilename; }
    public String getContentType() { return contentType; }
    public Long getFileSize() { return fileSize; }
    public Instant getCreatedAt() { return createdAt; }
}
