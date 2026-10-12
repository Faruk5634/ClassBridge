package com.classbridge.service;

import com.classbridge.domain.Classroom;
import com.classbridge.domain.School;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.TeachingAssignment;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.CreateTeachingAssignmentRequest;
import com.classbridge.dto.TeachingAssignmentResponse;
import com.classbridge.exception.DuplicateTeachingAssignmentException;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.InvalidTeachingAssignmentException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.mapper.TeachingAssignmentMapper;
import com.classbridge.repository.ClassroomRepository;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.TeachingAssignmentRepository;
import com.classbridge.repository.UserAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class TeachingAssignmentService {

    private final TeachingAssignmentRepository teachingAssignmentRepository;
    private final ClassroomRepository classroomRepository;
    private final SchoolMembershipRepository schoolMembershipRepository;
    private final UserAccountRepository userAccountRepository;
    private final TeachingAssignmentMapper teachingAssignmentMapper;

    public TeachingAssignmentService(TeachingAssignmentRepository teachingAssignmentRepository,
                                    ClassroomRepository classroomRepository,
                                    SchoolMembershipRepository schoolMembershipRepository,
                                    UserAccountRepository userAccountRepository,
                                    TeachingAssignmentMapper teachingAssignmentMapper) {
        this.teachingAssignmentRepository = teachingAssignmentRepository;
        this.classroomRepository = classroomRepository;
        this.schoolMembershipRepository = schoolMembershipRepository;
        this.userAccountRepository = userAccountRepository;
        this.teachingAssignmentMapper = teachingAssignmentMapper;
    }

    @Transactional
    public TeachingAssignmentResponse createTeachingAssignment(Long actorAccountId,
                                                               Long classroomId,
                                                               CreateTeachingAssignmentRequest request) {
        School school = getActorSchool(actorAccountId);
        Classroom classroom = getVerifiedClassroom(classroomId, school.getId());
        UserAccount teacher = validateAndGetTeacher(request.getTeacherAccountId(), school.getId());

        if (teachingAssignmentRepository.existsByClassroomIdAndTeacherId(classroom.getId(), teacher.getId())) {
            throw new DuplicateTeachingAssignmentException(
                    "Teacher with id " + teacher.getId() + " is already assigned to classroom " + classroom.getId() + "."
            );
        }

        TeachingAssignment assignment = teachingAssignmentMapper.toEntity(classroom, teacher);
        TeachingAssignment savedAssignment = teachingAssignmentRepository.save(assignment);
        return teachingAssignmentMapper.toResponse(savedAssignment);
    }

    @Transactional(readOnly = true)
    public List<TeachingAssignmentResponse> getTeachingAssignments(Long actorAccountId, Long classroomId) {
        School school = getActorSchool(actorAccountId);
        Classroom classroom = getVerifiedClassroom(classroomId, school.getId());

        return teachingAssignmentRepository.findByClassroomIdOrderByCreatedAtAsc(classroom.getId()).stream()
                .map(teachingAssignmentMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteTeachingAssignment(Long actorAccountId, Long classroomId, Long teacherAccountId) {
        School school = getActorSchool(actorAccountId);
        Classroom classroom = getVerifiedClassroom(classroomId, school.getId());

        TeachingAssignment assignment = teachingAssignmentRepository.findByClassroomIdAndTeacherId(classroom.getId(), teacherAccountId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Teaching assignment not found for classroom id: " + classroomId + " and teacher id: " + teacherAccountId
                ));

        teachingAssignmentRepository.delete(assignment);
    }

    private School getActorSchool(Long actorAccountId) {
        SchoolMembership membership = schoolMembershipRepository.findByUserAccountId(actorAccountId)
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated administrator is not associated with any school."));
        return membership.getSchool();
    }

    private Classroom getVerifiedClassroom(Long classroomId, Long schoolId) {
        return classroomRepository.findByIdAndSchoolId(classroomId, schoolId)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found with id: " + classroomId));
    }

    private UserAccount validateAndGetTeacher(Long teacherAccountId, Long schoolId) {
        if (teacherAccountId == null) {
            throw new InvalidTeachingAssignmentException("Teacher account ID is required.");
        }
        UserAccount teacher = userAccountRepository.findById(teacherAccountId)
                .orElseThrow(() -> new InvalidTeachingAssignmentException("Teacher account not found with id: " + teacherAccountId));

        if (teacher.getRole() != UserRole.TEACHER) {
            throw new InvalidTeachingAssignmentException("Account with id " + teacherAccountId + " does not have the TEACHER role.");
        }

        SchoolMembership teacherMembership = schoolMembershipRepository.findByUserAccountId(teacherAccountId)
                .orElseThrow(() -> new InvalidTeachingAssignmentException("Teacher is not associated with any school."));

        if (!teacherMembership.getSchool().getId().equals(schoolId)) {
            throw new InvalidTeachingAssignmentException("Teacher belongs to a different school.");
        }

        return teacher;
    }
}
