package com.classbridge.repository;

import com.classbridge.domain.StaffProfile;
import com.classbridge.domain.UserRole;
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
            "WHERE sm.school.id = :schoolId AND sp.userAccount.role = :role AND sp.userAccount.isActive = :active " +
            "AND (LOWER(sp.firstName) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(sp.lastName) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(CONCAT(sp.firstName, ' ', sp.lastName)) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(sp.userAccount.username) LIKE LOWER(CONCAT('%', :query, '%')) " +
            "OR LOWER(COALESCE(sp.userAccount.email, '')) LIKE LOWER(CONCAT('%', :query, '%')))",
            countQuery = "SELECT COUNT(sp) FROM StaffProfile sp JOIN SchoolMembership sm ON sm.userAccount.id = sp.userAccount.id " +
                    "WHERE sm.school.id = :schoolId AND sp.userAccount.role = :role AND sp.userAccount.isActive = :active " +
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
}
