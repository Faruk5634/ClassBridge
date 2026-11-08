package com.classbridge.service;

import com.classbridge.domain.School;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.StaffProfile;
import com.classbridge.domain.Classroom;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.CreateTeacherRequest;
import com.classbridge.dto.CreateTeacherResponse;
import com.classbridge.dto.PageResponse;
import com.classbridge.dto.TeacherHomeroomClassroomResponse;
import com.classbridge.dto.TeacherProfileResponse;
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
        String username = request.getUsername().trim();
        String firstName = request.getFirstName().trim();
        String lastName = request.getLastName().trim();

        if (userAccountRepository.existsByUsername(username)) {
            throw new DuplicateUsernameException("Username is already taken: " + username);
        }

        String initialPassword = initialPasswordGenerator.generatePassword();
        String passwordHash = passwordEncoder.encode(initialPassword);

        UserAccount account = new UserAccount();
        account.setUsername(username);
        account.setPasswordHash(passwordHash);
        account.setRole(UserRole.TEACHER);
        account.setEmail(StringUtils.hasText(request.getEmail()) ? request.getEmail().trim() : null);
        account.setPhoneNumber(StringUtils.hasText(request.getPhoneNumber()) ? request.getPhoneNumber().trim() : null);
        account.setMustChangePassword(true);
        account.setActive(true);
        UserAccount savedAccount = userAccountRepository.save(account);

        StaffProfile profile = new StaffProfile();
        profile.setUserAccount(savedAccount);
        profile.setFirstName(firstName);
        profile.setLastName(lastName);
        profile.setBranch(StringUtils.hasText(request.getBranch()) ? request.getBranch().trim() : null);
        StaffProfile savedProfile = staffProfileRepository.save(profile);

        SchoolMembership membership = new SchoolMembership();
        membership.setSchool(school);
        membership.setUserAccount(savedAccount);
        SchoolMembership savedMembership = schoolMembershipRepository.save(membership);

        CreateTeacherResponse response = new CreateTeacherResponse();
        response.setUserAccountId(savedAccount.getId());
        response.setStaffProfileId(savedProfile.getId());
        response.setSchoolMembershipId(savedMembership.getId());
        response.setSchoolId(school.getId());
        response.setUsername(savedAccount.getUsername());
        response.setFirstName(savedProfile.getFirstName());
        response.setLastName(savedProfile.getLastName());
        response.setBranch(savedProfile.getBranch());
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
        return toResponse(profile, homerooms);
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
        profile.setBranch(StringUtils.hasText(request.getBranch()) ? request.getBranch().trim() : null);
        StaffProfile saved = staffProfileRepository.saveAndFlush(profile);
        return toResponse(saved, classroomRepository.findHomeroomClassrooms(school.getId(), teacherAccountId).stream()
                .map(this::toHomeroomResponse).toList());
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
            account.setActive(false);
            account.setCredentialVersion(account.getCredentialVersion() + 1);
            userAccountRepository.saveAndFlush(account);
        }
        return toResponse(profile, List.of());
    }

    @Transactional
    public TeacherProfileResponse restoreTeacher(Long actorAccountId, Long teacherAccountId) {
        School school = getActorSchool(actorAccountId);
        StaffProfile profile = findTeacherInSchool(school.getId(), teacherAccountId);
        UserAccount account = profile.getUserAccount();
        if (!account.isActive()) {
            account.setActive(true);
            account.setCredentialVersion(account.getCredentialVersion() + 1);
            userAccountRepository.saveAndFlush(account);
        }
        List<TeacherHomeroomClassroomResponse> homerooms = classroomRepository
                .findHomeroomClassrooms(school.getId(), teacherAccountId).stream()
                .map(this::toHomeroomResponse).toList();
        return toResponse(profile, homerooms);
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
        SchoolMembership membership = schoolMembershipRepository.findByUserAccountId(teacherAccountId)
                .filter(value -> value.getSchool().getId().equals(schoolId))
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

    private TeacherProfileResponse toResponse(StaffProfile profile, List<TeacherHomeroomClassroomResponse> homerooms) {
        UserAccount account = profile.getUserAccount();
        SchoolMembership membership = schoolMembershipRepository.findByUserAccountId(account.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found with id: " + account.getId()));
        return toResponse(profile, homerooms, membership);
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
        response.setBranch(profile.getBranch());
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
