package com.classbridge.service;

import com.classbridge.domain.School;
import com.classbridge.domain.SchoolLevel;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.StaffProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.AssignSchoolAdministratorRequest;
import com.classbridge.dto.SchoolAdministratorSummaryResponse;
import com.classbridge.exception.InvalidRoleException;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.SchoolRepository;
import com.classbridge.repository.StaffProfileRepository;
import com.classbridge.repository.UserAccountRepository;
import com.classbridge.security.InitialPasswordGenerator;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SchoolAdministratorServiceTests {

    private final SchoolRepository schoolRepository = mock(SchoolRepository.class);
    private final UserAccountRepository userAccountRepository = mock(UserAccountRepository.class);
    private final StaffProfileRepository staffProfileRepository = mock(StaffProfileRepository.class);
    private final SchoolMembershipRepository schoolMembershipRepository = mock(SchoolMembershipRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final InitialPasswordGenerator initialPasswordGenerator = new InitialPasswordGenerator();

    private final SchoolAdministratorService service = new SchoolAdministratorService(
            schoolRepository,
            userAccountRepository,
            staffProfileRepository,
            schoolMembershipRepository,
            passwordEncoder,
            initialPasswordGenerator
    );

    @Test
    void assignsUnassignedAdministratorWithExistingAccountRole() {
        School school = school(10L, "Atatürk High School", SchoolLevel.HIGH_SCHOOL);
        UserAccount admin = account(25L, "ayse.admin", UserRole.SCHOOL_VICE_ADMIN, true);
        StaffProfile profile = profile(admin, "Ayşe", "Yılmaz");

        when(schoolRepository.findById(10L)).thenReturn(Optional.of(school));
        when(userAccountRepository.findByIdForUpdate(25L)).thenReturn(Optional.of(admin));
        when(staffProfileRepository.findByUserAccountId(25L)).thenReturn(Optional.of(profile));
        when(schoolMembershipRepository.findByUserAccountId(25L)).thenReturn(Optional.empty());

        AssignSchoolAdministratorRequest request = new AssignSchoolAdministratorRequest();
        request.setUserAccountId(25L);
        request.setSchoolId(10L);

        SchoolAdministratorSummaryResponse result = service.assignAdministrator(10L, request);

        assertEquals(25L, result.getUserAccountId());
        assertEquals(UserRole.SCHOOL_VICE_ADMIN, result.getRole());
        assertEquals(10L, result.getSchoolId());
        verify(schoolMembershipRepository).save(any(SchoolMembership.class));
    }

    @Test
    void rejectsRoleChangeOrNonAdministratorDuringAssignment() {
        School school = school(10L, "Atatürk High School", SchoolLevel.HIGH_SCHOOL);
        UserAccount viceAdmin = account(25L, "ayse.admin", UserRole.SCHOOL_VICE_ADMIN, true);
        UserAccount teacher = account(30L, "mert.teacher", UserRole.TEACHER, true);

        when(schoolRepository.findById(10L)).thenReturn(Optional.of(school));
        when(userAccountRepository.findByIdForUpdate(25L)).thenReturn(Optional.of(viceAdmin));
        when(userAccountRepository.findByIdForUpdate(30L)).thenReturn(Optional.of(teacher));

        AssignSchoolAdministratorRequest upgradeAttempt = new AssignSchoolAdministratorRequest();
        upgradeAttempt.setUserAccountId(25L);
        upgradeAttempt.setRole(UserRole.SCHOOL_ADMIN);

        assertThrows(InvalidRoleException.class, () -> service.assignAdministrator(10L, upgradeAttempt));

        AssignSchoolAdministratorRequest teacherAttempt = new AssignSchoolAdministratorRequest();
        teacherAttempt.setUserAccountId(30L);

        assertThrows(InvalidRoleException.class, () -> service.assignAdministrator(10L, teacherAttempt));
        verify(schoolMembershipRepository, never()).save(any(SchoolMembership.class));
    }

    @Test
    void rejectsDuplicateAssignmentAndSecondSchoolAdmin() {
        School school = school(10L, "Atatürk High School", SchoolLevel.HIGH_SCHOOL);
        UserAccount principal = account(21L, "ali.principal", UserRole.SCHOOL_ADMIN, true);
        StaffProfile profile = profile(principal, "Ali", "Kaya");
        SchoolMembership existing = new SchoolMembership();
        existing.setSchool(school);
        existing.setUserAccount(principal);

        when(schoolRepository.findById(10L)).thenReturn(Optional.of(school));
        when(userAccountRepository.findByIdForUpdate(21L)).thenReturn(Optional.of(principal));
        when(staffProfileRepository.findByUserAccountId(21L)).thenReturn(Optional.of(profile));
        when(schoolMembershipRepository.findByUserAccountId(21L)).thenReturn(Optional.of(existing));

        AssignSchoolAdministratorRequest duplicate = new AssignSchoolAdministratorRequest();
        duplicate.setUserAccountId(21L);
        assertThrows(IllegalStateException.class, () -> service.assignAdministrator(10L, duplicate));

        when(schoolMembershipRepository.findByUserAccountId(21L)).thenReturn(Optional.empty());
        when(schoolMembershipRepository.existsBySchoolIdAndUserAccountRole(10L, UserRole.SCHOOL_ADMIN)).thenReturn(true);
        assertThrows(IllegalStateException.class, () -> service.assignAdministrator(10L, duplicate));
    }

    @Test
    void unassignsAdministratorWithoutDeletingAccountAndAllowsReassignment() {
        School firstSchool = school(10L, "Atatürk High School", SchoolLevel.HIGH_SCHOOL);
        School secondSchool = school(11L, "Cumhuriyet High School", SchoolLevel.HIGH_SCHOOL);
        UserAccount admin = account(25L, "ayse.admin", UserRole.SCHOOL_VICE_ADMIN, true);
        StaffProfile profile = profile(admin, "Ayşe", "Yılmaz");
        SchoolMembership membership = new SchoolMembership();
        membership.setSchool(firstSchool);
        membership.setUserAccount(admin);

        when(schoolRepository.existsById(10L)).thenReturn(true);
        when(schoolMembershipRepository.findBySchoolIdAndUserAccountId(10L, 25L)).thenReturn(Optional.of(membership));

        service.unassignAdministrator(10L, 25L);
        verify(schoolMembershipRepository).delete(membership);
        verify(userAccountRepository, never()).delete(any(UserAccount.class));

        when(schoolRepository.findById(11L)).thenReturn(Optional.of(secondSchool));
        when(userAccountRepository.findByIdForUpdate(25L)).thenReturn(Optional.of(admin));
        when(staffProfileRepository.findByUserAccountId(25L)).thenReturn(Optional.of(profile));
        when(schoolMembershipRepository.findByUserAccountId(25L)).thenReturn(Optional.empty());

        AssignSchoolAdministratorRequest reassign = new AssignSchoolAdministratorRequest();
        reassign.setUserAccountId(25L);
        reassign.setSchoolId(11L);

        SchoolAdministratorSummaryResponse result = service.assignAdministrator(11L, reassign);
        assertEquals(11L, result.getSchoolId());
        assertEquals("Cumhuriyet High School", result.getSchoolName());
    }

    @Test
    void archivesAndRestoresSchoolNonDestructively() {
        School school = school(10L, "Atatürk High School", SchoolLevel.HIGH_SCHOOL);
        SchoolService schoolService = new SchoolService(schoolRepository, new com.classbridge.mapper.SchoolMapper());
        when(schoolRepository.findById(10L)).thenReturn(Optional.of(school));
        when(schoolRepository.save(any(School.class))).thenAnswer(invocation -> invocation.getArgument(0));

        assertEquals(false, schoolService.archiveSchool(10L).orElseThrow().isActive());
        assertThrows(IllegalStateException.class, () -> schoolService.updateSchool(10L, new com.classbridge.dto.SchoolRequest()));

        AssignSchoolAdministratorRequest assignWhileArchived = new AssignSchoolAdministratorRequest();
        assignWhileArchived.setUserAccountId(25L);
        assertThrows(IllegalStateException.class, () -> service.assignAdministrator(10L, assignWhileArchived));

        assertEquals(true, schoolService.restoreSchool(10L).orElseThrow().isActive());
    }

    @Test
    void updatesAdministratorNameAndGuardsSoleAdministratorOnArchive() {
        School school = school(10L, "Atatürk High School", SchoolLevel.HIGH_SCHOOL);
        UserAccount admin = account(25L, "ayse.admin", UserRole.SCHOOL_ADMIN, true);
        StaffProfile profile = profile(admin, "Ayşe", "Yılmaz");
        SchoolMembership membership = new SchoolMembership();
        membership.setSchool(school);
        membership.setUserAccount(admin);

        when(staffProfileRepository.findByUserAccountId(25L)).thenReturn(Optional.of(profile));
        when(staffProfileRepository.saveAndFlush(any(StaffProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(schoolMembershipRepository.findByUserAccountId(25L)).thenReturn(Optional.of(membership));
        when(schoolMembershipRepository.countOtherActiveAdministratorsInSchool(any(), any(), any())).thenReturn(0L);

        com.classbridge.dto.UpdateSchoolAdministratorRequest update = new com.classbridge.dto.UpdateSchoolAdministratorRequest();
        update.setFirstName("Ayşegül");
        update.setLastName("Kaya");

        var updated = service.updateAdministrator(25L, update);
        assertEquals("Ayşegül", updated.getFirstName());
        assertEquals("Kaya", updated.getLastName());

        assertThrows(IllegalStateException.class, () -> service.archiveAdministrator(25L));

        when(schoolMembershipRepository.countOtherActiveAdministratorsInSchool(any(), any(), any())).thenReturn(1L);
        var archived = service.archiveAdministrator(25L);
        assertEquals(false, archived.isActive());
        assertEquals(10L, archived.getSchoolId());
        assertThrows(IllegalStateException.class, () -> service.updateAdministrator(25L, update));

        var restored = service.restoreAdministrator(25L);
        assertEquals(true, restored.isActive());
        assertEquals(10L, restored.getSchoolId());
    }

    @Test
    void validatesAdministratorRoleUpdatesAndSchoolLeadershipRules() {
        School school = school(10L, "Atatürk High School", SchoolLevel.HIGH_SCHOOL);
        UserAccount admin = account(25L, "ayse.admin", UserRole.SCHOOL_ADMIN, true);
        StaffProfile profile = profile(admin, "Ayşe", "Yılmaz");
        SchoolMembership membership = new SchoolMembership();
        membership.setSchool(school);
        membership.setUserAccount(admin);

        when(staffProfileRepository.findByUserAccountId(25L)).thenReturn(Optional.of(profile));
        when(staffProfileRepository.saveAndFlush(any(StaffProfile.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userAccountRepository.saveAndFlush(any(UserAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(schoolMembershipRepository.findByUserAccountId(25L)).thenReturn(Optional.of(membership));

        com.classbridge.dto.UpdateSchoolAdministratorRequest superadminAttempt = new com.classbridge.dto.UpdateSchoolAdministratorRequest();
        superadminAttempt.setFirstName("Ayşe");
        superadminAttempt.setLastName("Yılmaz");
        superadminAttempt.setRole(UserRole.SUPERADMIN);
        assertThrows(InvalidRoleException.class, () -> service.updateAdministrator(25L, superadminAttempt));

        com.classbridge.dto.UpdateSchoolAdministratorRequest demoteSoleAdmin = new com.classbridge.dto.UpdateSchoolAdministratorRequest();
        demoteSoleAdmin.setFirstName("Ayşe");
        demoteSoleAdmin.setLastName("Yılmaz");
        demoteSoleAdmin.setRole(UserRole.SCHOOL_VICE_ADMIN);
        when(schoolMembershipRepository.countOtherActiveAdministratorsInSchool(any(), any(), any())).thenReturn(0L);
        assertThrows(IllegalStateException.class, () -> service.updateAdministrator(25L, demoteSoleAdmin));

        when(schoolMembershipRepository.countOtherActiveAdministratorsInSchool(any(), any(), any())).thenReturn(1L);
        var demoted = service.updateAdministrator(25L, demoteSoleAdmin);
        assertEquals(UserRole.SCHOOL_VICE_ADMIN, demoted.getRole());

        com.classbridge.dto.UpdateSchoolAdministratorRequest promoteConflict = new com.classbridge.dto.UpdateSchoolAdministratorRequest();
        promoteConflict.setFirstName("Ayşe");
        promoteConflict.setLastName("Yılmaz");
        promoteConflict.setRole(UserRole.SCHOOL_ADMIN);
        when(schoolMembershipRepository.existsBySchoolIdAndUserAccountRoleAndUserAccountIdNot(10L, UserRole.SCHOOL_ADMIN, 25L)).thenReturn(true);
        assertThrows(IllegalStateException.class, () -> service.updateAdministrator(25L, promoteConflict));

        when(schoolMembershipRepository.existsBySchoolIdAndUserAccountRoleAndUserAccountIdNot(10L, UserRole.SCHOOL_ADMIN, 25L)).thenReturn(false);
        var promoted = service.updateAdministrator(25L, promoteConflict);
        assertEquals(UserRole.SCHOOL_ADMIN, promoted.getRole());
    }

    private static School school(Long id, String name, SchoolLevel level) {
        School school = new School();
        school.setId(id);
        school.setName(name);
        school.setEducationLevel(level);
        return school;
    }

    private static UserAccount account(Long id, String username, UserRole role, boolean active) {
        UserAccount account = new UserAccount();
        account.setId(id);
        account.setUsername(username);
        account.setRole(role);
        account.setActive(active);
        return account;
    }

    private static StaffProfile profile(UserAccount account, String firstName, String lastName) {
        StaffProfile profile = new StaffProfile();
        profile.setUserAccount(account);
        profile.setFirstName(firstName);
        profile.setLastName(lastName);
        return profile;
    }
}
