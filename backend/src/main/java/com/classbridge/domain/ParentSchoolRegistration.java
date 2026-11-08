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
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/** Records that a school registered a parent account for its directory. */
@Entity
@Table(name = "parent_school_registrations", uniqueConstraints = @UniqueConstraint(
        name = "uq_parent_school_registrations_school_parent", columnNames = {"school_id", "parent_profile_id"}))
public class ParentSchoolRegistration {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "parent_profile_id", nullable = false)
    private ParentProfile parentProfile;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "registered_by_user_account_id", nullable = false)
    private UserAccount registeredBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public School getSchool() { return school; }
    public void setSchool(School school) { this.school = school; }
    public ParentProfile getParentProfile() { return parentProfile; }
    public void setParentProfile(ParentProfile parentProfile) { this.parentProfile = parentProfile; }
    public UserAccount getRegisteredBy() { return registeredBy; }
    public void setRegisteredBy(UserAccount registeredBy) { this.registeredBy = registeredBy; }
    public Instant getCreatedAt() { return createdAt; }
}
