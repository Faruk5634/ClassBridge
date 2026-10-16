package com.classbridge.service;

import com.classbridge.domain.ParentProfile;
import com.classbridge.domain.StudentProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.dto.ChildResponse;
import com.classbridge.dto.CreateParentRequest;
import com.classbridge.dto.CreateParentResponse;
import com.classbridge.exception.DuplicateUsernameException;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.mapper.ParentMapper;
import com.classbridge.repository.ParentProfileRepository;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.StudentProfileRepository;
import com.classbridge.repository.UserAccountRepository;
import com.classbridge.security.InitialPasswordGenerator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ParentService {

    private final SchoolMembershipRepository schoolMembershipRepository;
    private final UserAccountRepository userAccountRepository;
    private final ParentProfileRepository parentProfileRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final InitialPasswordGenerator initialPasswordGenerator;
    private final ParentMapper parentMapper;

    public ParentService(SchoolMembershipRepository schoolMembershipRepository,
                         UserAccountRepository userAccountRepository,
                         ParentProfileRepository parentProfileRepository,
                         StudentProfileRepository studentProfileRepository,
                         PasswordEncoder passwordEncoder,
                         InitialPasswordGenerator initialPasswordGenerator,
                         ParentMapper parentMapper) {
        this.schoolMembershipRepository = schoolMembershipRepository;
        this.userAccountRepository = userAccountRepository;
        this.parentProfileRepository = parentProfileRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.passwordEncoder = passwordEncoder;
        this.initialPasswordGenerator = initialPasswordGenerator;
        this.parentMapper = parentMapper;
    }

    @Transactional
    public CreateParentResponse createParent(Long actorAccountId, CreateParentRequest request) {
        schoolMembershipRepository.findByUserAccountId(actorAccountId)
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated administrator is not associated with any school."));

        String username = request.getUsername().trim();
        if (userAccountRepository.existsByUsername(username)) {
            throw new DuplicateUsernameException("Username is already taken: " + username);
        }

        String initialPassword = initialPasswordGenerator.generatePassword();
        String passwordHash = passwordEncoder.encode(initialPassword);

        UserAccount account = parentMapper.toUserAccountEntity(request, passwordHash);
        UserAccount savedAccount = userAccountRepository.save(account);

        ParentProfile profile = parentMapper.toParentProfileEntity(request, savedAccount);
        ParentProfile savedProfile = parentProfileRepository.save(profile);

        return parentMapper.toResponse(savedAccount, savedProfile, initialPassword);
    }

    @Transactional(readOnly = true)
    public List<ChildResponse> getChildren(Long actorAccountId) {
        ParentProfile parentProfile = parentProfileRepository.findByUserAccountId(actorAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Parent profile not found for authenticated account."));

        return studentProfileRepository.findActiveByParentProfileId(parentProfile.getId())
                .stream()
                .map(parentMapper::toChildResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ChildResponse getChild(Long actorAccountId, Long studentProfileId) {
        ParentProfile parentProfile = parentProfileRepository.findByUserAccountId(actorAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Parent profile not found for authenticated account."));

        StudentProfile studentProfile = studentProfileRepository.findActiveByIdAndParentProfileId(studentProfileId, parentProfile.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found with id: " + studentProfileId));

        return parentMapper.toChildResponse(studentProfile);
    }
}
