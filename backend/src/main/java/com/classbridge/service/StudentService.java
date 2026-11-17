package com.classbridge.service;

import com.classbridge.domain.Classroom;
import com.classbridge.domain.ParentProfile;
import com.classbridge.domain.ParentSchoolRegistration;
import com.classbridge.domain.School;
import com.classbridge.domain.SchoolLevel;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.StudentProfile;
import com.classbridge.domain.StudentIdentity;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.CreateStudentRequest;
import com.classbridge.dto.CreateStudentResponse;
import com.classbridge.dto.PageResponse;
import com.classbridge.dto.StudentProfileResponse;
import com.classbridge.dto.StudentIdentityLookupResponse;
import com.classbridge.dto.UpdateStudentRequest;
import com.classbridge.exception.ArchivedStudentProfileException;
import com.classbridge.exception.DuplicateSchoolNumberException;
import com.classbridge.exception.DuplicateUsernameException;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.InvalidGradeLevelException;
import com.classbridge.exception.InvalidStudentEnrollmentException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.mapper.StudentMapper;
import com.classbridge.repository.ClassroomRepository;
import com.classbridge.repository.ParentProfileRepository;
import com.classbridge.repository.ParentSchoolRegistrationRepository;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.StudentProfileRepository;
import com.classbridge.repository.StudentIdentityRepository;
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

import java.util.List;
import java.util.stream.Collectors;

@Service
public class StudentService {

    private final SchoolMembershipRepository schoolMembershipRepository;
    private final ClassroomRepository classroomRepository;
    private final UserAccountRepository userAccountRepository;
    private final ParentProfileRepository parentProfileRepository;
    private final ParentSchoolRegistrationRepository parentSchoolRegistrationRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final StudentIdentityRepository studentIdentityRepository;
    private final InitialPasswordGenerator initialPasswordGenerator;
    private final PasswordEncoder passwordEncoder;
    private final StudentMapper studentMapper;

    public StudentService(SchoolMembershipRepository schoolMembershipRepository,
                          ClassroomRepository classroomRepository,
                          UserAccountRepository userAccountRepository,
                          ParentProfileRepository parentProfileRepository,
                          ParentSchoolRegistrationRepository parentSchoolRegistrationRepository,
                          StudentProfileRepository studentProfileRepository,
                          StudentIdentityRepository studentIdentityRepository,
                          InitialPasswordGenerator initialPasswordGenerator,
                          PasswordEncoder passwordEncoder,
                          StudentMapper studentMapper) {
        this.schoolMembershipRepository = schoolMembershipRepository;
        this.classroomRepository = classroomRepository;
        this.userAccountRepository = userAccountRepository;
        this.parentProfileRepository = parentProfileRepository;
        this.parentSchoolRegistrationRepository = parentSchoolRegistrationRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.studentIdentityRepository = studentIdentityRepository;
        this.initialPasswordGenerator = initialPasswordGenerator;
        this.passwordEncoder = passwordEncoder;
        this.studentMapper = studentMapper;
    }

