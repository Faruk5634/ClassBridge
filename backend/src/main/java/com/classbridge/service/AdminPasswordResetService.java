package com.classbridge.service;

import com.classbridge.domain.ParentProfile;
import com.classbridge.domain.RecoveryTokenPurpose;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.StudentProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.AdminPasswordResetResponse;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.repository.AccountRecoveryTokenRepository;
import com.classbridge.repository.ParentProfileRepository;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.StudentProfileRepository;
import com.classbridge.repository.UserAccountRepository;
import com.classbridge.security.InitialPasswordGenerator;
import jakarta.transaction.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;

@Service
public class AdminPasswordResetService {

    private static final Set<UserRole> SCHOOL_ADMIN_RESETTABLE_ROLES = EnumSet.of(
            UserRole.TEACHER, UserRole.PARENT, UserRole.STUDENT);
    private static final Set<UserRole> SUPERADMIN_RESETTABLE_ROLES = EnumSet.of(
            UserRole.SCHOOL_ADMIN, UserRole.SCHOOL_VICE_ADMIN);

    private final UserAccountRepository userAccountRepository;
    private final SchoolMembershipRepository schoolMembershipRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final ParentProfileRepository parentProfileRepository;
    private final AccountRecoveryTokenRepository recoveryTokenRepository;
    private final InitialPasswordGenerator initialPasswordGenerator;
    private final PasswordEncoder passwordEncoder;

    public AdminPasswordResetService(UserAccountRepository userAccountRepository,
                                     SchoolMembershipRepository schoolMembershipRepository,
                                     StudentProfileRepository studentProfileRepository,
                                     ParentProfileRepository parentProfileRepository,
                                     AccountRecoveryTokenRepository recoveryTokenRepository,
                                     InitialPasswordGenerator initialPasswordGenerator,
                                     PasswordEncoder passwordEncoder) {
        this.userAccountRepository = userAccountRepository;
        this.schoolMembershipRepository = schoolMembershipRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.parentProfileRepository = parentProfileRepository;
        this.recoveryTokenRepository = recoveryTokenRepository;
        this.initialPasswordGenerator = initialPasswordGenerator;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public AdminPasswordResetResponse resetBySuperadmin(Long actorAccountId, Long targetAccountId) {
        UserAccount target = findActiveTarget(actorAccountId, targetAccountId);
        if (!SUPERADMIN_RESETTABLE_ROLES.contains(target.getRole())
                || schoolMembershipRepository.findByUserAccountId(targetAccountId).isEmpty()) {
            throw new ResourceNotFoundException("Account not found with id: " + targetAccountId);
        }
        return reset(target);
    }

    @Transactional
    public AdminPasswordResetResponse resetBySchoolAdministrator(Long actorAccountId, Long targetAccountId) {
        SchoolMembership actorMembership = schoolMembershipRepository.findByUserAccountId(actorAccountId)
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated administrator has no school membership."));
        UserAccount target = findActiveTarget(actorAccountId, targetAccountId);
        Long schoolId = actorMembership.getSchool().getId();

        boolean authorized = switch (target.getRole()) {
            case TEACHER -> schoolMembershipRepository.findByUserAccountId(targetAccountId)
                    .map(membership -> membership.getSchool().getId().equals(schoolId))
                    .orElse(false);
            case STUDENT -> studentProfileRepository.findByUserAccountId(targetAccountId)
                    .map(profile -> profile.isActive() && profile.getSchool().getId().equals(schoolId))
                    .orElse(false);
            case PARENT -> parentProfileRepository.findByUserAccountId(targetAccountId)
                    .map(ParentProfile::getId)
                    .map(parentId -> studentProfileRepository.existsByParentProfileIdAndSchoolIdAndIsActiveTrue(parentId, schoolId))
                    .orElse(false);
            default -> false;
        };

        if (!authorized) {
            throw new ResourceNotFoundException("Account not found with id: " + targetAccountId);
        }
        return reset(target);
    }

    private UserAccount findActiveTarget(Long actorAccountId, Long targetAccountId) {
        if (actorAccountId.equals(targetAccountId)) {
            throw new ResourceNotFoundException("Account not found with id: " + targetAccountId);
        }
        return userAccountRepository.findByIdForUpdate(targetAccountId)
                .filter(UserAccount::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found with id: " + targetAccountId));
    }

    private AdminPasswordResetResponse reset(UserAccount target) {
        String temporaryPassword = initialPasswordGenerator.generatePassword();
        target.setPasswordHash(passwordEncoder.encode(temporaryPassword));
        target.setCredentialVersion(target.getCredentialVersion() + 1);
        userAccountRepository.save(target);

        Instant now = Instant.now();
        recoveryTokenRepository.invalidateOutstanding(target.getId(), RecoveryTokenPurpose.EMAIL_VERIFICATION, now);
        recoveryTokenRepository.invalidateOutstanding(target.getId(), RecoveryTokenPurpose.PASSWORD_RESET, now);

        return new AdminPasswordResetResponse(target.getId(), target.getUsername(), target.getRole(), temporaryPassword);
    }
}
