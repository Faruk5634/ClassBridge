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
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(
    name = "teaching_assignments",
    uniqueConstraints = {
        @UniqueConstraint(name = "uq_teaching_assignments_classroom_teacher", columnNames = {"classroom_id", "teacher_account_id"})
    }
)
public class TeachingAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "classroom_id", nullable = false)
    private Classroom classroom;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "teacher_account_id", nullable = false)
    private UserAccount teacher;

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

    public Classroom getClassroom() {
        return classroom;
    }

    public void setClassroom(Classroom classroom) {
        this.classroom = classroom;
    }

    public UserAccount getTeacher() {
        return teacher;
    }

    public void setTeacher(UserAccount teacher) {
        this.teacher = teacher;
    }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { this.isActive = active; }
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
