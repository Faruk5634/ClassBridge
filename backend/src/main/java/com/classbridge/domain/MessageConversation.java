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
@Table(name = "message_conversations")
public class MessageConversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "participant_one_account_id", nullable = false)
    private UserAccount participantOne;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "participant_two_account_id", nullable = false)
    private UserAccount participantTwo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_profile_id")
    private StudentProfile studentProfile;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "last_message_at", nullable = false)
    private Instant lastMessageAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public School getSchool() { return school; }
    public void setSchool(School school) { this.school = school; }
    public UserAccount getParticipantOne() { return participantOne; }
    public void setParticipantOne(UserAccount participantOne) { this.participantOne = participantOne; }
    public UserAccount getParticipantTwo() { return participantTwo; }
    public void setParticipantTwo(UserAccount participantTwo) { this.participantTwo = participantTwo; }
    public StudentProfile getStudentProfile() { return studentProfile; }
    public void setStudentProfile(StudentProfile studentProfile) { this.studentProfile = studentProfile; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getLastMessageAt() { return lastMessageAt; }
    public void setLastMessageAt(Instant lastMessageAt) { this.lastMessageAt = lastMessageAt; }

    public boolean hasParticipant(Long accountId) {
        return participantOne.getId().equals(accountId) || participantTwo.getId().equals(accountId);
    }

    public UserAccount otherParticipant(Long accountId) {
        return participantOne.getId().equals(accountId) ? participantTwo : participantOne;
    }
}
