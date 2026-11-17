package com.classbridge.service;

import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.repository.AccountRecoveryTokenRepository;
import com.classbridge.repository.ParentProfileRepository;
import com.classbridge.repository.ParentSchoolRegistrationRepository;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.StudentProfileRepository;
import com.classbridge.repository.UserAccountRepository;
import com.classbridge.security.InitialPasswordGenerator;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminPasswordResetPolicyTests {

    @Test
    void superadminResetsForceSchoolAdministratorsToChangeTheirPassword() {
        UserAccountRepository accounts = mock(UserAccountRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        AdminPasswordResetService service = new AdminPasswordResetService(accounts,
                mock(SchoolMembershipRepository.class), mock(StudentProfileRepository.class),
                mock(ParentProfileRepository.class), mock(ParentSchoolRegistrationRepository.class),
                mock(AccountRecoveryTokenRepository.class), new InitialPasswordGenerator(), encoder);

        UserAccount target = new UserAccount();
        target.setId(5L);
        target.setUsername("school.admin");
        target.setRole(UserRole.SCHOOL_ADMIN);
        target.setActive(true);
        target.setMustChangePassword(false);
        when(accounts.findByIdForUpdate(5L)).thenReturn(Optional.of(target));
        when(encoder.encode(any())).thenReturn("temporary-hash");
        when(accounts.save(any(UserAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.resetBySuperadmin(1L, 5L);

        assertTrue(target.isMustChangePassword());
    }
}
