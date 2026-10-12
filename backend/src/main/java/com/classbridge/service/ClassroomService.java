package com.classbridge.service;

import com.classbridge.domain.Classroom;
import com.classbridge.domain.School;
import com.classbridge.domain.SchoolLevel;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.ClassroomRequest;
import com.classbridge.dto.ClassroomResponse;
import com.classbridge.exception.DuplicateClassroomException;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.InvalidGradeLevelException;
import com.classbridge.exception.InvalidHomeroomTeacherException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.mapper.ClassroomMapper;
import com.classbridge.repository.ClassroomRepository;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.UserAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ClassroomService {

    private final ClassroomRepository classroomRepository;
    private final SchoolMembershipRepository schoolMembershipRepository;
    private final UserAccountRepository userAccountRepository;
    private final ClassroomMapper classroomMapper;

    public ClassroomService(ClassroomRepository classroomRepository,
                            SchoolMembershipRepository schoolMembershipRepository,
                            UserAccountRepository userAccountRepository,
                            ClassroomMapper classroomMapper) {
        this.classroomRepository = classroomRepository;
        this.schoolMembershipRepository = schoolMembershipRepository;
        this.userAccountRepository = userAccountRepository;
        this.classroomMapper = classroomMapper;
    }

    @Transactional
    public ClassroomResponse createClassroom(Long actorAccountId, ClassroomRequest request) {
        School school = getActorSchool(actorAccountId);
        validateGradeLevel(school.getEducationLevel(), request.getGradeLevel());
        UserAccount homeroomTeacher = validateAndGetHomeroomTeacher(request.getHomeroomTeacherAccountId(), school.getId());

        String sectionName = request.getSectionName() != null ? request.getSectionName().trim() : "";
        if (classroomRepository.existsBySchoolIdAndGradeLevelAndSectionName(school.getId(), request.getGradeLevel(), sectionName)) {
            throw new DuplicateClassroomException(
                    "A classroom with grade level " + request.getGradeLevel() + " and section '" + sectionName + "' already exists in this school."
            );
        }

        Classroom classroom = classroomMapper.toEntity(request, school, homeroomTeacher);
        Classroom savedClassroom = classroomRepository.save(classroom);
        return classroomMapper.toResponse(savedClassroom);
    }

    @Transactional(readOnly = true)
    public List<ClassroomResponse> getClassrooms(Long actorAccountId) {
        School school = getActorSchool(actorAccountId);
        return classroomRepository.findBySchoolIdOrderByGradeLevelAscSectionNameAsc(school.getId()).stream()
                .map(classroomMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ClassroomResponse getClassroom(Long actorAccountId, Long classroomId) {
        School school = getActorSchool(actorAccountId);
        Classroom classroom = classroomRepository.findByIdAndSchoolId(classroomId, school.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found with id: " + classroomId));
        return classroomMapper.toResponse(classroom);
    }

    @Transactional
    public ClassroomResponse updateClassroom(Long actorAccountId, Long classroomId, ClassroomRequest request) {
        School school = getActorSchool(actorAccountId);
        Classroom classroom = classroomRepository.findByIdAndSchoolId(classroomId, school.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found with id: " + classroomId));

        validateGradeLevel(school.getEducationLevel(), request.getGradeLevel());
        UserAccount homeroomTeacher = validateAndGetHomeroomTeacher(request.getHomeroomTeacherAccountId(), school.getId());

        String sectionName = request.getSectionName() != null ? request.getSectionName().trim() : "";
        if (classroomRepository.existsBySchoolIdAndGradeLevelAndSectionNameAndIdNot(school.getId(), request.getGradeLevel(), sectionName, classroomId)) {
            throw new DuplicateClassroomException(
                    "A classroom with grade level " + request.getGradeLevel() + " and section '" + sectionName + "' already exists in this school."
            );
        }

        classroomMapper.updateEntity(classroom, request, homeroomTeacher);
        Classroom updatedClassroom = classroomRepository.saveAndFlush(classroom);
        return classroomMapper.toResponse(updatedClassroom);
    }

    private School getActorSchool(Long actorAccountId) {
        SchoolMembership membership = schoolMembershipRepository.findByUserAccountId(actorAccountId)
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated administrator is not associated with any school."));
        return membership.getSchool();
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
                    "Grade level " + gradeLevel + " is not valid for school level " + educationLevel + "."
            );
        }
    }

    private UserAccount validateAndGetHomeroomTeacher(Long teacherAccountId, Long schoolId) {
        if (teacherAccountId == null) {
            throw new InvalidHomeroomTeacherException("Homeroom teacher account ID is required.");
        }
        UserAccount teacherAccount = userAccountRepository.findById(teacherAccountId)
                .orElseThrow(() -> new InvalidHomeroomTeacherException("Homeroom teacher account not found with id: " + teacherAccountId));

        if (teacherAccount.getRole() != UserRole.TEACHER) {
            throw new InvalidHomeroomTeacherException("Account with id " + teacherAccountId + " does not have the TEACHER role.");
        }

        SchoolMembership teacherMembership = schoolMembershipRepository.findByUserAccountId(teacherAccountId)
                .orElseThrow(() -> new InvalidHomeroomTeacherException("Homeroom teacher is not associated with any school."));

        if (!teacherMembership.getSchool().getId().equals(schoolId)) {
            throw new InvalidHomeroomTeacherException("Homeroom teacher belongs to a different school.");
        }

        return teacherAccount;
    }
}
