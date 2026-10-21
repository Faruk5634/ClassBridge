package com.classbridge.repository;

import com.classbridge.domain.Classroom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassroomRepository extends JpaRepository<Classroom, Long> {

    List<Classroom> findBySchoolIdOrderByGradeLevelAscSectionNameAsc(Long schoolId);

    @Query("SELECT c FROM Classroom c WHERE c.school.id = :schoolId AND c.homeroomTeacher.id = :teacherAccountId " +
           "ORDER BY c.gradeLevel ASC, c.sectionName ASC")
    List<Classroom> findHomeroomClassrooms(@Param("schoolId") Long schoolId,
                                            @Param("teacherAccountId") Long teacherAccountId);

    Optional<Classroom> findByIdAndSchoolId(Long id, Long schoolId);

    boolean existsBySchoolIdAndGradeLevelAndSectionName(Long schoolId, Integer gradeLevel, String sectionName);

    boolean existsBySchoolIdAndGradeLevelAndSectionNameAndIdNot(Long schoolId, Integer gradeLevel, String sectionName, Long id);
}
