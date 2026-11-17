package com.classbridge.service;

import com.classbridge.domain.AccountRecoveryToken;
import com.classbridge.domain.RecoveryTokenPurpose;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.CompletePasswordResetRequest;
import com.classbridge.repository.AccountRecoveryTokenRepository;
import com.classbridge.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PasswordRecoveryPolicyTests {

    @Test
    void selfServiceResetRequiresNonSuperadminToChangeThePasswordAgain() {
        assertResetPolicy(UserRole.PARENT, true);
    }

    @Test
    void superadminSelfServiceResetDoesNotSetForcedChangeFlag() {
        assertResetPolicy(UserRole.SUPERADMIN, false);
    }

    private void assertResetPolicy(UserRole role, boolean shouldRequireChange) {
        UserAccountRepository accounts = mock(UserAccountRepository.class);
        AccountRecoveryTokenRepository tokens = mock(AccountRecoveryTokenRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        AccountRecoveryService service = new AccountRecoveryService(accounts, tokens, mock(RecoveryEmailService.class), encoder);

        UserAccount account = new UserAccount();
        account.setId(7L);
        account.setUsername("test.account");
        account.setEmail("test@example.invalid");
        account.setRole(role);
        account.setActive(true);
        account.setPasswordHash("old-hash");
        account.setMustChangePassword(false);

        AccountRecoveryToken challenge = new AccountRecoveryToken();
        challenge.setUserAccount(account);
        challenge.setPurpose(RecoveryTokenPurpose.PASSWORD_RESET);
        challenge.setTokenHash("code-hash");
        challenge.setExpiresAt(Instant.now().plusSeconds(300));

        when(accounts.findAllByEmailIgnoreCaseAndEmailVerifiedTrueAndIsActiveTrue("test@example.invalid"))
                .thenReturn(List.of(account));
        when(tokens.findOutstandingForUpdateByUserAccountIdAndPurpose(7L, RecoveryTokenPurpose.PASSWORD_RESET))
                .thenReturn(List.of(challenge));
        when(encoder.matches(any(), any())).thenAnswer(invocation ->
                "123456".equals(invocation.getArgument(0)) && "code-hash".equals(invocation.getArgument(1)));
        when(encoder.encode(any())).thenReturn("new-hash");
        when(accounts.save(any(UserAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));

        CompletePasswordResetRequest request = new CompletePasswordResetRequest();
        request.setEmail("test@example.invalid");
        request.setCode("123456");
        request.setNewPassword("new-password-123");
        service.completePasswordReset(request);

        if (shouldRequireChange) assertTrue(account.isMustChangePassword());
        else assertFalse(account.isMustChangePassword());
    }
}
