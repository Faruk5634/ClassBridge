package com.classbridge.repository;

import com.classbridge.domain.SchoolMembership;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SchoolMembershipRepository extends JpaRepository<SchoolMembership, Long> {
    Optional<SchoolMembership> findByUserAccountId(Long userAccountId);
}
