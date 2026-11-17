package com.classbridge.repository;

import com.classbridge.domain.StudentIdentity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StudentIdentityRepository extends JpaRepository<StudentIdentity, Long> {

    @EntityGraph(attributePaths = {"memberIdentity", "memberIdentity.userAccount"})
    Optional<StudentIdentity> findByMemberIdentityPublicId(String publicId);
}
