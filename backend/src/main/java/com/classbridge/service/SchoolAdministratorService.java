package com.classbridge.service;

import com.classbridge.domain.School;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.StaffProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.CreateSchoolAdministratorRequest;
import com.classbridge.dto.CreateSchoolAdministratorResponse;
import com.classbridge.exception.DuplicateUsernameException;
import com.classbridge.exception.InvalidRoleException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.SchoolRepository;
import com.classbridge.repository.StaffProfileRepository;
import com.classbridge.repository.UserAccountRepository;
import com.classbridge.security.InitialPasswordGenerator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class SchoolAdministratorService {

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
        if (request.getRole() != UserRole.SCHOOL_ADMIN && request.getRole() != UserRole.SCHOOL_VICE_ADMIN) {
            throw new InvalidRoleException("Requested role must be either SCHOOL_ADMIN or SCHOOL_VICE_ADMIN.");
        }

        School school = schoolRepository.findById(schoolId)
                .orElseThrow(() -> new ResourceNotFoundException("School not found with id: " + schoolId));

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
        UserAccount savedAccount = userAccountRepository.save(account);

        StaffProfile profile = new StaffProfile();
        profile.setUserAccount(savedAccount);
        profile.setFirstName(request.getFirstName());
        profile.setLastName(request.getLastName());
        StaffProfile savedProfile = staffProfileRepository.save(profile);

        SchoolMembership membership = new SchoolMembership();
        membership.setSchool(school);
        membership.setUserAccount(savedAccount);
        SchoolMembership savedMembership = schoolMembershipRepository.save(membership);

        CreateSchoolAdministratorResponse response = new CreateSchoolAdministratorResponse();
        response.setUserAccountId(savedAccount.getId());
        response.setStaffProfileId(savedProfile.getId());
        response.setSchoolMembershipId(savedMembership.getId());
        response.setSchoolId(school.getId());
        response.setUsername(savedAccount.getUsername());
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
}
