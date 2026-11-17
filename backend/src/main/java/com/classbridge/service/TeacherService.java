package com.classbridge.service;

import com.classbridge.domain.School;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.StaffProfile;
import com.classbridge.domain.Classroom;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.MemberIdentity;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.CreateTeacherRequest;
import com.classbridge.dto.CreateTeacherResponse;
import com.classbridge.dto.PageResponse;
import com.classbridge.dto.TeacherHomeroomClassroomResponse;
import com.classbridge.dto.TeacherProfileResponse;
import com.classbridge.dto.TeacherIdentityLookupResponse;
import com.classbridge.dto.UpdateTeacherRequest;
import com.classbridge.exception.DuplicateUsernameException;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.repository.ClassroomRepository;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.StaffProfileRepository;
import com.classbridge.repository.UserAccountRepository;
import com.classbridge.security.InitialPasswordGenerator;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

@Service
public class TeacherService {

    private final SchoolMembershipRepository schoolMembershipRepository;
    private final UserAccountRepository userAccountRepository;
    private final StaffProfileRepository staffProfileRepository;
    private final ClassroomRepository classroomRepository;
    private final PasswordEncoder passwordEncoder;
    private final InitialPasswordGenerator initialPasswordGenerator;

    public TeacherService(SchoolMembershipRepository schoolMembershipRepository,
                          UserAccountRepository userAccountRepository,
                          StaffProfileRepository staffProfileRepository,
                          ClassroomRepository classroomRepository,
                          PasswordEncoder passwordEncoder,
                          InitialPasswordGenerator initialPasswordGenerator) {
        this.schoolMembershipRepository = schoolMembershipRepository;
        this.userAccountRepository = userAccountRepository;
        this.staffProfileRepository = staffProfileRepository;
        this.classroomRepository = classroomRepository;
        this.passwordEncoder = passwordEncoder;
        this.initialPasswordGenerator = initialPasswordGenerator;
    }

