package com.classbridge.repository;

import com.classbridge.domain.Classroom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassroomRepository extends JpaRepository<Classroom, Long> {

    List<Classroom> findBySchoolIdOrderByGradeLevelAscSectionNameAsc(Long schoolId);

    Optional<Classroom> findByIdAndSchoolId(Long id, Long schoolId);

    boolean existsBySchoolIdAndGradeLevelAndSectionName(Long schoolId, Integer gradeLevel, String sectionName);

    boolean existsBySchoolIdAndGradeLevelAndSectionNameAndIdNot(Long schoolId, Integer gradeLevel, String sectionName, Long id);
}
