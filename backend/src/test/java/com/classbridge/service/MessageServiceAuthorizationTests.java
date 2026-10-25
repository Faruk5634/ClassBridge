package com.classbridge.service;

import com.classbridge.domain.MessageConversation;
import com.classbridge.domain.ParentProfile;
import com.classbridge.domain.School;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.StudentProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.mapper.MessageMapper;
import com.classbridge.repository.AccountAppearanceRepository;
import com.classbridge.repository.DirectMessageAttachmentRepository;
import com.classbridge.repository.DirectMessageRepository;
import com.classbridge.repository.MessageConversationRepository;
import com.classbridge.repository.ParentProfileRepository;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.SchoolRepository;
import com.classbridge.repository.StaffProfileRepository;
import com.classbridge.repository.StudentProfileRepository;
import com.classbridge.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MessageServiceAuthorizationTests {

    private final UserAccountRepository userAccountRepository = mock(UserAccountRepository.class);
    private final SchoolMembershipRepository schoolMembershipRepository = mock(SchoolMembershipRepository.class);
    private final StudentProfileRepository studentProfileRepository = mock(StudentProfileRepository.class);
    private final StaffProfileRepository staffProfileRepository = mock(StaffProfileRepository.class);
    private final ParentProfileRepository parentProfileRepository = mock(ParentProfileRepository.class);
    private final SchoolRepository schoolRepository = mock(SchoolRepository.class);
    private final MessageConversationRepository conversationRepository = mock(MessageConversationRepository.class);
    private final DirectMessageRepository messageRepository = mock(DirectMessageRepository.class);
    private final DirectMessageAttachmentRepository attachmentRepository = mock(DirectMessageAttachmentRepository.class);
    private final MessageMapper messageMapper = mock(MessageMapper.class);
    private final AccountAppearanceRepository appearanceRepository = mock(AccountAppearanceRepository.class);
    private final AttachmentStorageService attachmentStorageService = mock(AttachmentStorageService.class);
    private final AttachmentValidator attachmentValidator = mock(AttachmentValidator.class);

    private final MessageService service = new MessageService(
            userAccountRepository,
            schoolMembershipRepository,
            studentProfileRepository,
            staffProfileRepository,
            parentProfileRepository,
            schoolRepository,
            conversationRepository,
            messageRepository,
            attachmentRepository,
            messageMapper,
            appearanceRepository,
            attachmentStorageService,
            attachmentValidator
    );

    @Test
    void parentCannotOpenConversationForAnUnlinkedChild() {
        UserAccount parentAccount = account(10L, UserRole.PARENT);
        ParentProfile parentProfile = new ParentProfile();
        parentProfile.setId(100L);

        when(userAccountRepository.findById(10L)).thenReturn(Optional.of(parentAccount));
        when(parentProfileRepository.findByUserAccountId(10L)).thenReturn(Optional.of(parentProfile));
        when(studentProfileRepository.findActiveByIdAndParentProfileId(999L, 100L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.getConversation(10L, 70L, 999L));

        verify(conversationRepository, never()).findForParticipantById(70L, 10L);
        verify(conversationRepository, never()).findHighSchoolConversationForLinkedParent(70L, 999L, null);
        verify(messageRepository, never()).findByConversationId(70L);
    }

    @Test
    void staffCannotReadConversationAfterCounterpartMovesToAnotherSchool() {
        UserAccount actor = account(5L, UserRole.TEACHER);
        UserAccount counterpart = account(8L, UserRole.TEACHER);
        School actorSchool = school(1L);
        School otherSchool = school(2L);
        MessageConversation conversation = conversation(70L, actorSchool, actor, counterpart, null);

        when(userAccountRepository.findById(5L)).thenReturn(Optional.of(actor));
        when(conversationRepository.findForParticipantById(70L, 5L)).thenReturn(Optional.of(conversation));
        when(schoolMembershipRepository.findByUserAccountId(5L)).thenReturn(Optional.of(membership(actorSchool, actor)));
        when(schoolMembershipRepository.findByUserAccountId(8L)).thenReturn(Optional.of(membership(otherSchool, counterpart)));

        assertThrows(ResourceNotFoundException.class, () -> service.getConversation(5L, 70L, null));

        verify(messageRepository, never()).findByConversationId(70L);
    }

    @Test
    void studentCannotReadConversationWithStaffOutsideTheirSchool() {
        UserAccount studentAccount = account(9L, UserRole.STUDENT);
        UserAccount teacherAccount = account(5L, UserRole.TEACHER);
        School studentSchool = school(1L);
        School teacherSchool = school(2L);
        StudentProfile student = new StudentProfile();
        student.setId(20L);
        student.setSchool(studentSchool);
        student.setUserAccount(studentAccount);
        MessageConversation conversation = conversation(71L, studentSchool, studentAccount, teacherAccount, student);

        when(userAccountRepository.findById(9L)).thenReturn(Optional.of(studentAccount));
        when(conversationRepository.findForParticipantById(71L, 9L)).thenReturn(Optional.of(conversation));
        when(studentProfileRepository.findByUserAccountId(9L)).thenReturn(Optional.of(student));
        when(schoolMembershipRepository.findByUserAccountId(5L)).thenReturn(Optional.of(membership(teacherSchool, teacherAccount)));

        assertThrows(ResourceNotFoundException.class, () -> service.getConversation(9L, 71L, null));

        verify(messageRepository, never()).findByConversationId(71L);
    }

    @Test
    void conversationListOmitsConversationsWithStaleCrossSchoolMembership() {
        UserAccount actor = account(5L, UserRole.TEACHER);
        UserAccount counterpart = account(8L, UserRole.TEACHER);
        School actorSchool = school(1L);
        School otherSchool = school(2L);
        MessageConversation staleConversation = conversation(72L, actorSchool, actor, counterpart, null);

        when(userAccountRepository.findById(5L)).thenReturn(Optional.of(actor));
        when(conversationRepository.findForParticipant(5L)).thenReturn(List.of(staleConversation));
        when(schoolMembershipRepository.findByUserAccountId(5L)).thenReturn(Optional.of(membership(actorSchool, actor)));
        when(schoolMembershipRepository.findByUserAccountId(8L)).thenReturn(Optional.of(membership(otherSchool, counterpart)));

        assertEquals(List.of(), service.getConversations(5L, null));

        verify(messageRepository, never()).countUnreadForParticipant(72L, 5L);
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

    private static MessageConversation conversation(Long id, School school, UserAccount first,
                                                    UserAccount second, StudentProfile student) {
        MessageConversation conversation = new MessageConversation();
        conversation.setId(id);
        conversation.setSchool(school);
        conversation.setParticipantOne(first);
        conversation.setParticipantTwo(second);
        conversation.setStudentProfile(student);
        return conversation;
    }
}
