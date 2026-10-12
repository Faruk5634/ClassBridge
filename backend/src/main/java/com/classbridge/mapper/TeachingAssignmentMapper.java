package com.classbridge.mapper;

import com.classbridge.domain.Classroom;
import com.classbridge.domain.TeachingAssignment;
import com.classbridge.domain.UserAccount;
import com.classbridge.dto.TeachingAssignmentResponse;
import org.springframework.stereotype.Component;

@Component
public class TeachingAssignmentMapper {

    public TeachingAssignment toEntity(Classroom classroom, UserAccount teacher) {
        TeachingAssignment assignment = new TeachingAssignment();
        assignment.setClassroom(classroom);
        assignment.setTeacher(teacher);
        return assignment;
    }

    public TeachingAssignmentResponse toResponse(TeachingAssignment assignment) {
        TeachingAssignmentResponse response = new TeachingAssignmentResponse();
        response.setId(assignment.getId());
        response.setClassroomId(assignment.getClassroom().getId());
        response.setTeacherAccountId(assignment.getTeacher().getId());
        response.setCreatedAt(assignment.getCreatedAt());
        response.setUpdatedAt(assignment.getUpdatedAt());
        return response;
    }
}
