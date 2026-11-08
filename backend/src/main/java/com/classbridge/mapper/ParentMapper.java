package com.classbridge.mapper;

import com.classbridge.domain.ParentProfile;
import com.classbridge.domain.StudentProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.ChildResponse;
import com.classbridge.dto.CreateParentRequest;
import com.classbridge.dto.CreateParentResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class ParentMapper {

    public UserAccount toUserAccountEntity(CreateParentRequest request, String passwordHash) {
        UserAccount account = new UserAccount();
        account.setUsername(request.getUsername().trim());
        account.setPasswordHash(passwordHash);
        account.setRole(UserRole.PARENT);
        account.setEmail(StringUtils.hasText(request.getEmail()) ? request.getEmail().trim() : null);
        account.setPhoneNumber(StringUtils.hasText(request.getPhoneNumber()) ? request.getPhoneNumber().trim() : null);
        account.setActive(true);
        account.setMustChangePassword(true);
        return account;
    }

    public ParentProfile toParentProfileEntity(CreateParentRequest request, UserAccount userAccount) {
        ParentProfile profile = new ParentProfile();
        profile.setUserAccount(userAccount);
        profile.setFirstName(request.getFirstName().trim());
        profile.setLastName(request.getLastName().trim());
        return profile;
    }

    public CreateParentResponse toResponse(UserAccount userAccount, ParentProfile parentProfile, String initialPassword) {
        CreateParentResponse response = new CreateParentResponse();
        response.setUserAccountId(userAccount.getId());
        response.setParentProfileId(parentProfile.getId());
        response.setUsername(userAccount.getUsername());
        response.setFirstName(parentProfile.getFirstName());
        response.setLastName(parentProfile.getLastName());
        response.setRole(userAccount.getRole());
        response.setEmail(userAccount.getEmail());
        response.setPhoneNumber(userAccount.getPhoneNumber());
        response.setActive(userAccount.isActive());
        response.setInitialPassword(initialPassword);
        response.setCreatedAt(userAccount.getCreatedAt());
        return response;
    }

    public ChildResponse toChildResponse(StudentProfile profile) {
        ChildResponse response = new ChildResponse();
        response.setId(profile.getId());
        response.setStudentProfileId(profile.getId());
        response.setFirstName(profile.getFirstName());
        response.setLastName(profile.getLastName());
        response.setSchoolName(profile.getSchool().getName());
        response.setEducationLevel(profile.getSchool().getEducationLevel());
        response.setClassroomId(profile.getClassroom().getId());
        response.setGradeLevel(profile.getClassroom().getGradeLevel());
        response.setSectionName(profile.getClassroom().getSectionName());
        return response;
    }
}
