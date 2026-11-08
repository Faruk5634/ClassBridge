package com.classbridge.service;

import com.classbridge.domain.ParentProfile;
import com.classbridge.domain.ParentSchoolRegistration;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.StudentProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.ChildResponse;
import com.classbridge.dto.CreateParentRequest;
import com.classbridge.dto.CreateParentResponse;
import com.classbridge.dto.SchoolParentResponse;
import com.classbridge.dto.SchoolParentStudentResponse;
import com.classbridge.dto.UpdateParentRequest;
import com.classbridge.exception.DuplicateUsernameException;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.mapper.ParentMapper;
import com.classbridge.repository.ParentProfileRepository;
import com.classbridge.repository.ParentSchoolRegistrationRepository;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.StudentProfileRepository;
import com.classbridge.repository.UserAccountRepository;
import com.classbridge.security.InitialPasswordGenerator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ParentService {

    private final SchoolMembershipRepository schoolMembershipRepository;
    private final UserAccountRepository userAccountRepository;
    private final ParentProfileRepository parentProfileRepository;
    private final ParentSchoolRegistrationRepository parentSchoolRegistrationRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final InitialPasswordGenerator initialPasswordGenerator;
    private final ParentMapper parentMapper;

    public ParentService(SchoolMembershipRepository schoolMembershipRepository,
                         UserAccountRepository userAccountRepository,
                         ParentProfileRepository parentProfileRepository,
                         ParentSchoolRegistrationRepository parentSchoolRegistrationRepository,
                         StudentProfileRepository studentProfileRepository,
                         PasswordEncoder passwordEncoder,
                         InitialPasswordGenerator initialPasswordGenerator,
                         ParentMapper parentMapper) {
        this.schoolMembershipRepository = schoolMembershipRepository;
        this.userAccountRepository = userAccountRepository;
        this.parentProfileRepository = parentProfileRepository;
        this.parentSchoolRegistrationRepository = parentSchoolRegistrationRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.passwordEncoder = passwordEncoder;
        this.initialPasswordGenerator = initialPasswordGenerator;
        this.parentMapper = parentMapper;
    }

    @Transactional
    public CreateParentResponse createParent(Long actorAccountId, CreateParentRequest request) {
        SchoolMembership membership = schoolMembershipRepository.findByUserAccountId(actorAccountId)
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

        ParentSchoolRegistration registration = new ParentSchoolRegistration();
        registration.setSchool(membership.getSchool());
        registration.setParentProfile(savedProfile);
        registration.setRegisteredBy(membership.getUserAccount());
        parentSchoolRegistrationRepository.save(registration);

        return parentMapper.toResponse(savedAccount, savedProfile, initialPassword);
    }

    @Transactional(readOnly = true)
    public List<SchoolParentResponse> getSchoolParents(Long actorAccountId) {
        Long schoolId = schoolMembershipRepository.findByUserAccountId(actorAccountId)
                .map(membership -> membership.getSchool().getId())
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated administrator is not associated with any school."));

        Map<Long, SchoolParentResponse> parents = new LinkedHashMap<>();
        for (StudentProfile student : studentProfileRepository.findActiveBySchoolId(schoolId)) {
            ParentProfile parent = student.getParentProfile();
            if (parent == null || parent.getUserAccount() == null) continue;
            SchoolParentResponse response = parents.computeIfAbsent(parent.getId(), ignored -> toSchoolParentResponse(parent));
            response.getChildren().add(student.getFirstName() + " " + student.getLastName() + " · Grade "
                    + student.getClassroom().getGradeLevel() + " · " + student.getClassroom().getSectionName());
        }

        for (ParentSchoolRegistration registration : parentSchoolRegistrationRepository.findBySchoolIdOrderByCreatedAtDesc(schoolId)) {
            ParentProfile parent = registration.getParentProfile();
            if (parent.getUserAccount() != null) {
                parents.computeIfAbsent(parent.getId(), ignored -> toSchoolParentResponse(parent));
            }
        }
        return List.copyOf(parents.values());
    }

    @Transactional(readOnly = true)
    public SchoolParentResponse getSchoolParent(Long actorAccountId, Long parentProfileId) {
        Long schoolId = getActorSchoolId(actorAccountId);
        ParentProfile profile = findSchoolParent(schoolId, parentProfileId);
        return toSchoolParentResponse(profile, schoolId);
    }

    @Transactional(readOnly = true)
    public List<SchoolParentStudentResponse> getSchoolParentStudents(Long actorAccountId, Long parentProfileId, boolean available) {
        Long schoolId = getActorSchoolId(actorAccountId);
        ParentProfile parent = findSchoolParent(schoolId, parentProfileId);
        return studentProfileRepository.findActiveBySchoolId(schoolId).stream()
                .filter(student -> available
                        ? student.getParentProfile() == null || !student.getParentProfile().getId().equals(parent.getId())
                        : student.getParentProfile() != null && student.getParentProfile().getId().equals(parent.getId()))
                .map(this::toSchoolParentStudentResponse)
                .toList();
    }

    @Transactional
    public SchoolParentResponse linkStudent(Long actorAccountId, Long parentProfileId, Long studentProfileId) {
        Long schoolId = getActorSchoolId(actorAccountId);
        ParentProfile parent = findSchoolParent(schoolId, parentProfileId);
        if (!parent.getUserAccount().isActive()) {
            throw new ForbiddenOperationException("Restore this parent account before linking a student.");
        }
        StudentProfile student = studentProfileRepository.findByIdAndSchoolId(studentProfileId, schoolId)
                .filter(StudentProfile::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("Active student not found in this school."));
        student.setParentProfile(parent);
        ensureParentRegisteredForSchool(actorAccountId, schoolId, parent);
        studentProfileRepository.saveAndFlush(student);
        return toSchoolParentResponse(parent, schoolId);
    }

    @Transactional
    public SchoolParentResponse unlinkStudent(Long actorAccountId, Long parentProfileId, Long studentProfileId) {
        Long schoolId = getActorSchoolId(actorAccountId);
        ParentProfile parent = findSchoolParent(schoolId, parentProfileId);
        StudentProfile student = studentProfileRepository.findByIdAndSchoolId(studentProfileId, schoolId)
                .filter(StudentProfile::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("Active student not found in this school."));
        if (student.getParentProfile() == null || !student.getParentProfile().getId().equals(parent.getId())) {
            throw new ResourceNotFoundException("Student is not linked to this parent in this school.");
        }
        if (student.getClassroom().getGradeLevel() < 9) {
            throw new ForbiddenOperationException("Primary- and middle-school students must remain linked to a parent. Reassign the student to another parent instead.");
        }
        student.setParentProfile(null);
        studentProfileRepository.saveAndFlush(student);
        return toSchoolParentResponse(parent, schoolId);
    }

    private void ensureParentRegisteredForSchool(Long actorAccountId, Long schoolId, ParentProfile parent) {
        if (parentSchoolRegistrationRepository.existsBySchoolIdAndParentProfileId(schoolId, parent.getId())) return;
        SchoolMembership membership = schoolMembershipRepository.findByUserAccountId(actorAccountId)
                .filter(candidate -> candidate.getSchool().getId().equals(schoolId))
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated administrator is not associated with this school."));
        ParentSchoolRegistration registration = new ParentSchoolRegistration();
        registration.setSchool(membership.getSchool());
        registration.setParentProfile(parent);
        registration.setRegisteredBy(membership.getUserAccount());
        parentSchoolRegistrationRepository.save(registration);
    }

    private SchoolParentStudentResponse toSchoolParentStudentResponse(StudentProfile student) {
        SchoolParentStudentResponse response = new SchoolParentStudentResponse();
        response.setStudentProfileId(student.getId());
        response.setFirstName(student.getFirstName());
        response.setLastName(student.getLastName());
        response.setGradeLevel(student.getClassroom().getGradeLevel());
        response.setSectionName(student.getClassroom().getSectionName());
        ParentProfile currentParent = student.getParentProfile();
        if (currentParent != null) {
            response.setParentProfileId(currentParent.getId());
            response.setParentDisplayName(currentParent.getFirstName() + " " + currentParent.getLastName());
        }
        return response;
    }

    @Transactional
    public SchoolParentResponse updateSchoolParent(Long actorAccountId, Long parentProfileId, UpdateParentRequest request) {
        Long schoolId = getActorSchoolId(actorAccountId);
        ParentProfile profile = findSchoolParent(schoolId, parentProfileId);
        if (!profile.getUserAccount().isActive()) {
            throw new ForbiddenOperationException("Archived parent accounts are read-only. Restore the account first.");
        }
        profile.setFirstName(request.getFirstName().trim());
        profile.setLastName(request.getLastName().trim());
        return toSchoolParentResponse(parentProfileRepository.saveAndFlush(profile), schoolId);
    }

    @Transactional
    public SchoolParentResponse archiveSchoolParent(Long actorAccountId, Long parentProfileId) {
        Long schoolId = getActorSchoolId(actorAccountId);
        ParentProfile profile = findSchoolParent(schoolId, parentProfileId);
        UserAccount account = profile.getUserAccount();
        if (!account.isActive()) return toSchoolParentResponse(profile, schoolId);

        // A parent account is shared by all linked children. Never disable it while it
        // is still in use or registered with another school.
        if (studentProfileRepository.existsByParentProfileIdAndIsActiveTrue(profile.getId())
                || parentSchoolRegistrationRepository.existsByParentProfileIdAndSchoolIdNot(profile.getId(), schoolId)) {
            throw new ForbiddenOperationException("This shared parent account is still linked to an active student or another school. Update those links before archiving it.");
        }

        SchoolMembership membership = schoolMembershipRepository.findByUserAccountId(actorAccountId)
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated administrator is not associated with any school."));
        if (!parentSchoolRegistrationRepository.existsBySchoolIdAndParentProfileId(schoolId, profile.getId())) {
            ParentSchoolRegistration registration = new ParentSchoolRegistration();
            registration.setSchool(membership.getSchool());
            registration.setParentProfile(profile);
            registration.setRegisteredBy(membership.getUserAccount());
            parentSchoolRegistrationRepository.save(registration);
        }
        account.setActive(false);
        account.setCredentialVersion(account.getCredentialVersion() + 1);
        userAccountRepository.save(account);
        return toSchoolParentResponse(profile, schoolId);
    }

    @Transactional
    public SchoolParentResponse restoreSchoolParent(Long actorAccountId, Long parentProfileId) {
        Long schoolId = getActorSchoolId(actorAccountId);
        ParentProfile profile = findSchoolParent(schoolId, parentProfileId);
        UserAccount account = profile.getUserAccount();
        if (!account.isActive()) {
            account.setActive(true);
            account.setCredentialVersion(account.getCredentialVersion() + 1);
            userAccountRepository.save(account);
        }
        return toSchoolParentResponse(profile, schoolId);
    }

    private Long getActorSchoolId(Long actorAccountId) {
        return schoolMembershipRepository.findByUserAccountId(actorAccountId)
                .map(membership -> membership.getSchool().getId())
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated administrator is not associated with any school."));
    }

    private ParentProfile findSchoolParent(Long schoolId, Long parentProfileId) {
        ParentProfile profile = parentProfileRepository.findById(parentProfileId)
                .orElseThrow(() -> new ResourceNotFoundException("Parent account not found."));
        boolean belongsToSchool = parentSchoolRegistrationRepository.existsBySchoolIdAndParentProfileId(schoolId, parentProfileId)
                || studentProfileRepository.existsByParentProfileIdAndSchoolId(parentProfileId, schoolId);
        if (!belongsToSchool || profile.getUserAccount() == null || profile.getUserAccount().getRole() != UserRole.PARENT) {
            throw new ResourceNotFoundException("Parent account not found.");
        }
        return profile;
    }

    private SchoolParentResponse toSchoolParentResponse(ParentProfile profile, Long schoolId) {
        SchoolParentResponse response = toSchoolParentResponse(profile);
        for (StudentProfile student : studentProfileRepository.findActiveBySchoolId(schoolId)) {
            if (student.getParentProfile() != null && student.getParentProfile().getId().equals(profile.getId())) {
                response.getChildren().add(student.getFirstName() + " " + student.getLastName() + " · Grade "
                        + student.getClassroom().getGradeLevel() + " · " + student.getClassroom().getSectionName());
            }
        }
        return response;
    }

    private SchoolParentResponse toSchoolParentResponse(ParentProfile profile) {
        UserAccount account = profile.getUserAccount();
        SchoolParentResponse response = new SchoolParentResponse();
        response.setParentProfileId(profile.getId());
        response.setUserAccountId(account.getId());
        response.setUsername(account.getUsername());
        response.setFirstName(profile.getFirstName());
        response.setLastName(profile.getLastName());
        response.setEmail(account.getEmail());
        response.setPhoneNumber(account.getPhoneNumber());
        response.setActive(account.isActive());
        response.setEmailVerified(account.isEmailVerified());
        response.setMustChangePassword(account.isMustChangePassword());
        response.setCreatedAt(account.getCreatedAt());
        response.setChildren(new java.util.ArrayList<>());
        return response;
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
