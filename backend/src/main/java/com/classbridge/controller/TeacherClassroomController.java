package com.classbridge.controller;

import com.classbridge.domain.Classroom;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.StudentProfile;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.TeacherClassroomDetailResponse;
import com.classbridge.dto.TeacherClassroomResponse;
import com.classbridge.dto.TeacherStudentResponse;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.repository.ClassroomRepository;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.StudentProfileRepository;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/teacher/classrooms")
public class TeacherClassroomController {
    private final SchoolMembershipRepository membershipRepository;
    private final ClassroomRepository classroomRepository;
    private final StudentProfileRepository studentProfileRepository;

    public TeacherClassroomController(SchoolMembershipRepository membershipRepository,
                                      ClassroomRepository classroomRepository,
                                      StudentProfileRepository studentProfileRepository) {
        this.membershipRepository = membershipRepository;
        this.classroomRepository = classroomRepository;
        this.studentProfileRepository = studentProfileRepository;
    }

    /** The complete school directory is used only to target school-wide announcements. */
    @GetMapping
    @Transactional(readOnly = true)
    public List<TeacherClassroomResponse> getSchoolClassrooms(@AuthenticationPrincipal Jwt jwt) {
        SchoolMembership membership = teacherMembership(jwt);
        return classroomRepository.findBySchoolIdOrderByGradeLevelAscSectionNameAsc(membership.getSchool().getId()).stream()
                .map(this::toClassroomResponse)
                .toList();
    }

    @GetMapping("/homeroom")
    @Transactional(readOnly = true)
    public List<TeacherClassroomResponse> getHomeroomClassrooms(@AuthenticationPrincipal Jwt jwt) {
        SchoolMembership membership = teacherMembership(jwt);
        Long teacherId = membership.getUserAccount().getId();
        return classroomRepository.findHomeroomClassrooms(
                        membership.getSchool().getId(), teacherId).stream()
                .map(this::toClassroomResponse)
                .toList();
    }

    @GetMapping("/{classroomId}")
    @Transactional(readOnly = true)
    public TeacherClassroomDetailResponse getHomeroomClassroom(@AuthenticationPrincipal Jwt jwt,
                                                                @PathVariable Long classroomId) {
        SchoolMembership membership = teacherMembership(jwt);
        Classroom classroom = classroomRepository.findByIdAndSchoolId(classroomId, membership.getSchool().getId())
                .filter(room -> room.getHomeroomTeacher() != null
                        && room.getHomeroomTeacher().getId().equals(membership.getUserAccount().getId()))
                .orElseThrow(() -> new ResourceNotFoundException("Homeroom classroom not found with id: " + classroomId));
        List<TeacherStudentResponse> students = studentProfileRepository
                .findActiveBySchoolIdAndClassroomId(membership.getSchool().getId(), classroomId).stream()
                .map(this::toStudentResponse)
                .toList();
        return new TeacherClassroomDetailResponse(classroom.getId(), classroom.getGradeLevel(),
                classroom.getSectionName(), students);
    }

    private SchoolMembership teacherMembership(Jwt jwt) {
        Long accountId = Long.valueOf(jwt.getSubject());
        SchoolMembership membership = membershipRepository.findByUserAccountId(accountId)
                .orElseThrow(() -> new ForbiddenOperationException("Teacher account has no school membership."));
        if (membership.getUserAccount().getRole() != UserRole.TEACHER) {
            throw new ForbiddenOperationException("Only teachers may view the school classroom list.");
        }
        return membership;
    }

    private TeacherClassroomResponse toClassroomResponse(Classroom room) {
        return new TeacherClassroomResponse(room.getId(), room.getGradeLevel(), room.getSectionName());
    }

    private TeacherStudentResponse toStudentResponse(StudentProfile student) {
        Classroom classroom = student.getClassroom();
        return new TeacherStudentResponse(student.getId(), student.getSchoolNumber(), student.getFirstName(),
                student.getLastName(), classroom.getId(), classroom.getGradeLevel(), classroom.getSectionName());
    }
}
