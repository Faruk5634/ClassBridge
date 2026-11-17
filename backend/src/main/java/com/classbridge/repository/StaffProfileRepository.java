package com.classbridge.repository;

import com.classbridge.domain.StaffProfile;
import com.classbridge.domain.SchoolLevel;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.SchoolAdministratorSummaryResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface StaffProfileRepository extends JpaRepository<StaffProfile, Long> {
    Optional<StaffProfile> findByUserAccountId(Long userAccountId);

    @EntityGraph(attributePaths = {"userAccount"})
    @Query(value = "SELECT sp FROM StaffProfile sp JOIN SchoolMembership sm ON sm.userAccount.id = sp.userAccount.id " +
            "WHERE sm.school.id = :schoolId AND sm.isActive = :active AND sp.userAccount.role = :role AND sp.userAccount.isActive = :active " +
            "AND (LOWER(sp.firstName) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(sp.lastName) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(CONCAT(sp.firstName, ' ', sp.lastName)) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(sp.userAccount.username) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(COALESCE(sp.userAccount.email, '')) LIKE LOWER(CONCAT('%', :query, '%')))",
            countQuery = "SELECT COUNT(sp) FROM StaffProfile sp JOIN SchoolMembership sm ON sm.userAccount.id = sp.userAccount.id " +
                    "WHERE sm.school.id = :schoolId AND sm.isActive = :active AND sp.userAccount.role = :role AND sp.userAccount.isActive = :active " +
                    "AND (LOWER(sp.firstName) LIKE LOWER(CONCAT('%', :query, '%')) " +
                    "OR LOWER(sp.lastName) LIKE LOWER(CONCAT('%', :query, '%')) " +
                    "OR LOWER(CONCAT(sp.firstName, ' ', sp.lastName)) LIKE LOWER(CONCAT('%', :query, '%')) " +
                    "OR LOWER(sp.userAccount.username) LIKE LOWER(CONCAT('%', :query, '%')) " +
                    "OR LOWER(COALESCE(sp.userAccount.email, '')) LIKE LOWER(CONCAT('%', :query, '%'))) ")
    Page<StaffProfile> findSchoolTeachers(@Param("schoolId") Long schoolId,
                                          @Param("role") UserRole role,
                                          @Param("active") boolean active,
                                          @Param("query") String query,
                                          Pageable pageable);

    @Query("SELECT sp FROM StaffProfile sp WHERE sp.userAccount.id IN :accountIds")
    List<StaffProfile> findByUserAccountIdIn(@Param("accountIds") Collection<Long> accountIds);

    @EntityGraph(attributePaths = {"userAccount"})
    @Query("SELECT sp FROM StaffProfile sp JOIN SchoolMembership sm ON sm.userAccount.id = sp.userAccount.id " +
           "WHERE sm.school.id = :schoolId AND sp.userAccount.isActive = true AND sp.userAccount.id <> :actorId " +
           "AND sp.userAccount.role IN :roles AND " +
           "(LOWER(sp.firstName) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(sp.lastName) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(CONCAT(sp.firstName, ' ', sp.lastName)) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "OR LOWER(sp.userAccount.username) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "ORDER BY sp.lastName ASC, sp.firstName ASC")
    List<StaffProfile> searchBySchoolAndRoles(@Param("schoolId") Long schoolId,
                                              @Param("actorId") Long actorId,
                                              @Param("roles") Collection<UserRole> roles,
                                              @Param("query") String query,
                                              Pageable pageable);

    @Query(value = "SELECT new com.classbridge.dto.SchoolAdministratorSummaryResponse(ua.id, ua.memberIdentity.publicId, sp.firstName, sp.lastName, ua.username, ua.role, ua.isActive, s.id, s.name, s.educationLevel) " +
            "FROM StaffProfile sp JOIN sp.userAccount ua LEFT JOIN SchoolMembership sm ON sm.userAccount.id = ua.id LEFT JOIN sm.school s " +
            "WHERE ua.role IN :roles AND (:anyLevel = true OR s.educationLevel IN :levels) AND (:anySchool = true OR s.id = :schoolId) " +
            "AND (:query = '' OR LOWER(sp.firstName) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(sp.lastName) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(CONCAT(sp.firstName, ' ', sp.lastName)) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(ua.username) LIKE LOWER(CONCAT('%', :query, '%'))) " +
            "ORDER BY sp.lastName ASC, sp.firstName ASC, ua.id ASC",
            countQuery = "SELECT COUNT(sp) FROM StaffProfile sp JOIN sp.userAccount ua LEFT JOIN SchoolMembership sm ON sm.userAccount.id = ua.id LEFT JOIN sm.school s " +
                    "WHERE ua.role IN :roles AND (:anyLevel = true OR s.educationLevel IN :levels) AND (:anySchool = true OR s.id = :schoolId) " +
                    "AND (:query = '' OR LOWER(sp.firstName) LIKE LOWER(CONCAT('%', :query, '%')) " +
                    "OR LOWER(sp.lastName) LIKE LOWER(CONCAT('%', :query, '%')) " +
                    "OR LOWER(CONCAT(sp.firstName, ' ', sp.lastName)) LIKE LOWER(CONCAT('%', :query, '%')) " +
                    "OR LOWER(ua.username) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<SchoolAdministratorSummaryResponse> findSchoolAdministrators(@Param("roles") Collection<UserRole> roles,
                                                                      @Param("anyLevel") boolean anyLevel,
                                                                      @Param("levels") Collection<SchoolLevel> levels,
                                                                      @Param("anySchool") boolean anySchool,
                                                                      @Param("schoolId") Long schoolId,
                                                                      @Param("query") String query,
                                                                      Pageable pageable);

    @Query("SELECT new com.classbridge.dto.SchoolAdministratorSummaryResponse(ua.id, ua.memberIdentity.publicId, sp.firstName, sp.lastName, ua.username, ua.role, ua.isActive, s.id, s.name, s.educationLevel) " +
            "FROM StaffProfile sp JOIN sp.userAccount ua JOIN SchoolMembership sm ON sm.userAccount.id = ua.id JOIN sm.school s " +
            "WHERE s.id = :schoolId AND ua.role IN :roles " +
            "ORDER BY CASE WHEN ua.role = com.classbridge.domain.UserRole.SCHOOL_ADMIN THEN 0 ELSE 1 END, sp.lastName ASC, sp.firstName ASC, ua.id ASC")
    List<SchoolAdministratorSummaryResponse> findAssignedSchoolAdministrators(@Param("schoolId") Long schoolId,
                                                                              @Param("roles") Collection<UserRole> roles);

    @Query("SELECT new com.classbridge.dto.SchoolAdministratorSummaryResponse(ua.id, ua.memberIdentity.publicId, sp.firstName, sp.lastName, ua.username, ua.role, ua.isActive, s.id, s.name, s.educationLevel) " +
            "FROM StaffProfile sp JOIN sp.userAccount ua LEFT JOIN SchoolMembership sm ON sm.userAccount.id = ua.id LEFT JOIN sm.school s " +
            "WHERE ua.role IN :roles AND ua.isActive = true AND sm.id IS NULL " +
            "ORDER BY CASE WHEN ua.role = com.classbridge.domain.UserRole.SCHOOL_ADMIN THEN 0 ELSE 1 END, sp.lastName ASC, sp.firstName ASC, ua.id ASC")
    List<SchoolAdministratorSummaryResponse> findAvailableSchoolAdministrators(@Param("roles") Collection<UserRole> roles);
}
