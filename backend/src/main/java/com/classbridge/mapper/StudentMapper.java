package com.classbridge.mapper;

import com.classbridge.domain.Classroom;
import com.classbridge.domain.ParentProfile;
import com.classbridge.domain.School;
import com.classbridge.domain.StudentProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.dto.CreateStudentRequest;
import com.classbridge.dto.CreateStudentResponse;
import com.classbridge.dto.StudentProfileResponse;
import org.springframework.stereotype.Component;

@Component
public class StudentMapper {

    public StudentProfile toEntity(CreateStudentRequest request,
                                  School school,
                                  Classroom classroom,
                                  ParentProfile parentProfile,
                                  UserAccount studentAccount) {
        StudentProfile profile = new StudentProfile();
        profile.setSchool(school);
        profile.setClassroom(classroom);
        profile.setParentProfile(parentProfile);
        profile.setUserAccount(studentAccount);
        profile.setSchoolNumber(request.getSchoolNumber().trim());
        profile.setFirstName(request.getFirstName().trim());
        profile.setLastName(request.getLastName().trim());
        profile.setActive(true);
        return profile;
    }

    public CreateStudentResponse toResponse(StudentProfile profile, String initialPassword) {
        CreateStudentResponse response = new CreateStudentResponse();
        response.setId(profile.getId());
        response.setSchoolId(profile.getSchool().getId());
        response.setClassroomId(profile.getClassroom().getId());
        response.setGradeLevel(profile.getClassroom().getGradeLevel());
        response.setSectionName(profile.getClassroom().getSectionName());
        response.setSchoolNumber(profile.getSchoolNumber());
        response.setFirstName(profile.getFirstName());
        response.setLastName(profile.getLastName());
        response.setActive(profile.isActive());

        if (profile.getParentProfile() != null) {
            response.setParentProfileId(profile.getParentProfile().getId());
            if (profile.getParentProfile().getUserAccount() != null) {
                response.setParentUsername(profile.getParentProfile().getUserAccount().getUsername());
            }
        }

        if (profile.getUserAccount() != null) {
            response.setStudentUserAccountId(profile.getUserAccount().getId());
            response.setStudentUsername(profile.getUserAccount().getUsername());
            response.setInitialPassword(initialPassword);
        }

        response.setCreatedAt(profile.getCreatedAt());
        return response;
    }

    public StudentProfileResponse toProfileResponse(StudentProfile profile) {
        StudentProfileResponse response = new StudentProfileResponse();
        response.setId(profile.getId());
        response.setSchoolNumber(profile.getSchoolNumber());
        response.setFirstName(profile.getFirstName());
        response.setLastName(profile.getLastName());
        response.setSchoolId(profile.getSchool().getId());
        response.setClassroomId(profile.getClassroom().getId());
        response.setGradeLevel(profile.getClassroom().getGradeLevel());
        response.setSectionName(profile.getClassroom().getSectionName());
        response.setActive(profile.isActive());
        response.setCreatedAt(profile.getCreatedAt());
        response.setUpdatedAt(profile.getUpdatedAt());

        if (profile.getParentProfile() != null) {
            ParentProfile parent = profile.getParentProfile();
            response.setParentProfileId(parent.getId());
            response.setParentFirstName(parent.getFirstName());
            response.setParentLastName(parent.getLastName());
            if (parent.getUserAccount() != null) {
                response.setParentUsername(parent.getUserAccount().getUsername());
            }
        }

        if (profile.getUserAccount() != null) {
            UserAccount studentAccount = profile.getUserAccount();
            response.setStudentUserAccountId(studentAccount.getId());
            response.setStudentUsername(studentAccount.getUsername());
        }

        return response;
    }
}
