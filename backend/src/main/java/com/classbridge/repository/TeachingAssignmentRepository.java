package com.classbridge.repository;

import com.classbridge.domain.TeachingAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeachingAssignmentRepository extends JpaRepository<TeachingAssignment, Long> {

    List<TeachingAssignment> findByClassroomIdOrderByCreatedAtAsc(Long classroomId);

    Optional<TeachingAssignment> findByClassroomIdAndTeacherId(Long classroomId, Long teacherAccountId);

    boolean existsByClassroomIdAndTeacherId(Long classroomId, Long teacherAccountId);
}
