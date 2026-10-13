package com.classbridge.repository;

import com.classbridge.domain.StudentProfile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentProfileRepository extends JpaRepository<StudentProfile, Long> {

    boolean existsBySchoolIdAndSchoolNumber(Long schoolId, String schoolNumber);

    @Query("SELECT CASE WHEN COUNT(sp) > 0 THEN TRUE ELSE FALSE END FROM StudentProfile sp " +
           "WHERE sp.school.id = :schoolId AND sp.schoolNumber = :schoolNumber AND sp.id <> :id")
    boolean existsBySchoolIdAndSchoolNumberAndIdNot(@Param("schoolId") Long schoolId,
                                                    @Param("schoolNumber") String schoolNumber,
                                                    @Param("id") Long id);

    Optional<StudentProfile> findBySchoolIdAndSchoolNumber(Long schoolId, String schoolNumber);

    Optional<StudentProfile> findByUserAccountId(Long userAccountId);

    List<StudentProfile> findByClassroomId(Long classroomId);

    List<StudentProfile> findByParentProfileId(Long parentProfileId);

    @EntityGraph(attributePaths = {"classroom", "parentProfile", "parentProfile.userAccount", "userAccount"})
    @Query("SELECT sp FROM StudentProfile sp WHERE sp.id = :id AND sp.school.id = :schoolId")
    Optional<StudentProfile> findByIdAndSchoolId(@Param("id") Long id, @Param("schoolId") Long schoolId);

    @EntityGraph(attributePaths = {"classroom", "parentProfile", "parentProfile.userAccount", "userAccount"})
    @Query("SELECT sp FROM StudentProfile sp WHERE sp.school.id = :schoolId AND sp.isActive = :isActive")
    Page<StudentProfile> findBySchoolIdAndIsActive(@Param("schoolId") Long schoolId,
                                                   @Param("isActive") boolean isActive,
                                                   Pageable pageable);

    @EntityGraph(attributePaths = {"classroom", "parentProfile", "parentProfile.userAccount", "userAccount"})
    @Query("SELECT sp FROM StudentProfile sp WHERE sp.school.id = :schoolId AND sp.classroom.id = :classroomId AND sp.isActive = :isActive")
    Page<StudentProfile> findBySchoolIdAndClassroomIdAndIsActive(@Param("schoolId") Long schoolId,
                                                                 @Param("classroomId") Long classroomId,
                                                                 @Param("isActive") boolean isActive,
                                                                 Pageable pageable);
}
