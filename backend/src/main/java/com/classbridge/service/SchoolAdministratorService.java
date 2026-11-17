package com.classbridge.service;

import com.classbridge.domain.School;
import com.classbridge.domain.SchoolLevel;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.StaffProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.AssignSchoolAdministratorRequest;
import com.classbridge.dto.CreateSchoolAdministratorRequest;
import com.classbridge.dto.CreateSchoolAdministratorResponse;
import com.classbridge.dto.PageResponse;
import com.classbridge.dto.SchoolAdministratorProfileResponse;
import com.classbridge.dto.SchoolAdministratorSummaryResponse;
import com.classbridge.dto.UpdateSchoolAdministratorRequest;
import com.classbridge.exception.DuplicateUsernameException;
import com.classbridge.exception.InvalidRoleException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.SchoolRepository;
import com.classbridge.repository.StaffProfileRepository;
import com.classbridge.repository.UserAccountRepository;
import com.classbridge.security.InitialPasswordGenerator;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;

@Service
public class SchoolAdministratorService {

    private static final EnumSet<UserRole> ADMINISTRATOR_ROLES = EnumSet.of(UserRole.SCHOOL_ADMIN, UserRole.SCHOOL_VICE_ADMIN);

    private final SchoolRepository schoolRepository;
    private final UserAccountRepository userAccountRepository;
    private final StaffProfileRepository staffProfileRepository;
    private final SchoolMembershipRepository schoolMembershipRepository;
    private final PasswordEncoder passwordEncoder;
    private final InitialPasswordGenerator initialPasswordGenerator;

    public SchoolAdministratorService(SchoolRepository schoolRepository,
                                      UserAccountRepository userAccountRepository,
                                      StaffProfileRepository staffProfileRepository,
                                      SchoolMembershipRepository schoolMembershipRepository,
                                      PasswordEncoder passwordEncoder,
                                      InitialPasswordGenerator initialPasswordGenerator) {
        this.schoolRepository = schoolRepository;
        this.userAccountRepository = userAccountRepository;
        this.staffProfileRepository = staffProfileRepository;
        this.schoolMembershipRepository = schoolMembershipRepository;
        this.passwordEncoder = passwordEncoder;
        this.initialPasswordGenerator = initialPasswordGenerator;
    }

    @Transactional
    public CreateSchoolAdministratorResponse createAdministrator(Long schoolId, CreateSchoolAdministratorRequest request) {
        if (!ADMINISTRATOR_ROLES.contains(request.getRole())) {
            throw new InvalidRoleException("Requested role must be either SCHOOL_ADMIN or SCHOOL_VICE_ADMIN.");
        }
        if (schoolId != null && request.getSchoolId() != null && !schoolId.equals(request.getSchoolId())) {
            throw new IllegalArgumentException("School id in the request body does not match the target school.");
        }

        Long targetSchoolId = schoolId != null ? schoolId : request.getSchoolId();
        School school = null;
        if (targetSchoolId != null) {
            school = schoolRepository.findById(targetSchoolId)
                    .orElseThrow(() -> new ResourceNotFoundException("School not found with id: " + targetSchoolId));
            if (!school.isActive()) {
                throw new IllegalStateException("Administrators cannot be assigned to an archived school until it is restored.");
            }
            if (request.getRole() == UserRole.SCHOOL_ADMIN
                    && schoolMembershipRepository.existsBySchoolIdAndUserAccountRole(school.getId(), UserRole.SCHOOL_ADMIN)) {
                throw new IllegalStateException("This school already has a school administrator assigned.");
            }
        }

        if (userAccountRepository.existsByUsername(request.getUsername())) {
            throw new DuplicateUsernameException("Username is already taken: " + request.getUsername());
        }

        String initialPassword = initialPasswordGenerator.generatePassword();
        String passwordHash = passwordEncoder.encode(initialPassword);

        UserAccount account = new UserAccount();
        account.setUsername(request.getUsername());
        account.setPasswordHash(passwordHash);
        account.setRole(request.getRole());
        account.setEmail(StringUtils.hasText(request.getEmail()) ? request.getEmail().trim() : null);
        account.setPhoneNumber(StringUtils.hasText(request.getPhoneNumber()) ? request.getPhoneNumber().trim() : null);
        account.setActive(true);
        account.setMustChangePassword(true);
        UserAccount savedAccount = userAccountRepository.save(account);

        StaffProfile profile = new StaffProfile();
        profile.setUserAccount(savedAccount);
        profile.setFirstName(request.getFirstName());
        profile.setLastName(request.getLastName());
        StaffProfile savedProfile = staffProfileRepository.save(profile);

        SchoolMembership savedMembership = null;
        if (school != null) {
            SchoolMembership membership = new SchoolMembership();
            membership.setSchool(school);
            membership.setUserAccount(savedAccount);
            savedMembership = schoolMembershipRepository.save(membership);
        }

        CreateSchoolAdministratorResponse response = new CreateSchoolAdministratorResponse();
        response.setUserAccountId(savedAccount.getId());
        response.setStaffProfileId(savedProfile.getId());
        response.setSchoolMembershipId(savedMembership != null ? savedMembership.getId() : null);
        response.setSchoolId(school != null ? school.getId() : null);
        response.setUsername(savedAccount.getUsername());
        response.setPublicId(savedAccount.getMemberIdentity().getPublicId());
        response.setFirstName(savedProfile.getFirstName());
        response.setLastName(savedProfile.getLastName());
        response.setRole(savedAccount.getRole());
        response.setEmail(savedAccount.getEmail());
        response.setPhoneNumber(savedAccount.getPhoneNumber());
        response.setActive(savedAccount.isActive());
        response.setInitialPassword(initialPassword);
        response.setCreatedAt(savedAccount.getCreatedAt());

        return response;
    }

