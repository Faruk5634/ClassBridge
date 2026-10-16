package com.classbridge.service;

import com.classbridge.domain.AccountRecoveryToken;
import com.classbridge.domain.RecoveryTokenPurpose;
import com.classbridge.domain.UserAccount;
import com.classbridge.dto.CompletePasswordResetRequest;
import com.classbridge.dto.UpdateEmailRequest;
import com.classbridge.exception.InvalidRecoveryCodeException;
import com.classbridge.repository.AccountRecoveryTokenRepository;
import com.classbridge.repository.UserAccountRepository;
import jakarta.transaction.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class AccountRecoveryService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int CODE_LIFETIME_MINUTES = 30;
    private static final int RATE_LIMIT_WINDOW_MINUTES = 1;
    private static final int MAX_CODE_ATTEMPTS = 5;
    private static final int BCRYPT_MAX_PASSWORD_BYTES = 72;
    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final int MAX_PASSWORD_LENGTH = 20;

    private final UserAccountRepository userAccountRepository;
    private final AccountRecoveryTokenRepository tokenRepository;
    private final RecoveryEmailService recoveryEmailService;
    private final PasswordEncoder passwordEncoder;

    public AccountRecoveryService(UserAccountRepository userAccountRepository,
                                  AccountRecoveryTokenRepository tokenRepository,
                                  RecoveryEmailService recoveryEmailService,
                                  PasswordEncoder passwordEncoder) {
        this.userAccountRepository = userAccountRepository;
        this.tokenRepository = tokenRepository;
        this.recoveryEmailService = recoveryEmailService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public void updateEmail(Long accountId, UpdateEmailRequest request) {
        UserAccount account = userAccountRepository.findById(accountId)
                .filter(UserAccount::isActive)
                .orElseThrow(() -> new IllegalArgumentException("Account is not available."));
        String newEmail = request.getEmail().trim();
        if (account.getEmail() != null && account.getEmail().equalsIgnoreCase(newEmail)) {
            return;
        }

        account.setEmail(newEmail);
        account.setEmailVerified(false);
        userAccountRepository.save(account);

        Instant now = Instant.now();
        tokenRepository.invalidateOutstanding(accountId, RecoveryTokenPurpose.EMAIL_VERIFICATION, now);
        tokenRepository.invalidateOutstanding(accountId, RecoveryTokenPurpose.PASSWORD_RESET, now);
    }

    @Transactional
    public void requestEmailVerification(Long accountId) {
        if (!recoveryEmailService.isConfigured()) {
            throw new IllegalStateException("Email delivery is not configured.");
        }

        UserAccount account = userAccountRepository.findById(accountId)
                .filter(UserAccount::isActive)
                .orElseThrow(() -> new IllegalArgumentException("Account is not available."));
        if (account.getEmail() == null || account.getEmail().isBlank()) {
            throw new IllegalArgumentException("An email address must be added before it can be verified.");
        }
        if (account.isEmailVerified()) {
            return;
        }
        if (requestedRecently(account.getId(), RecoveryTokenPurpose.EMAIL_VERIFICATION)) {
            throw new RateLimitException();
        }

        String code = issueCode(account, RecoveryTokenPurpose.EMAIL_VERIFICATION);
        if (!recoveryEmailService.sendVerificationCode(account.getEmail(), code)) {
            tokenRepository.invalidateOutstanding(account.getId(), RecoveryTokenPurpose.EMAIL_VERIFICATION, Instant.now());
            throw new IllegalStateException("Email delivery failed.");
        }
    }

    @Transactional(dontRollbackOn = InvalidRecoveryCodeException.class)
    public void confirmEmailVerification(Long accountId, String code) {
        UserAccount account = userAccountRepository.findById(accountId)
                .filter(UserAccount::isActive)
                .orElseThrow(InvalidRecoveryCodeException::new);
        if (account.isEmailVerified()) {
            return;
        }
        AccountRecoveryToken challenge = findCurrentCode(accountId, RecoveryTokenPurpose.EMAIL_VERIFICATION);
        validateCode(challenge, code);

        Instant now = Instant.now();
        challenge.setUsedAt(now);
        account.setEmailVerified(true);
        tokenRepository.save(challenge);
        userAccountRepository.save(account);
    }

    @Transactional
    public void requestPasswordReset(String email) {
        if (!recoveryEmailService.isConfigured()) {
            throw new IllegalStateException("Email delivery is not configured.");
        }

        List<UserAccount> accounts = userAccountRepository
                .findAllByEmailIgnoreCaseAndEmailVerifiedTrueAndIsActiveTrue(email.trim());
        if (accounts.size() != 1) {
            return;
        }

        UserAccount account = accounts.get(0);
        if (requestedRecently(account.getId(), RecoveryTokenPurpose.PASSWORD_RESET)) {
            return;
        }

        String code = issueCode(account, RecoveryTokenPurpose.PASSWORD_RESET);
        if (!recoveryEmailService.sendPasswordResetCode(account.getEmail(), code)) {
            tokenRepository.invalidateOutstanding(account.getId(), RecoveryTokenPurpose.PASSWORD_RESET, Instant.now());
        }
    }

    @Transactional(dontRollbackOn = InvalidRecoveryCodeException.class)
    public void completePasswordReset(CompletePasswordResetRequest request) {
        validateNewPassword(request.getNewPassword());
        List<UserAccount> accounts = userAccountRepository
                .findAllByEmailIgnoreCaseAndEmailVerifiedTrueAndIsActiveTrue(request.getEmail().trim());
        if (accounts.size() != 1) {
            throw new InvalidRecoveryCodeException();
        }
        UserAccount account = accounts.get(0);
        AccountRecoveryToken challenge = findCurrentCode(account.getId(), RecoveryTokenPurpose.PASSWORD_RESET);
        validateCode(challenge, request.getCode());
        if (passwordEncoder.matches(request.getNewPassword(), account.getPasswordHash())) {
            throw new IllegalArgumentException("New password must differ from the current password.");
        }

        Instant now = Instant.now();
        challenge.setUsedAt(now);
        account.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        account.setCredentialVersion(account.getCredentialVersion() + 1);
        tokenRepository.save(challenge);
        tokenRepository.invalidateOutstanding(account.getId(), RecoveryTokenPurpose.PASSWORD_RESET, now);
        userAccountRepository.save(account);
    }

    private String issueCode(UserAccount account, RecoveryTokenPurpose purpose) {
        Instant now = Instant.now();
        tokenRepository.invalidateOutstanding(account.getId(), purpose, now);

        String code = String.format(java.util.Locale.ROOT, "%06d", SECURE_RANDOM.nextInt(1_000_000));

        AccountRecoveryToken token = new AccountRecoveryToken();
        token.setUserAccount(account);
        token.setTokenHash(passwordEncoder.encode(code));
        token.setPurpose(purpose);
        token.setExpiresAt(now.plus(CODE_LIFETIME_MINUTES, ChronoUnit.MINUTES));
        tokenRepository.save(token);
        return code;
    }

    private AccountRecoveryToken findCurrentCode(Long accountId, RecoveryTokenPurpose purpose) {
        AccountRecoveryToken challenge = tokenRepository
                .findOutstandingForUpdateByUserAccountIdAndPurpose(accountId, purpose)
                .stream()
                .findFirst()
                .orElseThrow(InvalidRecoveryCodeException::new);
        if (!challenge.getExpiresAt().isAfter(Instant.now())
                || challenge.getFailedAttempts() >= MAX_CODE_ATTEMPTS) {
            challenge.setUsedAt(Instant.now());
            tokenRepository.save(challenge);
            throw new InvalidRecoveryCodeException();
        }
        return challenge;
    }

    private void validateCode(AccountRecoveryToken challenge, String code) {
        if (code == null || !passwordEncoder.matches(code, challenge.getTokenHash())) {
            challenge.setFailedAttempts(challenge.getFailedAttempts() + 1);
            if (challenge.getFailedAttempts() >= MAX_CODE_ATTEMPTS) {
                challenge.setUsedAt(Instant.now());
            }
            tokenRepository.save(challenge);
            throw new InvalidRecoveryCodeException();
        }
    }

    private boolean requestedRecently(Long accountId, RecoveryTokenPurpose purpose) {
        Instant threshold = Instant.now().minus(RATE_LIMIT_WINDOW_MINUTES, ChronoUnit.MINUTES);
        return tokenRepository.countByUserAccountIdAndPurposeAndCreatedAtAfter(accountId, purpose, threshold) > 0;
    }

    private void validateNewPassword(String password) {
        if (password.length() < MIN_PASSWORD_LENGTH || password.length() > MAX_PASSWORD_LENGTH) {
            throw new IllegalArgumentException("New password must be between 8 and 20 characters.");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_PASSWORD_BYTES) {
            throw new IllegalArgumentException("New password must not exceed 72 UTF-8 bytes.");
        }
    }

    public static class RateLimitException extends RuntimeException {
        public RateLimitException() {
            super("Please wait before requesting another verification email.");
        }
    }
}
