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
@Table(name = "direct_messages")
public class DirectMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private MessageConversation conversation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_account_id", nullable = false)
    private UserAccount sender;

    @Column(name = "body", nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(name = "read_at")
    private Instant readAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public MessageConversation getConversation() { return conversation; }
    public void setConversation(MessageConversation conversation) { this.conversation = conversation; }
    public UserAccount getSender() { return sender; }
    public void setSender(UserAccount sender) { this.sender = sender; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public Instant getReadAt() { return readAt; }
    public void setReadAt(Instant readAt) { this.readAt = readAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
