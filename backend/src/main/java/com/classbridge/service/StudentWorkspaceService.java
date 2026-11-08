package com.classbridge.service;

import com.classbridge.domain.StaffProfile;
import com.classbridge.domain.StudentProfile;
import com.classbridge.dto.StudentWorkspaceProfileResponse;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.repository.StaffProfileRepository;
import com.classbridge.repository.StudentProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StudentWorkspaceService {
    private final StudentProfileRepository studentProfileRepository;
    private final StaffProfileRepository staffProfileRepository;

    public StudentWorkspaceService(StudentProfileRepository studentProfileRepository,
                                   StaffProfileRepository staffProfileRepository) {
        this.studentProfileRepository = studentProfileRepository;
        this.staffProfileRepository = staffProfileRepository;
    }

    @Transactional(readOnly = true)
    public StudentWorkspaceProfileResponse getOwnProfile(Long accountId) {
        StudentProfile student = studentProfileRepository.findActiveByUserAccountId(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("No active student profile is linked to this account."));
        if (student.getClassroom().getHomeroomTeacher() == null) {
            return new StudentWorkspaceProfileResponse(
                    student.getId(), student.getSchool().getId(), student.getSchool().getName(),
                    student.getClassroom().getId(), student.getClassroom().getGradeLevel(),
                    student.getClassroom().getSectionName(), null);
        }
        Long teacherAccountId = student.getClassroom().getHomeroomTeacher().getId();
        StaffProfile teacher = staffProfileRepository.findByUserAccountId(teacherAccountId).orElse(null);
        String teacherName = teacher == null
                ? student.getClassroom().getHomeroomTeacher().getUsername()
                : teacher.getFirstName() + " " + teacher.getLastName();

        return new StudentWorkspaceProfileResponse(
                student.getId(),
                student.getSchool().getId(),
                student.getSchool().getName(),
                student.getClassroom().getId(),
                student.getClassroom().getGradeLevel(),
                student.getClassroom().getSectionName(),
                teacherName
        );
    }
}
