package com.classbridge.repository;

import com.classbridge.domain.AccountRecoveryToken;
import com.classbridge.domain.RecoveryTokenPurpose;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface AccountRecoveryTokenRepository extends JpaRepository<AccountRecoveryToken, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT token FROM AccountRecoveryToken token " +
            "WHERE token.userAccount.id = :accountId AND token.purpose = :purpose " +
            "AND token.usedAt IS NULL ORDER BY token.createdAt DESC")
    List<AccountRecoveryToken> findOutstandingForUpdateByUserAccountIdAndPurpose(
            @Param("accountId") Long accountId,
            @Param("purpose") RecoveryTokenPurpose purpose);

    long countByUserAccountIdAndPurposeAndCreatedAtAfter(Long userAccountId,
                                                          RecoveryTokenPurpose purpose,
                                                          Instant createdAt);

    @Modifying
    @Query("UPDATE AccountRecoveryToken token SET token.usedAt = :usedAt " +
            "WHERE token.userAccount.id = :accountId AND token.purpose = :purpose AND token.usedAt IS NULL")
    int invalidateOutstanding(@Param("accountId") Long accountId,
                              @Param("purpose") RecoveryTokenPurpose purpose,
                              @Param("usedAt") Instant usedAt);
}
