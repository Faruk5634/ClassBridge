package com.classbridge.service;

import com.classbridge.domain.UserAccount;
import com.classbridge.dto.ChangePasswordRequest;
import com.classbridge.repository.UserAccountRepository;
import jakarta.transaction.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Service
public class PasswordService {

    private static final int BCRYPT_MAX_PASSWORD_BYTES = 72;
    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final int MAX_PASSWORD_LENGTH = 20;

    private final UserAccountRepository userAccountRepository;
    private final PasswordEncoder passwordEncoder;

    public PasswordService(UserAccountRepository userAccountRepository, PasswordEncoder passwordEncoder) {
        this.userAccountRepository = userAccountRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public void changePassword(Long accountId, ChangePasswordRequest request) {
        UserAccount account = userAccountRepository.findById(accountId)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated account was not found."));

        if (!account.isActive()) {
            throw new IllegalArgumentException("Inactive accounts cannot change their password.");
        }

        if (!passwordEncoder.matches(request.getCurrentPassword(), account.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect.");
        }

        if (request.getCurrentPassword().equals(request.getNewPassword())) {
            throw new IllegalArgumentException("New password must differ from the current password.");
        }

        if (request.getNewPassword().length() < MIN_PASSWORD_LENGTH
                || request.getNewPassword().length() > MAX_PASSWORD_LENGTH) {
            throw new IllegalArgumentException("New password must be between 8 and 20 characters.");
        }

        if (request.getNewPassword().getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_PASSWORD_BYTES) {
            throw new IllegalArgumentException("New password must not exceed 72 UTF-8 bytes.");
        }

        account.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userAccountRepository.save(account);
    }
}
