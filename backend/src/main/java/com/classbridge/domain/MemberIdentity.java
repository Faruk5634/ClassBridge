package com.classbridge.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.security.SecureRandom;
import java.time.Instant;

/** Stable, role-scoped public identity used to find an existing ClassBridge member. */
@Entity
@Table(name = "member_identities")
public class MemberIdentity {

    private static final SecureRandom RANDOM = new SecureRandom();

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", nullable = false, unique = true, length = 12)
    private String publicId;

    @Column(name = "identity_type", nullable = false, length = 32)
    private String identityType;

    @OneToOne(mappedBy = "memberIdentity", fetch = FetchType.LAZY)
    private UserAccount userAccount;

    @OneToOne(mappedBy = "memberIdentity", fetch = FetchType.LAZY)
    private StudentIdentity studentIdentity;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected MemberIdentity() { }

    public MemberIdentity(String identityType) {
        this.identityType = identityType;
        generatePublicId();
    }

    public static MemberIdentity forRole(UserRole role) {
        return new MemberIdentity(role.name());
    }

    public static MemberIdentity forStudent() {
        return new MemberIdentity(UserRole.STUDENT.name());
    }

    @PrePersist
    private void generatePublicId() {
        if (publicId == null || publicId.isBlank()) {
            String prefix = switch (identityType) {
                case "SUPERADMIN" -> "100";
                case "SCHOOL_ADMIN" -> "200";
                case "SCHOOL_VICE_ADMIN" -> "210";
                case "PARENT" -> "300";
                case "STUDENT" -> "400";
                case "TEACHER" -> "500";
                default -> throw new IllegalStateException("Unsupported member identity type.");
            };
            long suffix = RANDOM.nextLong(1_000_000_000L);
            publicId = prefix + String.format("%09d", suffix);
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getPublicId() { return publicId; }
    public void setPublicId(String publicId) { this.publicId = publicId; }
    public String getIdentityType() { return identityType; }
    public void setIdentityType(String identityType) { this.identityType = identityType; }
    public UserAccount getUserAccount() { return userAccount; }
    public void setUserAccount(UserAccount userAccount) { this.userAccount = userAccount; }
    public StudentIdentity getStudentIdentity() { return studentIdentity; }
    public void setStudentIdentity(StudentIdentity studentIdentity) { this.studentIdentity = studentIdentity; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
