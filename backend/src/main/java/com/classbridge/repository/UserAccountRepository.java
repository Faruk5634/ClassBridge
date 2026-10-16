package com.classbridge.repository;

import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    boolean existsByRole(UserRole role);
    Optional<UserAccount> findByUsername(String username);
    boolean existsByUsername(String username);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT user FROM UserAccount user WHERE user.id = :id")
    Optional<UserAccount> findByIdForUpdate(@Param("id") Long id);

    @Query("SELECT u FROM UserAccount u WHERE u.role = :role AND u.isActive = true AND " +
           "LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY u.username ASC")
    List<UserAccount> searchActiveByRole(@Param("role") UserRole role,
                                         @Param("query") String query,
                                         Pageable pageable);

    @Query("SELECT CASE WHEN COUNT(u) > 0 THEN TRUE ELSE FALSE END FROM UserAccount u " +
           "WHERE u.id = :id AND u.isActive = :isActive AND u.role = :role")
    boolean existsByIdAndIsActiveAndRole(@Param("id") Long id,
                                         @Param("isActive") boolean isActive,
                                         @Param("role") UserRole role);

    boolean existsByIdAndIsActiveAndRoleAndCredentialVersion(Long id,
                                                              boolean isActive,
                                                              UserRole role,
                                                              long credentialVersion);

    List<UserAccount> findAllByEmailIgnoreCaseAndEmailVerifiedTrueAndIsActiveTrue(String email);
}
