package com.classbridge.repository;

import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    boolean existsByRole(UserRole role);
    Optional<UserAccount> findByUsername(String username);
    boolean existsByUsername(String username);

    @Query("SELECT CASE WHEN COUNT(u) > 0 THEN TRUE ELSE FALSE END FROM UserAccount u " +
           "WHERE u.id = :id AND u.isActive = :isActive AND u.role = :role")
    boolean existsByIdAndIsActiveAndRole(@Param("id") Long id,
                                         @Param("isActive") boolean isActive,
                                         @Param("role") UserRole role);
}
