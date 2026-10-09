package com.classbridge.repository;

import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    boolean existsByRole(UserRole role);
    Optional<UserAccount> findByUsername(String username);
}