    @Transactional
    public CreateStudentResponse enrollStudent(Long actorAccountId, CreateStudentRequest request) {
        School school = getActorSchool(actorAccountId);

        Classroom classroom = classroomRepository.findByIdAndSchoolId(request.getClassroomId(), school.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found with id: " + request.getClassroomId()));

        validateGradeLevel(school.getEducationLevel(), classroom.getGradeLevel());

        String schoolNumber = request.getSchoolNumber().trim();
        if (studentProfileRepository.existsBySchoolIdAndSchoolNumber(school.getId(), schoolNumber)) {
            throw new DuplicateSchoolNumberException(
                    "A student with school number '" + schoolNumber + "' already exists in this school."
            );
        }

        StudentIdentity studentIdentity;
        boolean transferred = StringUtils.hasText(request.getStudentPublicId());
        if (transferred) {
            studentIdentity = studentIdentityRepository.findByMemberIdentityPublicId(request.getStudentPublicId().trim())
                    .orElseThrow(() -> new ResourceNotFoundException("Student ID was not found."));
            if (studentProfileRepository.existsByStudentIdentityIdAndIsActiveTrue(studentIdentity.getId())) {
                throw new IllegalStateException("This student is still active at another school. The previous school must end the enrollment before transfer.");
            }
            studentIdentity.setFirstName(request.getFirstName().trim());
            studentIdentity.setLastName(request.getLastName().trim());
        } else {
            studentIdentity = new StudentIdentity(com.classbridge.domain.MemberIdentity.forStudent(),
                    request.getFirstName().trim(), request.getLastName().trim());
            studentIdentity = studentIdentityRepository.save(studentIdentity);
        }

        ParentProfile parentProfile = null;
        StudentProfile previousEnrollment = transferred
                ? studentProfileRepository.findFirstByStudentIdentityIdOrderByCreatedAtDesc(studentIdentity.getId()).orElse(null)
                : null;
        UserAccount studentAccount = studentIdentity.getMemberIdentity().getUserAccount();
        String initialPassword = null;

        if (school.getEducationLevel() == SchoolLevel.PRIMARY || school.getEducationLevel() == SchoolLevel.MIDDLE) {
            if (studentAccount != null && studentAccount.isActive()) {
                studentAccount.setActive(false);
                studentAccount.setCredentialVersion(studentAccount.getCredentialVersion() + 1);
                userAccountRepository.save(studentAccount);
            }
            if (StringUtils.hasText(request.getEmail()) || StringUtils.hasText(request.getPhoneNumber())) {
                throw new InvalidStudentEnrollmentException("Primary- and middle-school students do not have individual login contact details.");
            }
            if (StringUtils.hasText(request.getStudentUsername())) {
                throw new InvalidStudentEnrollmentException(
                        "Student accounts are not permitted for " + school.getEducationLevel() + " school students."
                );
            }
            if (StringUtils.hasText(request.getParentUsername())) {
                parentProfile = validateAndGetParentProfile(request.getParentUsername(), school.getId());
            } else if (previousEnrollment != null) {
                parentProfile = previousEnrollment.getParentProfile();
            }
            if (parentProfile == null) {
                throw new InvalidStudentEnrollmentException("A parent account is required for " + school.getEducationLevel() + " school students.");
            }
        } else if (school.getEducationLevel() == SchoolLevel.HIGH_SCHOOL) {
            if (StringUtils.hasText(request.getParentUsername())) {
                parentProfile = validateAndGetParentProfile(request.getParentUsername(), school.getId());
            } else if (previousEnrollment != null) {
                parentProfile = previousEnrollment.getParentProfile();
            }
            if (studentAccount == null) {
                if (!StringUtils.hasText(request.getStudentUsername())) {
                    throw new InvalidStudentEnrollmentException("Student username is required for a high-school student who has no existing login account.");
                }
                String studentUsername = request.getStudentUsername().trim();
                if (userAccountRepository.existsByUsername(studentUsername)) {
                    throw new DuplicateUsernameException("Username is already taken: " + studentUsername);
                }
                initialPassword = initialPasswordGenerator.generatePassword();
                UserAccount account = new UserAccount();
                account.setUsername(studentUsername);
                account.setPasswordHash(passwordEncoder.encode(initialPassword));
                account.setRole(UserRole.STUDENT);
                account.setMemberIdentity(studentIdentity.getMemberIdentity());
                account.setActive(true);
                account.setMustChangePassword(true);
                account.setEmail(StringUtils.hasText(request.getEmail()) ? request.getEmail().trim() : null);
                account.setPhoneNumber(StringUtils.hasText(request.getPhoneNumber()) ? request.getPhoneNumber().trim() : null);
                studentAccount = userAccountRepository.save(account);
            } else {
                if (studentAccount.getRole() != UserRole.STUDENT) {
                    throw new InvalidStudentEnrollmentException("This student identity is linked to an incompatible login account.");
                }
                if (StringUtils.hasText(request.getStudentUsername())
                        && !request.getStudentUsername().trim().equals(studentAccount.getUsername())) {
                    throw new InvalidStudentEnrollmentException("An existing student's username cannot be changed during transfer.");
                }
                studentAccount.setActive(true);
                studentAccount.setCredentialVersion(studentAccount.getCredentialVersion() + 1);
                studentAccount = userAccountRepository.save(studentAccount);
            }
        } else {
            if (StringUtils.hasText(request.getStudentUsername())) {
                throw new InvalidStudentEnrollmentException("Student accounts are not permitted for " + school.getEducationLevel() + " school students.");
            }
            if (studentAccount != null && studentAccount.isActive()) {
                studentAccount.setActive(false);
                studentAccount.setCredentialVersion(studentAccount.getCredentialVersion() + 1);
                userAccountRepository.save(studentAccount);
            }
            if (StringUtils.hasText(request.getParentUsername())) {
                parentProfile = validateAndGetParentProfile(request.getParentUsername(), school.getId());
            } else if (previousEnrollment != null) {
                parentProfile = previousEnrollment.getParentProfile();
            }
            if (school.getEducationLevel() != SchoolLevel.HIGH_SCHOOL && parentProfile == null) {
                throw new InvalidStudentEnrollmentException("A parent account is required for primary- and middle-school students.");
            }
        }

        StudentProfile studentProfile = studentMapper.toEntity(
                request, school, classroom, parentProfile, studentIdentity
        );
        StudentProfile savedProfile = studentProfileRepository.save(studentProfile);
        if (parentProfile != null) {
            registerParentForSchool(actorAccountId, school, parentProfile);
        }

        return studentMapper.toResponse(savedProfile, initialPassword);
    }

    @Transactional(readOnly = true)
    public StudentIdentityLookupResponse lookupStudentIdentity(Long actorAccountId, String publicId) {
        getActorSchool(actorAccountId);
        StudentIdentity identity = studentIdentityRepository.findByMemberIdentityPublicId(publicId.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Student ID was not found."));
        if (identity.getMemberIdentity().getIdentityType() == null
                || !UserRole.STUDENT.name().equals(identity.getMemberIdentity().getIdentityType())) {
            throw new ResourceNotFoundException("Student ID was not found.");
        }
        if (studentProfileRepository.existsByStudentIdentityIdAndIsActiveTrue(identity.getId())) {
            throw new IllegalStateException("This student is still active at another school. The previous school must archive the enrollment before transfer.");
        }
        StudentProfile previous = studentProfileRepository.findFirstByStudentIdentityIdOrderByCreatedAtDesc(identity.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Student enrollment record was not found."));
        StudentIdentityLookupResponse response = new StudentIdentityLookupResponse();
        response.setStudentPublicId(identity.getMemberIdentity().getPublicId());
        response.setFirstName(identity.getFirstName());
        response.setLastName(identity.getLastName());
        response.setPreviousSchoolNumber(previous.getSchoolNumber());
        response.setPreviousSchoolName(previous.getSchool().getName());
        if (identity.getMemberIdentity().getUserAccount() != null) {
            UserAccount account = identity.getMemberIdentity().getUserAccount();
            response.setHasStudentAccount(account.getRole() == UserRole.STUDENT);
            response.setStudentUsername(account.getUsername());
            response.setEmail(account.getEmail());
            response.setPhoneNumber(account.getPhoneNumber());
        }
        if (previous.getParentProfile() != null && previous.getParentProfile().getUserAccount() != null) {
            response.setParentUsername(previous.getParentProfile().getUserAccount().getUsername());
        }
        return response;
    }

    private void registerParentForSchool(Long actorAccountId, School school, ParentProfile parentProfile) {
        if (parentSchoolRegistrationRepository.existsBySchoolIdAndParentProfileIdAndIsActiveTrue(school.getId(), parentProfile.getId())) {
            return;
        }
        SchoolMembership membership = schoolMembershipRepository.findByUserAccountId(actorAccountId)
                .filter(candidate -> candidate.getSchool().getId().equals(school.getId()))
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated administrator is not associated with this school."));
        ParentSchoolRegistration registration = new ParentSchoolRegistration();
        registration.setSchool(school);
        registration.setParentProfile(parentProfile);
        registration.setRegisteredBy(membership.getUserAccount());
        parentSchoolRegistrationRepository.save(registration);
    }

    private void validateGradeLevel(SchoolLevel educationLevel, Integer gradeLevel) {
        if (gradeLevel == null) {
            throw new InvalidGradeLevelException("Grade level is required.");
        }
        boolean valid = switch (educationLevel) {
            case PRIMARY -> gradeLevel >= 1 && gradeLevel <= 4;
            case MIDDLE -> gradeLevel >= 5 && gradeLevel <= 8;
            case HIGH_SCHOOL -> gradeLevel >= 9 && gradeLevel <= 12;
        };
        if (!valid) {
            throw new InvalidGradeLevelException(
                    "Classroom grade level " + gradeLevel + " is not valid for school level " + educationLevel + "."
            );
        }
    }

    private ParentProfile validateAndGetParentProfile(String parentUsername, Long schoolId) {
        String trimmedUsername = parentUsername.trim();
        UserAccount parentAccount = userAccountRepository.findByUsername(trimmedUsername)
                .orElseThrow(() -> new InvalidStudentEnrollmentException(
                        "Parent account not found with username: " + trimmedUsername
                ));

        if (parentAccount.getRole() != UserRole.PARENT) {
            throw new InvalidStudentEnrollmentException(
                    "Account with username '" + trimmedUsername + "' does not have the PARENT role."
            );
        }

        if (!parentAccount.isActive()) {
            throw new InvalidStudentEnrollmentException(
                    "Parent account with username '" + trimmedUsername + "' is not active."
            );
        }

        ParentProfile parentProfile = parentProfileRepository.findByUserAccountId(parentAccount.getId())
                .orElseThrow(() -> new InvalidStudentEnrollmentException(
                        "Parent profile not found for account: " + trimmedUsername
                ));
        return parentProfile;
    }

    @Transactional(readOnly = true)
    public PageResponse<StudentProfileResponse> getStudents(Long actorAccountId,
                                                            Long classroomId,
                                                            boolean active,
                                                            int page,
                                                            int size) {
        School school = getActorSchool(actorAccountId);

        if (page < 0) {
            throw new IllegalArgumentException("Page index must not be less than zero.");
        }
        if (size < 1) {
            throw new IllegalArgumentException("Page size must be at least 1.");
        }
        int boundedSize = Math.min(100, size);

        if (classroomId != null) {
            classroomRepository.findByIdAndSchoolId(classroomId, school.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Classroom not found with id: " + classroomId));
        }

        Pageable pageable = PageRequest.of(page, boundedSize,
                Sort.by(Sort.Order.asc("lastName"), Sort.Order.asc("firstName"), Sort.Order.asc("id")));

        Page<StudentProfile> studentPage;
        if (classroomId != null) {
            studentPage = studentProfileRepository.findBySchoolIdAndClassroomIdAndIsActive(
                    school.getId(), classroomId, active, pageable
            );
        } else {
            studentPage = studentProfileRepository.findBySchoolIdAndIsActive(
                    school.getId(), active, pageable
            );
        }

        List<StudentProfileResponse> content = studentPage.getContent().stream()
                .map(studentMapper::toRosterResponse)
                .collect(Collectors.toList());

        return new PageResponse<>(content, studentPage.getNumber(), studentPage.getSize(),
                studentPage.getTotalElements(), studentPage.getTotalPages());
    }

    @Transactional(readOnly = true)
    public StudentProfileResponse getStudent(Long actorAccountId, Long studentProfileId) {
        School school = getActorSchool(actorAccountId);

        StudentProfile profile = studentProfileRepository.findByIdAndSchoolId(studentProfileId, school.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found with id: " + studentProfileId));

        return studentMapper.toProfileResponse(profile);
    }

    @Transactional
    public StudentProfileResponse updateStudent(Long actorAccountId, Long studentProfileId, UpdateStudentRequest request) {
        School school = getActorSchool(actorAccountId);

        StudentProfile profile = studentProfileRepository.findByIdAndSchoolId(studentProfileId, school.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found with id: " + studentProfileId));

        if (!profile.isActive()) {
            throw new ArchivedStudentProfileException("Archived student profiles cannot be edited.");
        }

        Classroom classroom = classroomRepository.findByIdAndSchoolId(request.getClassroomId(), school.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found with id: " + request.getClassroomId()));

        validateGradeLevel(school.getEducationLevel(), classroom.getGradeLevel());

        String schoolNumber = request.getSchoolNumber().trim();
        if (studentProfileRepository.existsBySchoolIdAndSchoolNumberAndIdNot(school.getId(), schoolNumber, profile.getId())) {
            throw new DuplicateSchoolNumberException(
                    "A student with school number '" + schoolNumber + "' already exists in this school."
            );
        }

        profile.setSchoolNumber(schoolNumber);
        profile.getStudentIdentity().setFirstName(request.getFirstName().trim());
        profile.getStudentIdentity().setLastName(request.getLastName().trim());
        for (StudentProfile enrollment : studentProfileRepository.findAllByStudentIdentityId(profile.getStudentIdentity().getId())) {
            enrollment.setFirstName(request.getFirstName().trim());
            enrollment.setLastName(request.getLastName().trim());
        }
        profile.setClassroom(classroom);

        studentProfileRepository.saveAll(studentProfileRepository.findAllByStudentIdentityId(profile.getStudentIdentity().getId()));
        StudentProfile updatedProfile = studentProfileRepository.saveAndFlush(profile);
        return studentMapper.toProfileResponse(updatedProfile);
    }

    @Transactional
    public StudentProfileResponse archiveStudent(Long actorAccountId, Long studentProfileId) {
        School school = getActorSchool(actorAccountId);

        StudentProfile profile = studentProfileRepository.findByIdAndSchoolId(studentProfileId, school.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found with id: " + studentProfileId));

        profile.setActive(false);

        if (profile.getUserAccount() != null) {
            UserAccount studentAccount = profile.getUserAccount();
            studentAccount.setActive(false);
            studentAccount.setCredentialVersion(studentAccount.getCredentialVersion() + 1);
            userAccountRepository.save(studentAccount);
        }

        StudentProfile archivedProfile = studentProfileRepository.saveAndFlush(profile);
        return studentMapper.toProfileResponse(archivedProfile);
    }

    @Transactional
    public StudentProfileResponse restoreStudent(Long actorAccountId, Long studentProfileId) {
        School school = getActorSchool(actorAccountId);

        StudentProfile profile = studentProfileRepository.findByIdAndSchoolId(studentProfileId, school.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found with id: " + studentProfileId));

        boolean restoringArchivedProfile = !profile.isActive();
        if (restoringArchivedProfile && studentProfileRepository.existsByStudentIdentityIdAndIsActiveTrue(profile.getStudentIdentity().getId())) {
            throw new IllegalStateException("This student is active at another school. Archive that enrollment before restoring this one.");
        }
        profile.setActive(true);

        if (profile.getUserAccount() != null) {
            UserAccount studentAccount = profile.getUserAccount();
            if (restoringArchivedProfile || !studentAccount.isActive()) {
                studentAccount.setCredentialVersion(studentAccount.getCredentialVersion() + 1);
            }
            studentAccount.setActive(true);
            userAccountRepository.save(studentAccount);
        }

        StudentProfile restoredProfile = studentProfileRepository.saveAndFlush(profile);
        return studentMapper.toProfileResponse(restoredProfile);
    }

    private School getActorSchool(Long actorAccountId) {
        SchoolMembership actorMembership = schoolMembershipRepository.findByUserAccountId(actorAccountId)
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated administrator is not associated with any school."));
        return actorMembership.getSchool();
    }
}
