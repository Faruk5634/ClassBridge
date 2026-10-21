package com.classbridge.controller;

import com.classbridge.domain.SchoolLevel;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.StudentProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.TeacherStudentResponse;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.StudentProfileRepository;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/teacher/students")
public class TeacherStudentController {
    private final SchoolMembershipRepository membershipRepository;
    private final StudentProfileRepository studentProfileRepository;

    public TeacherStudentController(SchoolMembershipRepository membershipRepository,
                                    StudentProfileRepository studentProfileRepository) {
        this.membershipRepository = membershipRepository;
        this.studentProfileRepository = studentProfileRepository;
    }

    /** Returns only active students who can receive a school-context message. */
    @GetMapping
    @Transactional(readOnly = true)
    public List<TeacherStudentResponse> getMessageableStudents(@AuthenticationPrincipal Jwt jwt) {
        Long accountId = Long.valueOf(jwt.getSubject());
        SchoolMembership membership = membershipRepository.findByUserAccountId(accountId)
                .filter(value -> value.getUserAccount().getRole() == UserRole.TEACHER)
                .orElseThrow(() -> new ForbiddenOperationException("Only teachers with a school membership may message students."));
        Long schoolId = membership.getSchool().getId();
        SchoolLevel level = membership.getSchool().getEducationLevel();
        return studentProfileRepository.findActiveBySchoolId(schoolId).stream()
                .filter(student -> canReceiveMessage(student, level))
                .map(student -> {
                    var room = student.getClassroom();
                    return new TeacherStudentResponse(student.getId(), student.getSchoolNumber(), student.getFirstName(),
                            student.getLastName(), room.getId(), room.getGradeLevel(), room.getSectionName());
                })
                .toList();
    }

    private boolean canReceiveMessage(StudentProfile student, SchoolLevel level) {
        UserAccount recipient = level == SchoolLevel.HIGH_SCHOOL
                ? student.getUserAccount()
                : student.getParentProfile() == null ? null : student.getParentProfile().getUserAccount();
        return recipient != null && recipient.isActive();
    }
}
