package com.classbridge.repository;

import com.classbridge.domain.SchoolMembership;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface SchoolMembershipRepository extends JpaRepository<SchoolMembership, Long> {
    Optional<SchoolMembership> findByUserAccountId(Long userAccountId);

    @Query("SELECT sm FROM SchoolMembership sm JOIN FETCH sm.school WHERE sm.school.id = :schoolId AND sm.userAccount.id IN :accountIds")
    List<SchoolMembership> findBySchoolAndUserAccounts(@Param("schoolId") Long schoolId,
                                                       @Param("accountIds") Collection<Long> accountIds);
}