    @Transactional
    public CreateTeacherResponse createTeacher(Long actorAccountId, CreateTeacherRequest request) {
        School school = getActorSchool(actorAccountId);
        String firstName = request.getFirstName().trim();
        String lastName = request.getLastName().trim();
        boolean transfer = StringUtils.hasText(request.getPublicId());
        String initialPassword = null;
        UserAccount savedAccount;
        StaffProfile savedProfile;
        SchoolMembership savedMembership;
        if (transfer) {
            savedAccount = userAccountRepository.findByMemberIdentityPublicId(request.getPublicId().trim())
                    .filter(account -> account.getRole() == UserRole.TEACHER)
                    .orElseThrow(() -> new ResourceNotFoundException("Teacher ID was not found."));
            if (savedAccount.isActive() || schoolMembershipRepository.findByUserAccountId(savedAccount.getId()).isPresent()) {
                throw new IllegalStateException("This teacher is still active at another school. The previous school must archive the teacher before transfer.");
            }
            if (StringUtils.hasText(request.getUsername()) && !request.getUsername().trim().equals(savedAccount.getUsername())) {
                throw new IllegalArgumentException("An existing teacher's username cannot be changed during transfer.");
            }
            savedProfile = staffProfileRepository.findByUserAccountId(savedAccount.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Teacher profile was not found."));
            savedProfile.setFirstName(firstName);
            savedProfile.setLastName(lastName);
            savedProfile = staffProfileRepository.save(savedProfile);
            if (StringUtils.hasText(request.getEmail())) savedAccount.setEmail(request.getEmail().trim());
            if (StringUtils.hasText(request.getPhoneNumber())) savedAccount.setPhoneNumber(request.getPhoneNumber().trim());
            savedAccount.setActive(true);
            savedAccount.setCredentialVersion(savedAccount.getCredentialVersion() + 1);
            savedAccount = userAccountRepository.save(savedAccount);
            savedMembership = schoolMembershipRepository.findBySchoolIdAndUserAccountId(school.getId(), savedAccount.getId())
                    .orElseGet(SchoolMembership::new);
            savedMembership.setSchool(school);
            savedMembership.setUserAccount(savedAccount);
            savedMembership.setActive(true);
            savedMembership.setArchivedBySchool(false);
            savedMembership.setBranch(StringUtils.hasText(request.getBranch()) ? request.getBranch().trim() : null);
            savedMembership = schoolMembershipRepository.save(savedMembership);
        } else {
            if (!StringUtils.hasText(request.getUsername())) {
                throw new IllegalArgumentException("Username is required for a new teacher account.");
            }
            String username = request.getUsername().trim();
            if (userAccountRepository.existsByUsername(username)) {
                throw new DuplicateUsernameException("Username is already taken: " + username);
            }
            initialPassword = initialPasswordGenerator.generatePassword();
            UserAccount account = new UserAccount();
            account.setUsername(username);
            account.setPasswordHash(passwordEncoder.encode(initialPassword));
            account.setRole(UserRole.TEACHER);
            account.setMemberIdentity(MemberIdentity.forRole(UserRole.TEACHER));
            account.setEmail(StringUtils.hasText(request.getEmail()) ? request.getEmail().trim() : null);
            account.setPhoneNumber(StringUtils.hasText(request.getPhoneNumber()) ? request.getPhoneNumber().trim() : null);
            account.setMustChangePassword(true);
            account.setActive(true);
            savedAccount = userAccountRepository.save(account);
            StaffProfile profile = new StaffProfile();
            profile.setUserAccount(savedAccount);
            profile.setFirstName(firstName);
            profile.setLastName(lastName);
            savedProfile = staffProfileRepository.save(profile);
            SchoolMembership membership = new SchoolMembership();
            membership.setSchool(school);
            membership.setUserAccount(savedAccount);
            membership.setBranch(StringUtils.hasText(request.getBranch()) ? request.getBranch().trim() : null);
            savedMembership = schoolMembershipRepository.save(membership);
        }

        CreateTeacherResponse response = new CreateTeacherResponse();
        response.setUserAccountId(savedAccount.getId());
        response.setStaffProfileId(savedProfile.getId());
        response.setSchoolMembershipId(savedMembership.getId());
        response.setSchoolId(school.getId());
        response.setUsername(savedAccount.getUsername());
        response.setFirstName(savedProfile.getFirstName());
        response.setLastName(savedProfile.getLastName());
        response.setBranch(savedMembership.getBranch());
        response.setPublicId(savedAccount.getMemberIdentity().getPublicId());
        response.setRole(savedAccount.getRole());
        response.setEmail(savedAccount.getEmail());
        response.setPhoneNumber(savedAccount.getPhoneNumber());
        response.setActive(savedAccount.isActive());
        response.setInitialPassword(initialPassword);
        response.setCreatedAt(savedAccount.getCreatedAt());

        return response;
    }

    @Transactional(readOnly = true)
    public PageResponse<TeacherProfileResponse> getTeachers(Long actorAccountId, boolean active, String query, int page, int size) {
        School school = getActorSchool(actorAccountId);
        if (page < 0) throw new IllegalArgumentException("Page index must not be less than zero.");
        if (size < 1) throw new IllegalArgumentException("Page size must be at least 1.");

        Pageable pageable = PageRequest.of(page, Math.min(100, size),
                Sort.by(Sort.Order.asc("lastName"), Sort.Order.asc("firstName"), Sort.Order.asc("id")));
        Page<StaffProfile> teacherPage = staffProfileRepository.findSchoolTeachers(
                school.getId(), UserRole.TEACHER, active, StringUtils.hasText(query) ? query.trim() : "", pageable);
        List<Long> accountIds = teacherPage.getContent().stream()
                .map(profile -> profile.getUserAccount().getId())
                .toList();
        Map<Long, List<TeacherHomeroomClassroomResponse>> homeroomByTeacher = loadHomeroomClassrooms(school.getId(), accountIds);
        Map<Long, SchoolMembership> membershipByTeacher = new HashMap<>();
        if (!accountIds.isEmpty()) {
            membershipByTeacher.putAll(schoolMembershipRepository
                    .findBySchoolAndUserAccounts(school.getId(), accountIds).stream()
                    .collect(java.util.stream.Collectors.toMap(membership -> membership.getUserAccount().getId(), Function.identity())));
        }
        List<TeacherProfileResponse> content = teacherPage.getContent().stream()
                .map(profile -> toResponse(profile,
                        homeroomByTeacher.getOrDefault(profile.getUserAccount().getId(), List.of()),
                        membershipByTeacher.get(profile.getUserAccount().getId())))
                .toList();

        return new PageResponse<>(content, teacherPage.getNumber(), teacherPage.getSize(),
                teacherPage.getTotalElements(), teacherPage.getTotalPages());
    }

    @Transactional(readOnly = true)
    public TeacherProfileResponse getTeacher(Long actorAccountId, Long teacherAccountId) {
        School school = getActorSchool(actorAccountId);
        StaffProfile profile = findTeacherInSchool(school.getId(), teacherAccountId);
        List<TeacherHomeroomClassroomResponse> homerooms = classroomRepository
                .findHomeroomClassrooms(school.getId(), teacherAccountId).stream()
                .map(this::toHomeroomResponse)
                .toList();
        return toResponse(profile, homerooms, schoolMembershipRepository.findBySchoolIdAndUserAccountId(school.getId(), teacherAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found with id: " + teacherAccountId)));
    }

    @Transactional(readOnly = true)
    public TeacherIdentityLookupResponse lookupTeacherIdentity(Long actorAccountId, String publicId) {
        getActorSchool(actorAccountId);
        UserAccount account = userAccountRepository.findByMemberIdentityPublicId(publicId.trim())
                .filter(value -> value.getRole() == UserRole.TEACHER)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher ID was not found."));
        if (account.isActive() || schoolMembershipRepository.findByUserAccountId(account.getId()).isPresent()) {
            throw new IllegalStateException("This teacher is still active at another school. The previous school must archive the teacher before transfer.");
        }
        StaffProfile profile = staffProfileRepository.findByUserAccountId(account.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Teacher profile was not found."));
        TeacherIdentityLookupResponse response = new TeacherIdentityLookupResponse();
        response.setPublicId(account.getMemberIdentity().getPublicId());
        response.setFirstName(profile.getFirstName());
        response.setLastName(profile.getLastName());
        response.setUsername(account.getUsername());
        response.setEmail(account.getEmail());
        response.setPhoneNumber(account.getPhoneNumber());
        SchoolMembership previous = schoolMembershipRepository.findAllByUserAccountId(account.getId()).stream()
                .max(java.util.Comparator.comparing(SchoolMembership::getUpdatedAt,
                        java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder()))).orElse(null);
        if (previous != null) {
            response.setPreviousBranch(previous.getBranch());
            response.setPreviousSchoolName(previous.getSchool().getName());
        }
        return response;
    }

    @Transactional
    public TeacherProfileResponse updateTeacher(Long actorAccountId, Long teacherAccountId, UpdateTeacherRequest request) {
        School school = getActorSchool(actorAccountId);
        StaffProfile profile = findTeacherInSchool(school.getId(), teacherAccountId);
        if (!profile.getUserAccount().isActive()) {
            throw new IllegalStateException("Archived teacher accounts cannot be edited.");
        }

        profile.setFirstName(request.getFirstName().trim());
        profile.setLastName(request.getLastName().trim());
        SchoolMembership membership = schoolMembershipRepository.findBySchoolIdAndUserAccountId(school.getId(), teacherAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found with id: " + teacherAccountId));
        membership.setBranch(StringUtils.hasText(request.getBranch()) ? request.getBranch().trim() : null);
        schoolMembershipRepository.save(membership);
        StaffProfile saved = staffProfileRepository.saveAndFlush(profile);
        return toResponse(saved, classroomRepository.findHomeroomClassrooms(school.getId(), teacherAccountId).stream()
                .map(this::toHomeroomResponse).toList(), membership);
    }

    @Transactional
    public TeacherProfileResponse archiveTeacher(Long actorAccountId, Long teacherAccountId) {
        School school = getActorSchool(actorAccountId);
        StaffProfile profile = findTeacherInSchool(school.getId(), teacherAccountId);
        UserAccount account = profile.getUserAccount();
        if (!classroomRepository.findHomeroomClassrooms(school.getId(), teacherAccountId).isEmpty()) {
            throw new IllegalStateException("Reassign this teacher’s homeroom classrooms before archiving the account.");
        }
        if (account.isActive()) {
            schoolMembershipRepository.findBySchoolIdAndUserAccountId(school.getId(), teacherAccountId)
                    .ifPresent(membership -> { membership.setActive(false); membership.setArchivedBySchool(true); schoolMembershipRepository.save(membership); });
            account.setActive(false);
            account.setCredentialVersion(account.getCredentialVersion() + 1);
            userAccountRepository.saveAndFlush(account);
        }
        return toResponse(profile, List.of(), schoolMembershipRepository.findBySchoolIdAndUserAccountId(school.getId(), teacherAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found with id: " + teacherAccountId)));
    }

    @Transactional
    public TeacherProfileResponse restoreTeacher(Long actorAccountId, Long teacherAccountId) {
        School school = getActorSchool(actorAccountId);
        StaffProfile profile = findTeacherInSchool(school.getId(), teacherAccountId);
        UserAccount account = profile.getUserAccount();
        if (!account.isActive()) {
            if (schoolMembershipRepository.findByUserAccountId(account.getId()).isPresent()) {
                throw new IllegalStateException("This teacher is already active at another school.");
            }
            schoolMembershipRepository.findBySchoolIdAndUserAccountId(school.getId(), teacherAccountId)
                    .ifPresent(membership -> { membership.setActive(true); membership.setArchivedBySchool(false); schoolMembershipRepository.save(membership); });
            account.setActive(true);
            account.setCredentialVersion(account.getCredentialVersion() + 1);
            userAccountRepository.saveAndFlush(account);
        }
        List<TeacherHomeroomClassroomResponse> homerooms = classroomRepository
                .findHomeroomClassrooms(school.getId(), teacherAccountId).stream()
                .map(this::toHomeroomResponse).toList();
        return toResponse(profile, homerooms, schoolMembershipRepository.findBySchoolIdAndUserAccountId(school.getId(), teacherAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found with id: " + teacherAccountId)));
    }

    private School getActorSchool(Long actorAccountId) {
        UserAccount actor = userAccountRepository.findById(actorAccountId)
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated administrator was not found."));
        if (actor.getRole() != UserRole.SCHOOL_ADMIN && actor.getRole() != UserRole.SCHOOL_VICE_ADMIN) {
            throw new ForbiddenOperationException("Only school administrators can manage teacher accounts.");
        }
        return schoolMembershipRepository.findByUserAccountId(actorAccountId)
                .filter(membership -> membership.getSchool() != null)
                .map(SchoolMembership::getSchool)
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated administrator is not associated with any school."));
    }

    private StaffProfile findTeacherInSchool(Long schoolId, Long teacherAccountId) {
        SchoolMembership membership = schoolMembershipRepository.findBySchoolIdAndUserAccountId(schoolId, teacherAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found with id: " + teacherAccountId));
        StaffProfile profile = staffProfileRepository.findByUserAccountId(teacherAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found with id: " + teacherAccountId));
        if (membership.getUserAccount().getRole() != UserRole.TEACHER) {
            throw new ResourceNotFoundException("Teacher not found with id: " + teacherAccountId);
        }
        return profile;
    }

    private Map<Long, List<TeacherHomeroomClassroomResponse>> loadHomeroomClassrooms(Long schoolId, List<Long> teacherIds) {
        Map<Long, List<TeacherHomeroomClassroomResponse>> result = new HashMap<>();
        if (teacherIds.isEmpty()) return result;
        List<Classroom> classrooms = classroomRepository.findHomeroomClassroomsForTeachers(schoolId, teacherIds);
        for (Classroom classroom : classrooms) {
            result.computeIfAbsent(classroom.getHomeroomTeacher().getId(), ignored -> new ArrayList<>())
                    .add(toHomeroomResponse(classroom));
        }
        return result;
    }

    private TeacherHomeroomClassroomResponse toHomeroomResponse(Classroom classroom) {
        return new TeacherHomeroomClassroomResponse(classroom.getId(), classroom.getGradeLevel(), classroom.getSectionName());
    }

    private TeacherProfileResponse toResponse(StaffProfile profile,
                                              List<TeacherHomeroomClassroomResponse> homerooms,
                                              SchoolMembership membership) {
        UserAccount account = profile.getUserAccount();
        if (membership == null) {
            throw new ResourceNotFoundException("Teacher not found with id: " + account.getId());
        }
        TeacherProfileResponse response = new TeacherProfileResponse();
        response.setUserAccountId(account.getId());
        response.setStaffProfileId(profile.getId());
        response.setSchoolMembershipId(membership.getId());
        response.setSchoolId(membership.getSchool().getId());
        response.setUsername(account.getUsername());
        response.setFirstName(profile.getFirstName());
        response.setLastName(profile.getLastName());
        response.setBranch(membership.getBranch());
        response.setPublicId(account.getMemberIdentity().getPublicId());
        response.setEmail(account.getEmail());
        response.setEmailVerified(account.isEmailVerified());
        response.setPhoneNumber(account.getPhoneNumber());
        response.setActive(account.isActive());
        response.setMustChangePassword(account.isMustChangePassword());
        response.setHomeroomClassrooms(homerooms);
        response.setCreatedAt(profile.getCreatedAt());
        return response;
    }
}
