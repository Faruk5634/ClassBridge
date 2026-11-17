package com.classbridge.repository;

import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.UserRole;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface SchoolMembershipRepository extends JpaRepository<SchoolMembership, Long> {
    List<SchoolMembership> findAllBySchoolId(Long schoolId);
    Optional<SchoolMembership> findByUserAccountId(Long userAccountId);

    Optional<SchoolMembership> findBySchoolIdAndUserAccountId(Long schoolId, Long userAccountId);

    boolean existsBySchoolIdAndUserAccountRole(Long schoolId, UserRole role);

    boolean existsBySchoolIdAndUserAccountRoleAndUserAccountIdNot(Long schoolId, UserRole role, Long userAccountId);

    @Query("SELECT COUNT(sm) FROM SchoolMembership sm JOIN sm.userAccount ua WHERE sm.school.id = :schoolId AND ua.isActive = true AND ua.role IN :roles AND ua.id <> :excludedAccountId")
    long countOtherActiveAdministratorsInSchool(@Param("schoolId") Long schoolId,
                                                @Param("roles") Collection<UserRole> roles,
                                                @Param("excludedAccountId") Long excludedAccountId);

    @Query("SELECT sm FROM SchoolMembership sm JOIN FETCH sm.school WHERE sm.school.id = :schoolId AND sm.userAccount.id IN :accountIds")
    List<SchoolMembership> findBySchoolAndUserAccounts(@Param("schoolId") Long schoolId,
                                                       @Param("accountIds") Collection<Long> accountIds);
}
