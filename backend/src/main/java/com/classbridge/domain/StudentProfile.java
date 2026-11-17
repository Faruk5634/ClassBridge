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
import jakarta.persistence.Transient;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(
    name = "student_profiles",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_student_profiles_school_school_number", columnNames = {"school_id", "school_number"})
    }
)
public class StudentProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "school_id", nullable = false)
    private School school;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_identity_id", nullable = false)
    private StudentIdentity studentIdentity;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "classroom_id", nullable = false)
    private Classroom classroom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_profile_id")
    private ParentProfile parentProfile;

    @Column(name = "school_number", nullable = false, length = 50)
    private String schoolNumber;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "archived_by_school", nullable = false)
    private boolean archivedBySchool;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public School getSchool() {
        return school;
    }

    public StudentIdentity getStudentIdentity() { return studentIdentity; }

    public void setStudentIdentity(StudentIdentity studentIdentity) { this.studentIdentity = studentIdentity; }

    @Transient
    public UserAccount getUserAccount() {
        return studentIdentity == null || studentIdentity.getMemberIdentity() == null
                ? null : studentIdentity.getMemberIdentity().getUserAccount();
    }

    /** Compatibility helper for older fixtures; production persistence uses StudentIdentity. */
    public void setUserAccount(UserAccount account) {
        if (account == null) return;
        com.classbridge.domain.MemberIdentity identity = account.getMemberIdentity();
        if (identity == null) {
            identity = com.classbridge.domain.MemberIdentity.forRole(UserRole.STUDENT);
            account.setMemberIdentity(identity);
        }
        setStudentIdentity(new StudentIdentity(identity, firstName, lastName));
    }

    public void setSchool(School school) {
        this.school = school;
    }

    public Classroom getClassroom() {
        return classroom;
    }

    public void setClassroom(Classroom classroom) {
        this.classroom = classroom;
    }

    public ParentProfile getParentProfile() {
        return parentProfile;
    }

    public void setParentProfile(ParentProfile parentProfile) {
        this.parentProfile = parentProfile;
    }

    public String getSchoolNumber() {
        return schoolNumber;
    }

    public void setSchoolNumber(String schoolNumber) {
        this.schoolNumber = schoolNumber;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean active) {
        this.isActive = active;
    }

    public boolean isArchivedBySchool() { return archivedBySchool; }
    public void setArchivedBySchool(boolean archivedBySchool) { this.archivedBySchool = archivedBySchool; }

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
