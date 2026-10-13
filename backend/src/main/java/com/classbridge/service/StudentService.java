package com.classbridge.service;

import com.classbridge.domain.Classroom;
import com.classbridge.domain.ParentProfile;
import com.classbridge.domain.School;
import com.classbridge.domain.SchoolLevel;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.StudentProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.CreateStudentRequest;
import com.classbridge.dto.CreateStudentResponse;
import com.classbridge.dto.PageResponse;
import com.classbridge.dto.StudentProfileResponse;
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
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.StudentProfileRepository;
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
    private final StudentProfileRepository studentProfileRepository;
    private final InitialPasswordGenerator initialPasswordGenerator;
    private final PasswordEncoder passwordEncoder;
    private final StudentMapper studentMapper;

    public StudentService(SchoolMembershipRepository schoolMembershipRepository,
                          ClassroomRepository classroomRepository,
                          UserAccountRepository userAccountRepository,
                          ParentProfileRepository parentProfileRepository,
                          StudentProfileRepository studentProfileRepository,
                          InitialPasswordGenerator initialPasswordGenerator,
                          PasswordEncoder passwordEncoder,
                          StudentMapper studentMapper) {
        this.schoolMembershipRepository = schoolMembershipRepository;
        this.classroomRepository = classroomRepository;
        this.userAccountRepository = userAccountRepository;
        this.parentProfileRepository = parentProfileRepository;
        this.studentProfileRepository = studentProfileRepository;
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

        ParentProfile parentProfile = null;
        UserAccount studentAccount = null;
        String initialPassword = null;

        if (school.getEducationLevel() == SchoolLevel.PRIMARY || school.getEducationLevel() == SchoolLevel.MIDDLE) {
            if (StringUtils.hasText(request.getStudentUsername())) {
                throw new InvalidStudentEnrollmentException(
                        "Student accounts are not permitted for " + school.getEducationLevel() + " school students."
                );
            }
            if (!StringUtils.hasText(request.getParentUsername())) {
                throw new InvalidStudentEnrollmentException(
                        "A parent username is required for " + school.getEducationLevel() + " school students."
                );
            }
            parentProfile = validateAndGetParentProfile(request.getParentUsername());
        } else if (school.getEducationLevel() == SchoolLevel.HIGH_SCHOOL) {
            if (!StringUtils.hasText(request.getStudentUsername())) {
                throw new InvalidStudentEnrollmentException(
                        "Student username is required for high-school students."
                );
            }
            String studentUsername = request.getStudentUsername().trim();
            if (userAccountRepository.existsByUsername(studentUsername)) {
                throw new DuplicateUsernameException("Username is already taken: " + studentUsername);
            }

            if (StringUtils.hasText(request.getParentUsername())) {
                parentProfile = validateAndGetParentProfile(request.getParentUsername());
            }

            initialPassword = initialPasswordGenerator.generatePassword();
            String passwordHash = passwordEncoder.encode(initialPassword);

            UserAccount account = new UserAccount();
            account.setUsername(studentUsername);
            account.setPasswordHash(passwordHash);
            account.setRole(UserRole.STUDENT);
            account.setActive(true);
            studentAccount = userAccountRepository.save(account);
        }

        StudentProfile studentProfile = studentMapper.toEntity(
                request, school, classroom, parentProfile, studentAccount
        );
        StudentProfile savedProfile = studentProfileRepository.save(studentProfile);

        return studentMapper.toResponse(savedProfile, initialPassword);
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

    private ParentProfile validateAndGetParentProfile(String parentUsername) {
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

        return parentProfileRepository.findByUserAccountId(parentAccount.getId())
                .orElseThrow(() -> new InvalidStudentEnrollmentException(
                        "Parent profile not found for account: " + trimmedUsername
                ));
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
                .map(studentMapper::toProfileResponse)
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
        profile.setFirstName(request.getFirstName().trim());
        profile.setLastName(request.getLastName().trim());
        profile.setClassroom(classroom);

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
            userAccountRepository.save(studentAccount);
        }

        StudentProfile archivedProfile = studentProfileRepository.saveAndFlush(profile);
        return studentMapper.toProfileResponse(archivedProfile);
    }

    private School getActorSchool(Long actorAccountId) {
        SchoolMembership actorMembership = schoolMembershipRepository.findByUserAccountId(actorAccountId)
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated administrator is not associated with any school."));
        return actorMembership.getSchool();
    }
}
