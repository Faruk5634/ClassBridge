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

    @EntityGraph(attributePaths = {"school", "classroom", "classroom.homeroomTeacher"})
    @Query("SELECT sp FROM StudentProfile sp WHERE sp.userAccount.id = :userAccountId AND sp.isActive = true")
    Optional<StudentProfile> findActiveByUserAccountId(@Param("userAccountId") Long userAccountId);

    @EntityGraph(attributePaths = {"school", "classroom", "parentProfile", "parentProfile.userAccount", "userAccount"})
    @Query("SELECT sp FROM StudentProfile sp LEFT JOIN sp.userAccount studentAccount " +
           "LEFT JOIN sp.parentProfile parent LEFT JOIN parent.userAccount parentAccount " +
           "WHERE sp.school.id = :schoolId AND sp.isActive = true " +
           "AND (LOWER(sp.firstName) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(sp.lastName) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(CONCAT(sp.firstName, ' ', sp.lastName)) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(sp.schoolNumber) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(studentAccount.username) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(parent.firstName) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(parent.lastName) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(CONCAT(parent.firstName, ' ', parent.lastName)) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(parentAccount.username) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "ORDER BY sp.lastName ASC, sp.firstName ASC, sp.id ASC")
    List<StudentProfile> searchActiveBySchoolId(@Param("schoolId") Long schoolId,
                                                @Param("query") String query,
                                                Pageable pageable);

    List<StudentProfile> findByClassroomId(Long classroomId);

    @EntityGraph(attributePaths = {"classroom", "userAccount", "parentProfile", "parentProfile.userAccount"})
    @Query("SELECT sp FROM StudentProfile sp WHERE sp.school.id = :schoolId AND sp.isActive = true " +
           "ORDER BY sp.lastName ASC, sp.firstName ASC, sp.id ASC")
    List<StudentProfile> findActiveBySchoolId(@Param("schoolId") Long schoolId);

    @EntityGraph(attributePaths = {"classroom", "userAccount", "parentProfile", "parentProfile.userAccount"})
    @Query("SELECT sp FROM StudentProfile sp WHERE sp.school.id = :schoolId AND sp.classroom.id = :classroomId AND sp.isActive = true " +
           "ORDER BY sp.lastName ASC, sp.firstName ASC, sp.id ASC")
    List<StudentProfile> findActiveBySchoolIdAndClassroomId(@Param("schoolId") Long schoolId,
                                                             @Param("classroomId") Long classroomId);

    List<StudentProfile> findByParentProfileId(Long parentProfileId);

    boolean existsByParentProfileIdAndSchoolIdAndIsActiveTrue(Long parentProfileId, Long schoolId);

    @EntityGraph(attributePaths = {"school", "classroom"})
    @Query("SELECT sp FROM StudentProfile sp WHERE sp.parentProfile.id = :parentProfileId AND sp.isActive = true ORDER BY sp.id ASC")
    List<StudentProfile> findActiveByParentProfileId(@Param("parentProfileId") Long parentProfileId);

    @EntityGraph(attributePaths = {"school", "classroom"})
    @Query("SELECT sp FROM StudentProfile sp WHERE sp.id = :id AND sp.parentProfile.id = :parentProfileId AND sp.isActive = true")
    Optional<StudentProfile> findActiveByIdAndParentProfileId(@Param("id") Long id, @Param("parentProfileId") Long parentProfileId);

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
