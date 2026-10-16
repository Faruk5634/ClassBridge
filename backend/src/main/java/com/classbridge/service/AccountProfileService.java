package com.classbridge.service;

import com.classbridge.domain.ParentProfile;
import com.classbridge.domain.StaffProfile;
import com.classbridge.domain.StudentProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.MyProfileResponse;
import com.classbridge.dto.UpdatePhoneNumberRequest;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.mapper.AccountProfileMapper;
import com.classbridge.repository.ParentProfileRepository;
import com.classbridge.repository.StaffProfileRepository;
import com.classbridge.repository.StudentProfileRepository;
import com.classbridge.repository.UserAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountProfileService {

    private final UserAccountRepository userAccountRepository;
    private final StaffProfileRepository staffProfileRepository;
    private final ParentProfileRepository parentProfileRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final AccountProfileMapper accountProfileMapper;

    public AccountProfileService(UserAccountRepository userAccountRepository,
                                 StaffProfileRepository staffProfileRepository,
                                 ParentProfileRepository parentProfileRepository,
                                 StudentProfileRepository studentProfileRepository,
                                 AccountProfileMapper accountProfileMapper) {
        this.userAccountRepository = userAccountRepository;
        this.staffProfileRepository = staffProfileRepository;
        this.parentProfileRepository = parentProfileRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.accountProfileMapper = accountProfileMapper;
    }

    @Transactional(readOnly = true)
    public MyProfileResponse getMyProfile(Long accountId) {
        UserAccount account = getActiveAccount(accountId);
        String firstName = null;
        String lastName = null;

        switch (account.getRole()) {
            case SCHOOL_ADMIN, SCHOOL_VICE_ADMIN, TEACHER -> {
                StaffProfile profile = staffProfileRepository.findByUserAccountId(accountId)
                        .orElseThrow(() -> new ResourceNotFoundException("Profile not found for the authenticated account."));
                firstName = profile.getFirstName();
                lastName = profile.getLastName();
            }
            case PARENT -> {
                ParentProfile profile = parentProfileRepository.findByUserAccountId(accountId)
                        .orElseThrow(() -> new ResourceNotFoundException("Profile not found for the authenticated account."));
                firstName = profile.getFirstName();
                lastName = profile.getLastName();
            }
            case STUDENT -> {
                StudentProfile profile = studentProfileRepository.findByUserAccountId(accountId)
                        .filter(StudentProfile::isActive)
                        .orElseThrow(() -> new ResourceNotFoundException("Profile not found for the authenticated account."));
                firstName = profile.getFirstName();
                lastName = profile.getLastName();
            }
            case SUPERADMIN -> { }
        }

        return accountProfileMapper.toResponse(account, firstName, lastName);
    }

    @Transactional
    public MyProfileResponse updatePhoneNumber(Long accountId, UpdatePhoneNumberRequest request) {
        UserAccount account = getActiveAccount(accountId);
        account.setPhoneNumber(request.getPhoneNumber().trim());
        UserAccount savedAccount = userAccountRepository.save(account);
        return getMyProfile(savedAccount.getId());
    }

    private UserAccount getActiveAccount(Long accountId) {
        return userAccountRepository.findById(accountId)
                .filter(UserAccount::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found with id: " + accountId));
    }
}
