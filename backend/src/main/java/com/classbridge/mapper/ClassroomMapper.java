package com.classbridge.mapper;

import com.classbridge.domain.Classroom;
import com.classbridge.domain.School;
import com.classbridge.domain.UserAccount;
import com.classbridge.dto.ClassroomRequest;
import com.classbridge.dto.ClassroomResponse;
import org.springframework.stereotype.Component;

@Component
public class ClassroomMapper {

    public Classroom toEntity(ClassroomRequest request, School school, UserAccount homeroomTeacher) {
        Classroom classroom = new Classroom();
        classroom.setSchool(school);
        classroom.setGradeLevel(request.getGradeLevel());
        classroom.setSectionName(request.getSectionName() != null ? request.getSectionName().trim() : null);
        classroom.setHomeroomTeacher(homeroomTeacher);
        return classroom;
    }

    public void updateEntity(Classroom classroom, ClassroomRequest request, UserAccount homeroomTeacher) {
        classroom.setGradeLevel(request.getGradeLevel());
        classroom.setSectionName(request.getSectionName() != null ? request.getSectionName().trim() : null);
        classroom.setHomeroomTeacher(homeroomTeacher);
    }

    public ClassroomResponse toResponse(Classroom classroom) {
        ClassroomResponse response = new ClassroomResponse();
        response.setId(classroom.getId());
        response.setSchoolId(classroom.getSchool().getId());
        response.setGradeLevel(classroom.getGradeLevel());
        response.setSectionName(classroom.getSectionName());
        response.setHomeroomTeacherAccountId(classroom.getHomeroomTeacher() == null
                ? null
                : classroom.getHomeroomTeacher().getId());
        response.setCreatedAt(classroom.getCreatedAt());
        response.setUpdatedAt(classroom.getUpdatedAt());
        return response;
    }
}
