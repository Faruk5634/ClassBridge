package com.classbridge.service;

import com.classbridge.domain.Classroom;
import com.classbridge.domain.ParentProfile;
import com.classbridge.domain.School;
import com.classbridge.domain.SchoolLevel;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.CreateStudentRequest;
import com.classbridge.mapper.StudentMapper;
import com.classbridge.repository.ClassroomRepository;
import com.classbridge.repository.ParentProfileRepository;
import com.classbridge.repository.ParentSchoolRegistrationRepository;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.StudentProfileRepository;
import com.classbridge.repository.StudentIdentityRepository;
import com.classbridge.repository.UserAccountRepository;
import com.classbridge.security.InitialPasswordGenerator;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StudentCrossSchoolParentTests {

    @Test
    void enrollmentLinksAnExistingParentAccountFromAnotherSchool() {
        SchoolMembershipRepository memberships = mock(SchoolMembershipRepository.class);
        ClassroomRepository classrooms = mock(ClassroomRepository.class);
        UserAccountRepository accounts = mock(UserAccountRepository.class);
        ParentProfileRepository parents = mock(ParentProfileRepository.class);
        ParentSchoolRegistrationRepository registrations = mock(ParentSchoolRegistrationRepository.class);
        StudentProfileRepository students = mock(StudentProfileRepository.class);
        StudentIdentityRepository identities = mock(StudentIdentityRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);

        StudentService service = new StudentService(memberships, classrooms, accounts, parents, registrations,
                students, identities, new InitialPasswordGenerator(), encoder, new StudentMapper());

        School school = new School();
        school.setId(2L);
        school.setName("Primary School");
        school.setEducationLevel(SchoolLevel.PRIMARY);
        SchoolMembership administrator = new SchoolMembership();
        administrator.setSchool(school);
        UserAccount administratorAccount = account(20L, "school.admin", UserRole.SCHOOL_ADMIN);
        administrator.setUserAccount(administratorAccount);

        Classroom classroom = new Classroom();
        classroom.setId(5L);
        classroom.setSchool(school);
        classroom.setGradeLevel(3);
        classroom.setSectionName("A");

        UserAccount existingParentAccount = account(30L, "family.parent", UserRole.PARENT);
        ParentProfile existingParentProfile = new ParentProfile();
        existingParentProfile.setId(40L);
        existingParentProfile.setUserAccount(existingParentAccount);
        existingParentProfile.setFirstName("Family");
        existingParentProfile.setLastName("Parent");

        when(memberships.findByUserAccountId(20L)).thenReturn(Optional.of(administrator));
        when(classrooms.findByIdAndSchoolId(5L, 2L)).thenReturn(Optional.of(classroom));
        when(accounts.findByUsername("family.parent")).thenReturn(Optional.of(existingParentAccount));
        when(parents.findByUserAccountId(30L)).thenReturn(Optional.of(existingParentProfile));
        when(students.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(identities.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        CreateStudentRequest request = new CreateStudentRequest();
        request.setSchoolNumber("P-003");
        request.setFirstName("Student");
        request.setLastName("One");
        request.setClassroomId(5L);
        request.setParentUsername("family.parent");

        var created = service.enrollStudent(20L, request);

        assertEquals("family.parent", created.getParentUsername());
        assertEquals(2L, created.getSchoolId());
        verify(registrations).save(any());
    }

    private static UserAccount account(Long id, String username, UserRole role) {
        UserAccount account = new UserAccount();
        account.setId(id);
        account.setUsername(username);
        account.setRole(role);
        account.setActive(true);
        return account;
    }
}
