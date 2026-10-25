package com.classbridge.service;

import com.classbridge.domain.Announcement;
import com.classbridge.domain.Classroom;
import com.classbridge.domain.ParentProfile;
import com.classbridge.domain.School;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.StudentProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.AnnouncementResponse;
import com.classbridge.dto.CreateAnnouncementRequest;
import com.classbridge.dto.TargetClassroomResponse;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.mapper.AnnouncementMapper;
import com.classbridge.repository.AnnouncementAttachmentRepository;
import com.classbridge.repository.AnnouncementRepository;
import com.classbridge.repository.ClassroomRepository;
import com.classbridge.repository.ParentProfileRepository;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.StaffProfileRepository;
import com.classbridge.repository.StudentProfileRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AnnouncementServiceAuthorizationTests {

    private final AnnouncementRepository announcementRepository = mock(AnnouncementRepository.class);
    private final AnnouncementAttachmentRepository attachmentRepository = mock(AnnouncementAttachmentRepository.class);
    private final ClassroomRepository classroomRepository = mock(ClassroomRepository.class);
    private final SchoolMembershipRepository schoolMembershipRepository = mock(SchoolMembershipRepository.class);
    private final StaffProfileRepository staffProfileRepository = mock(StaffProfileRepository.class);
    private final StudentProfileRepository studentProfileRepository = mock(StudentProfileRepository.class);
    private final ParentProfileRepository parentProfileRepository = mock(ParentProfileRepository.class);
    private final AnnouncementMapper announcementMapper = mock(AnnouncementMapper.class);
    private final AttachmentStorageService attachmentStorageService = mock(AttachmentStorageService.class);
    private final AttachmentValidator attachmentValidator = mock(AttachmentValidator.class);

    private final AnnouncementService service = new AnnouncementService(
            announcementRepository,
            attachmentRepository,
            classroomRepository,
            schoolMembershipRepository,
            staffProfileRepository,
            studentProfileRepository,
            parentProfileRepository,
            announcementMapper,
            attachmentStorageService,
            attachmentValidator
    );

    @Test
    void teacherCannotPublishToClassroomOutsideTheirSchool() {
        UserAccount teacher = account(5L, UserRole.TEACHER);
        School teacherSchool = school(1L);
        SchoolMembership membership = membership(teacherSchool, teacher);
        CreateAnnouncementRequest request = new CreateAnnouncementRequest();
        request.setTitle("Test");
        request.setBody("Test body");
        request.setTargetClassroomIds(List.of(200L));

        when(schoolMembershipRepository.findByUserAccountId(5L)).thenReturn(Optional.of(membership));
        when(classroomRepository.findByIdAndSchoolId(200L, 1L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> service.createAnnouncement(5L, request));

        verify(announcementRepository, never()).save(any(Announcement.class));
    }

    @Test
    void teacherHistoryQueryIsScopedToThatTeacherAndSchool() {
        UserAccount teacher = account(5L, UserRole.TEACHER);
        School teacherSchool = school(1L);
        when(schoolMembershipRepository.findByUserAccountId(5L)).thenReturn(Optional.of(membership(teacherSchool, teacher)));
        when(announcementRepository.findBySchoolIdAndAuthorAccountIdOrderByCreatedAtDesc(1L, 5L)).thenReturn(List.of());

        assertEquals(List.of(), service.getTeacherAnnouncementHistory(5L));

        verify(announcementRepository).findBySchoolIdAndAuthorAccountIdOrderByCreatedAtDesc(1L, 5L);
    }

    @Test
    void studentAnnouncementResponsesDoNotExposeOtherTargetClassrooms() {
        UserAccount studentAccount = account(9L, UserRole.STUDENT);
        UserAccount teacherAccount = account(5L, UserRole.TEACHER);
        School school = school(1L);
        Classroom classroom = new Classroom();
        classroom.setId(11L);
        StudentProfile student = new StudentProfile();
        student.setId(20L);
        student.setSchool(school);
        student.setClassroom(classroom);
        student.setUserAccount(studentAccount);

        Announcement announcement = new Announcement();
        announcement.setId(30L);
        announcement.setSchool(school);
        announcement.setAuthorAccount(teacherAccount);

        AnnouncementResponse mappedResponse = new AnnouncementResponse();
        mappedResponse.setTargetClassrooms(List.of(new TargetClassroomResponse(99L, 9, "A")));

        when(studentProfileRepository.findByUserAccountId(9L)).thenReturn(Optional.of(student));
        when(announcementRepository.findBySchoolIdAndClassroomIdOrderByCreatedAtDesc(1L, 11L))
                .thenReturn(List.of(announcement));
        when(staffProfileRepository.findByUserAccountIdIn(anySet())).thenReturn(List.of());
        when(attachmentRepository.findByAnnouncementIdInOrderByCreatedAtAscIdAsc(anyList())).thenReturn(List.of());
        when(announcementMapper.toResponse(announcement, "user-5", List.of())).thenReturn(mappedResponse);

        List<AnnouncementResponse> responses = service.getStudentAnnouncements(9L);

        assertEquals(1, responses.size());
        assertEquals(List.of(), responses.get(0).getTargetClassrooms());
        verify(announcementRepository).findBySchoolIdAndClassroomIdOrderByCreatedAtDesc(1L, 11L);
    }

    @Test
    void parentCannotRequestAnnouncementForUnlinkedChild() {
        ParentProfile parent = new ParentProfile();
        parent.setId(50L);
        when(parentProfileRepository.findByUserAccountId(10L)).thenReturn(Optional.of(parent));
        when(studentProfileRepository.findActiveByIdAndParentProfileId(999L, 50L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.getParentAnnouncements(10L, 999L));

        verify(announcementRepository, never()).findBySchoolIdAndClassroomIdOrderByCreatedAtDesc(any(), any());
    }

    private static UserAccount account(Long id, UserRole role) {
        UserAccount account = new UserAccount();
        account.setId(id);
        account.setRole(role);
        account.setActive(true);
        account.setUsername("user-" + id);
        return account;
    }

    private static School school(Long id) {
        School school = new School();
        school.setId(id);
        return school;
    }

    private static SchoolMembership membership(School school, UserAccount account) {
        SchoolMembership membership = new SchoolMembership();
        membership.setSchool(school);
        membership.setUserAccount(account);
        return membership;
    }
}