    @Transactional(readOnly = true)
    public List<SchoolAdministratorSummaryResponse> getSchoolAdministrators(Long schoolId) {
        if (!schoolRepository.existsById(schoolId)) {
            throw new ResourceNotFoundException("School not found with id: " + schoolId);
        }
        return staffProfileRepository.findAssignedSchoolAdministrators(schoolId, ADMINISTRATOR_ROLES);
    }

    @Transactional(readOnly = true)
    public List<SchoolAdministratorSummaryResponse> getAvailableAdministrators(Long schoolId) {
        if (!schoolRepository.existsById(schoolId)) {
            throw new ResourceNotFoundException("School not found with id: " + schoolId);
        }
        return staffProfileRepository.findAvailableSchoolAdministrators(ADMINISTRATOR_ROLES);
    }

    @Transactional
    public SchoolAdministratorSummaryResponse assignAdministrator(Long schoolId, AssignSchoolAdministratorRequest request) {
        if (request == null || request.getUserAccountId() == null) {
            throw new IllegalArgumentException("Administrator account id is required.");
        }
        if (request.getSchoolId() != null && !request.getSchoolId().equals(schoolId)) {
            throw new IllegalArgumentException("School id in the request body does not match the target school.");
        }

        School school = schoolRepository.findById(schoolId)
                .orElseThrow(() -> new ResourceNotFoundException("School not found with id: " + schoolId));
        if (!school.isActive()) {
            throw new IllegalStateException("Administrators cannot be assigned to an archived school until it is restored.");
        }

        UserAccount account = userAccountRepository.findByIdForUpdate(request.getUserAccountId())
                .orElseThrow(() -> new ResourceNotFoundException("Administrator account not found with id: " + request.getUserAccountId()));

        if (!ADMINISTRATOR_ROLES.contains(account.getRole())) {
            throw new InvalidRoleException("Only school administrator or vice-administrator accounts can be assigned to a school.");
        }
        if (request.getRole() != null && request.getRole() != account.getRole()) {
            throw new InvalidRoleException("Administrator role cannot be changed or upgraded during school assignment.");
        }
        if (!account.isActive()) {
            throw new IllegalStateException("Inactive administrator accounts cannot be assigned to a school.");
        }

        StaffProfile profile = staffProfileRepository.findByUserAccountId(account.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Administrator profile not found for account id: " + account.getId()));

        Optional<SchoolMembership> existingMembership = schoolMembershipRepository.findByUserAccountId(account.getId());
        if (existingMembership.isPresent()) {
            if (existingMembership.get().getSchool().getId().equals(schoolId)) {
                throw new IllegalStateException("This administrator is already assigned to this school.");
            }
            throw new IllegalStateException("This administrator is already assigned to another school.");
        }

        if (account.getRole() == UserRole.SCHOOL_ADMIN
                && schoolMembershipRepository.existsBySchoolIdAndUserAccountRole(schoolId, UserRole.SCHOOL_ADMIN)) {
            throw new IllegalStateException("This school already has a school administrator assigned.");
        }

        SchoolMembership membership = new SchoolMembership();
        membership.setSchool(school);
        membership.setUserAccount(account);
        schoolMembershipRepository.save(membership);

        return new SchoolAdministratorSummaryResponse(
                account.getId(),
                account.getMemberIdentity().getPublicId(),
                profile.getFirstName(),
                profile.getLastName(),
                account.getUsername(),
                account.getRole(),
                account.isActive(),
                school.getId(),
                school.getName(),
                school.getEducationLevel()
        );
    }

    @Transactional
    public void unassignAdministrator(Long schoolId, Long userAccountId) {
        if (!schoolRepository.existsById(schoolId)) {
            throw new ResourceNotFoundException("School not found with id: " + schoolId);
        }
        SchoolMembership membership = schoolMembershipRepository.findBySchoolIdAndUserAccountId(schoolId, userAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Administrator assignment not found for this school."));
        if (!ADMINISTRATOR_ROLES.contains(membership.getUserAccount().getRole())) {
            throw new InvalidRoleException("Only school administrator or vice-administrator assignments can be managed here.");
        }
        schoolMembershipRepository.delete(membership);
    }

    @Transactional(readOnly = true)
    public PageResponse<SchoolAdministratorSummaryResponse> getAdministrators(String query, UserRole role, SchoolLevel educationLevel,
                                                                              Long schoolId, int page, int size) {
        if (page < 0) throw new IllegalArgumentException("Page index must not be less than zero.");
        if (size < 1) throw new IllegalArgumentException("Page size must be at least 1.");
        if (role != null && !ADMINISTRATOR_ROLES.contains(role)) {
            throw new IllegalArgumentException("Role filter must be either SCHOOL_ADMIN or SCHOOL_VICE_ADMIN.");
        }
        Collection<UserRole> roles = role == null ? ADMINISTRATOR_ROLES : EnumSet.of(role);
        Collection<SchoolLevel> levels = educationLevel == null ? EnumSet.allOf(SchoolLevel.class) : EnumSet.of(educationLevel);
        Page<SchoolAdministratorSummaryResponse> result = staffProfileRepository.findSchoolAdministrators(
                roles, educationLevel == null, levels, schoolId == null, schoolId == null ? 0L : schoolId,
                StringUtils.hasText(query) ? query.trim() : "", PageRequest.of(page, Math.min(100, size)));
        return new PageResponse<>(result.getContent(), result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public SchoolAdministratorProfileResponse getAdministrator(Long userAccountId) {
        StaffProfile profile = findAdministratorProfile(userAccountId);
        return toProfileResponse(profile);
    }

    @Transactional
    public SchoolAdministratorProfileResponse updateAdministrator(Long userAccountId, UpdateSchoolAdministratorRequest request) {
        StaffProfile profile = findAdministratorProfile(userAccountId);
        UserAccount account = profile.getUserAccount();
        if (!account.isActive()) {
            throw new IllegalStateException("Archived administrator accounts cannot be edited.");
        }

        UserRole targetRole = request.getRole() != null ? request.getRole() : account.getRole();
        if (!ADMINISTRATOR_ROLES.contains(targetRole)) {
            throw new InvalidRoleException("Requested role must be either SCHOOL_ADMIN or SCHOOL_VICE_ADMIN.");
        }

        Optional<SchoolMembership> membership = schoolMembershipRepository.findByUserAccountId(account.getId());
        if (targetRole != account.getRole()) {
            if (membership.isPresent()) {
                School school = membership.get().getSchool();
                if (targetRole == UserRole.SCHOOL_ADMIN
                        && schoolMembershipRepository.existsBySchoolIdAndUserAccountRoleAndUserAccountIdNot(
                                school.getId(), UserRole.SCHOOL_ADMIN, account.getId())) {
                    throw new IllegalStateException("This school already has a school administrator assigned.");
                }
                if (account.getRole() == UserRole.SCHOOL_ADMIN && targetRole == UserRole.SCHOOL_VICE_ADMIN) {
                    long otherActiveCount = schoolMembershipRepository.countOtherActiveAdministratorsInSchool(
                            school.getId(), ADMINISTRATOR_ROLES, account.getId());
                    if (otherActiveCount == 0) {
                        throw new IllegalStateException("This administrator is the only active administrator assigned to "
                                + school.getName()
                                + ". Assign another active administrator before changing this role to vice administrator.");
                    }
                }
            }
            account.setRole(targetRole);
            account.setCredentialVersion(account.getCredentialVersion() + 1);
            userAccountRepository.saveAndFlush(account);
        }

        profile.setFirstName(request.getFirstName().trim());
        profile.setLastName(request.getLastName().trim());
        StaffProfile saved = staffProfileRepository.saveAndFlush(profile);
        return toProfileResponse(saved, membership.orElse(null));
    }

    @Transactional
    public SchoolAdministratorProfileResponse archiveAdministrator(Long userAccountId) {
        StaffProfile profile = findAdministratorProfile(userAccountId);
        UserAccount account = profile.getUserAccount();
        Optional<SchoolMembership> membership = schoolMembershipRepository.findByUserAccountId(account.getId());
        if (membership.isPresent()) {
            School school = membership.get().getSchool();
            long otherActiveCount = schoolMembershipRepository.countOtherActiveAdministratorsInSchool(
                    school.getId(), ADMINISTRATOR_ROLES, account.getId());
            if (otherActiveCount == 0) {
                throw new IllegalStateException("This administrator is the only active administrator assigned to "
                        + school.getName()
                        + ". Assign another active administrator or remove this school assignment before archiving the account.");
            }
        }
        if (account.isActive()) {
            account.setActive(false);
            account.setCredentialVersion(account.getCredentialVersion() + 1);
            userAccountRepository.saveAndFlush(account);
        }
        return toProfileResponse(profile, membership.orElse(null));
    }

    @Transactional
    public SchoolAdministratorProfileResponse restoreAdministrator(Long userAccountId) {
        StaffProfile profile = findAdministratorProfile(userAccountId);
        UserAccount account = profile.getUserAccount();
        if (!account.isActive()) {
            account.setActive(true);
            account.setCredentialVersion(account.getCredentialVersion() + 1);
            userAccountRepository.saveAndFlush(account);
        }
        return toProfileResponse(profile);
    }

    private StaffProfile findAdministratorProfile(Long userAccountId) {
        StaffProfile profile = staffProfileRepository.findByUserAccountId(userAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Administrator not found with id: " + userAccountId));
        if (!ADMINISTRATOR_ROLES.contains(profile.getUserAccount().getRole())) {
            throw new ResourceNotFoundException("Administrator not found with id: " + userAccountId);
        }
        return profile;
    }

    private SchoolAdministratorProfileResponse toProfileResponse(StaffProfile profile) {
        SchoolMembership membership = schoolMembershipRepository.findByUserAccountId(profile.getUserAccount().getId()).orElse(null);
        return toProfileResponse(profile, membership);
    }

    private SchoolAdministratorProfileResponse toProfileResponse(StaffProfile profile, SchoolMembership membership) {
        UserAccount account = profile.getUserAccount();
        School school = membership != null ? membership.getSchool() : null;
        long otherActiveCount = school != null
                ? schoolMembershipRepository.countOtherActiveAdministratorsInSchool(school.getId(), ADMINISTRATOR_ROLES, account.getId())
                : 0;
        SchoolAdministratorProfileResponse response = new SchoolAdministratorProfileResponse();
        response.setUserAccountId(account.getId());
        response.setStaffProfileId(profile.getId());
        response.setSchoolMembershipId(membership != null ? membership.getId() : null);
        response.setSchoolId(school != null ? school.getId() : null);
        response.setSchoolName(school != null ? school.getName() : null);
        response.setSchoolEducationLevel(school != null ? school.getEducationLevel() : null);
        response.setUsername(account.getUsername());
        response.setPublicId(account.getMemberIdentity().getPublicId());
        response.setFirstName(profile.getFirstName());
        response.setLastName(profile.getLastName());
        response.setRole(account.getRole());
        response.setEmail(account.getEmail());
        response.setEmailVerified(account.isEmailVerified());
        response.setPhoneNumber(account.getPhoneNumber());
        response.setActive(account.isActive());
        response.setMustChangePassword(account.isMustChangePassword());
        response.setOtherActiveAdministratorsInSchool(otherActiveCount);
        response.setCreatedAt(account.getCreatedAt() != null ? account.getCreatedAt() : profile.getCreatedAt());
        return response;
    }
}
