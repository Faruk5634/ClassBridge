package com.classbridge.domain;

import jakarta.persistence.Column;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/** A student's stable role identity, independent of school enrollment and login access. */
@Entity
@Table(name = "student_identities")
public class StudentIdentity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false, cascade = CascadeType.PERSIST)
    @JoinColumn(name = "member_identity_id", nullable = false, unique = true)
    private MemberIdentity memberIdentity;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected StudentIdentity() { }

    public StudentIdentity(MemberIdentity memberIdentity, String firstName, String lastName) {
        setMemberIdentity(memberIdentity);
        this.firstName = firstName;
        this.lastName = lastName;
    }

    @PrePersist
    private void ensureMemberIdentity() {
        if (memberIdentity == null) setMemberIdentity(MemberIdentity.forStudent());
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public MemberIdentity getMemberIdentity() { return memberIdentity; }
    public void setMemberIdentity(MemberIdentity memberIdentity) {
        this.memberIdentity = memberIdentity;
        if (memberIdentity != null) memberIdentity.setStudentIdentity(this);
    }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
