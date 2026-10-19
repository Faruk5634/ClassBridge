package com.classbridge.service;

import com.classbridge.domain.DirectMessage;
import com.classbridge.domain.DirectMessageAttachment;
import com.classbridge.domain.MessageConversation;
import com.classbridge.domain.ParentProfile;
import com.classbridge.domain.School;
import com.classbridge.domain.SchoolLevel;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.StaffProfile;
import com.classbridge.domain.StudentProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.ConversationDetailResponse;
import com.classbridge.dto.ConversationResponse;
import com.classbridge.dto.CreateConversationRequest;
import com.classbridge.dto.DirectMessageResponse;
import com.classbridge.dto.AttachmentDownload;
import com.classbridge.dto.MessageAttachmentResponse;
import com.classbridge.dto.MessageRecipientResponse;
import com.classbridge.dto.StartStudentConversationsRequest;
import com.classbridge.dto.SendMessageRequest;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.InvalidAttachmentException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.mapper.MessageMapper;
import com.classbridge.repository.DirectMessageRepository;
import com.classbridge.repository.DirectMessageAttachmentRepository;
import com.classbridge.repository.MessageConversationRepository;
import com.classbridge.repository.ParentProfileRepository;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.SchoolRepository;
import com.classbridge.repository.StaffProfileRepository;
import com.classbridge.repository.StudentProfileRepository;
import com.classbridge.repository.UserAccountRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.io.InputStream;
import java.util.Objects;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class MessageService {
    private static final int RECIPIENT_LIMIT = 20;
    private static final int MIN_QUERY_LENGTH = 2;
    private static final Set<UserRole> STAFF_ROLES = Set.of(UserRole.SCHOOL_ADMIN, UserRole.SCHOOL_VICE_ADMIN, UserRole.TEACHER);

    private final UserAccountRepository userAccountRepository;
    private final SchoolMembershipRepository schoolMembershipRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final StaffProfileRepository staffProfileRepository;
    private final ParentProfileRepository parentProfileRepository;
    private final SchoolRepository schoolRepository;
    private final MessageConversationRepository conversationRepository;
    private final DirectMessageRepository messageRepository;
    private final DirectMessageAttachmentRepository attachmentRepository;
    private final MessageMapper messageMapper;
    private final AttachmentStorageService attachmentStorageService;
    private final AttachmentValidator attachmentValidator;

    public MessageService(UserAccountRepository userAccountRepository,
                          SchoolMembershipRepository schoolMembershipRepository,
                          StudentProfileRepository studentProfileRepository,
                          StaffProfileRepository staffProfileRepository,
                          ParentProfileRepository parentProfileRepository,
                          SchoolRepository schoolRepository,
                          MessageConversationRepository conversationRepository,
                          DirectMessageRepository messageRepository,
                          DirectMessageAttachmentRepository attachmentRepository,
                          MessageMapper messageMapper,
                          AttachmentStorageService attachmentStorageService,
                          AttachmentValidator attachmentValidator) {
        this.userAccountRepository = userAccountRepository;
        this.schoolMembershipRepository = schoolMembershipRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.staffProfileRepository = staffProfileRepository;
        this.parentProfileRepository = parentProfileRepository;
        this.schoolRepository = schoolRepository;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.attachmentRepository = attachmentRepository;
        this.messageMapper = messageMapper;
        this.attachmentStorageService = attachmentStorageService;
        this.attachmentValidator = attachmentValidator;
    }

    @Transactional(readOnly = true)
    public List<MessageRecipientResponse> searchRecipients(Long actorId, String rawQuery, Long studentProfileId, Long schoolId) {
        String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.length() < MIN_QUERY_LENGTH) {
            throw new IllegalArgumentException("Search query must contain at least 2 characters.");
        }
        UserAccount actor = requireActiveAccount(actorId);
        List<MessageRecipientResponse> results = new ArrayList<>();
        PageRequest limit = PageRequest.of(0, RECIPIENT_LIMIT);

        if (actor.getRole() == UserRole.SUPERADMIN) {
            if (schoolId == null) throw new IllegalArgumentException("schoolId is required for Superadmin recipient search.");
            School school = schoolRepository.findById(schoolId)
                    .orElseThrow(() -> new ResourceNotFoundException("School not found with id: " + schoolId));
            staffProfileRepository.searchBySchoolAndRoles(schoolId, actorId,
                    List.of(UserRole.SCHOOL_ADMIN, UserRole.SCHOOL_VICE_ADMIN), query, limit)
                    .forEach(profile -> results.add(accountRecipient(profile.getUserAccount(), staffName(profile), school.getId())));
            return results;
        }

        School school;
        if (actor.getRole() == UserRole.PARENT) {
            if (studentProfileId == null) throw new IllegalArgumentException("studentProfileId is required for parent recipient search.");
            StudentProfile child = requireLinkedActiveChild(actorId, studentProfileId);
            school = child.getSchool();
        } else if (actor.getRole() == UserRole.STUDENT) {
            StudentProfile profile = studentProfileRepository.findByUserAccountId(actorId)
                    .filter(StudentProfile::isActive)
                    .orElseThrow(() -> new ForbiddenOperationException("Student account has no active student profile."));
            school = profile.getSchool();
        } else if (STAFF_ROLES.contains(actor.getRole())) {
            school = requireSchoolMembership(actorId).getSchool();
        } else {
            throw new ForbiddenOperationException("This account role cannot use direct messaging.");
        }

        if (STAFF_ROLES.contains(actor.getRole())) {
            List<StudentProfile> students = studentProfileRepository.searchActiveBySchoolId(school.getId(), query, limit);
            for (StudentProfile student : students) {
                UserAccount recipient = effectiveStudentRecipient(student);
                if (recipient != null) results.add(messageMapper.toStudentRecipient(student));
            }
        }

        List<UserRole> staffRecipientRoles = actor.getRole() == UserRole.TEACHER
                ? List.of(UserRole.SCHOOL_ADMIN, UserRole.SCHOOL_VICE_ADMIN)
                : (actor.getRole() == UserRole.SCHOOL_ADMIN || actor.getRole() == UserRole.SCHOOL_VICE_ADMIN)
                    ? List.of(UserRole.TEACHER) : List.of(UserRole.TEACHER, UserRole.SCHOOL_ADMIN, UserRole.SCHOOL_VICE_ADMIN);
        staffProfileRepository.searchBySchoolAndRoles(school.getId(), actorId, staffRecipientRoles, query, limit)
                .forEach(profile -> results.add(accountRecipient(profile.getUserAccount(), staffName(profile), school.getId())));

        if (actor.getRole() == UserRole.SCHOOL_ADMIN || actor.getRole() == UserRole.SCHOOL_VICE_ADMIN) {
            userAccountRepository.searchActiveByRole(UserRole.SUPERADMIN, query, limit)
                    .forEach(account -> results.add(accountRecipient(account, account.getUsername(), school.getId())));
        }
        return results;
    }

    @Transactional
    public ConversationResponse startConversation(Long actorId, CreateConversationRequest request) {
        UserAccount actor = requireActiveAccount(actorId);
        UserAccount recipient;
        StudentProfile context = null;
        School school;

        if (STAFF_ROLES.contains(actor.getRole()) && request.getStudentProfileId() != null) {
            if (request.getRecipientAccountId() != null) throw new IllegalArgumentException("Do not send recipientAccountId when starting a student-context conversation.");
            SchoolMembership membership = requireSchoolMembership(actorId);
            context = studentProfileRepository.findByIdAndSchoolId(request.getStudentProfileId(), membership.getSchool().getId())
                    .filter(StudentProfile::isActive)
                    .orElseThrow(() -> new ResourceNotFoundException("Active student profile not found with id: " + request.getStudentProfileId()));
            recipient = effectiveStudentRecipient(context);
            if (recipient == null) throw new IllegalArgumentException("Student profile has no eligible account recipient.");
            school = membership.getSchool();
        } else if (actor.getRole() == UserRole.PARENT) {
            context = requireLinkedActiveChild(actorId, request.getStudentProfileId());
            recipient = requireAccount(request.getRecipientAccountId());
            requireStaffInSchool(recipient, context.getSchool().getId());
            school = context.getSchool();
        } else if (actor.getRole() == UserRole.STUDENT) {
            context = studentProfileRepository.findByUserAccountId(actorId)
                    .filter(StudentProfile::isActive)
                    .orElseThrow(() -> new ForbiddenOperationException("Student account has no active student profile."));
            if (request.getStudentProfileId() != null && !request.getStudentProfileId().equals(context.getId())) {
                throw new ResourceNotFoundException("Student profile not found with id: " + request.getStudentProfileId());
            }
            recipient = requireAccount(request.getRecipientAccountId());
            requireStaffInSchool(recipient, context.getSchool().getId());
            school = context.getSchool();
        } else if (actor.getRole() == UserRole.SUPERADMIN) {
            recipient = requireAccount(request.getRecipientAccountId());
            if (recipient.getRole() != UserRole.SCHOOL_ADMIN && recipient.getRole() != UserRole.SCHOOL_VICE_ADMIN) {
                throw new IllegalArgumentException("Superadmin support conversations must target a school administrator or vice-administrator.");
            }
            school = requireSchoolMembership(recipient.getId()).getSchool();
        } else if (STAFF_ROLES.contains(actor.getRole())) {
            SchoolMembership membership = requireSchoolMembership(actorId);
            recipient = requireAccount(request.getRecipientAccountId());
            school = membership.getSchool();
            validateStaffRecipient(actor, recipient, school.getId());
        } else {
            throw new ForbiddenOperationException("This account role cannot start conversations.");
        }

        if (actor.getId().equals(recipient.getId())) throw new IllegalArgumentException("A user cannot start a conversation with their own account.");
        String body = normalizedMessage(request.getMessage());
        Instant now = Instant.now();
        MessageConversation conversation = new MessageConversation();
        conversation.setSchool(school);
        conversation.setParticipantOne(actor);
        conversation.setParticipantTwo(recipient);
        conversation.setStudentProfile(context);
        conversation.setLastMessageAt(now);
        MessageConversation savedConversation = conversationRepository.save(conversation);
        DirectMessage firstMessage = new DirectMessage();
        firstMessage.setConversation(savedConversation);
        firstMessage.setSender(actor);
        firstMessage.setBody(body);
        DirectMessage savedFirstMessage = messageRepository.saveAndFlush(firstMessage);
        savedConversation.setLastMessageAt(savedFirstMessage.getCreatedAt());
        conversationRepository.saveAndFlush(savedConversation);
        return toConversationResponse(savedConversation, actorId, false);
    }

    @Transactional
    public List<ConversationResponse> startStudentConversations(Long actorId, StartStudentConversationsRequest request) {
        UserAccount actor = requireActiveAccount(actorId);
        if (actor.getRole() != UserRole.TEACHER) {
            throw new ForbiddenOperationException("Only teachers may start a school-wide student message.");
        }
        SchoolMembership membership = requireSchoolMembership(actorId);
        List<Long> requestedIds = request.getStudentProfileIds();
        if (requestedIds == null || requestedIds.isEmpty()) {
            throw new IllegalArgumentException("Select at least one student to message.");
        }
        List<Long> studentIds = requestedIds.stream().distinct().toList();
        if (studentIds.size() > 2000) {
            throw new IllegalArgumentException("A message may be sent to at most 2,000 students at a time.");
        }
        String body = normalizedMessage(request.getMessage());
        Long schoolId = membership.getSchool().getId();
        List<ConversationResponse> results = new ArrayList<>();

        for (Long studentId : studentIds) {
            StudentProfile student = studentProfileRepository.findByIdAndSchoolId(studentId, schoolId)
                    .filter(StudentProfile::isActive)
                    .orElseThrow(() -> new ResourceNotFoundException("Active student not found in your school with id: " + studentId));
            UserAccount recipient = effectiveStudentRecipient(student);
            if (recipient == null) {
                throw new IllegalArgumentException("Student " + student.getFirstName() + " " + student.getLastName() + " has no active message recipient.");
            }
            if (actorId.equals(recipient.getId())) {
                throw new IllegalArgumentException("A teacher cannot start a conversation with their own account.");
            }

            MessageConversation conversation = conversationRepository
                    .findStudentContextConversation(schoolId, studentId, actorId, recipient.getId())
                    .orElseGet(() -> {
                        MessageConversation created = new MessageConversation();
                        created.setSchool(membership.getSchool());
                        created.setParticipantOne(actor);
                        created.setParticipantTwo(recipient);
                        created.setStudentProfile(student);
                        created.setLastMessageAt(Instant.now());
                        return conversationRepository.save(created);
                    });

            DirectMessage firstMessage = new DirectMessage();
            firstMessage.setConversation(conversation);
            firstMessage.setSender(actor);
            firstMessage.setBody(body);
            DirectMessage savedMessage = messageRepository.saveAndFlush(firstMessage);
            conversation.setLastMessageAt(savedMessage.getCreatedAt());
            MessageConversation savedConversation = conversationRepository.saveAndFlush(conversation);
            results.add(toConversationResponse(savedConversation, actorId, false));
        }
        return results;
    }

    @Transactional(readOnly = true)
    public List<ConversationResponse> getConversations(Long actorId, Long studentProfileId) {
        UserAccount actor = requireActiveAccount(actorId);
        List<ConversationResponse> results = new ArrayList<>();
        if (actor.getRole() == UserRole.PARENT) {
            StudentProfile child = requireLinkedActiveChild(actorId, studentProfileId);
            for (MessageConversation conversation : conversationRepository.findForParticipant(actorId)) {
                if (conversation.getStudentProfile() != null && conversation.getStudentProfile().getId().equals(child.getId())) {
                    results.add(toConversationResponse(conversation, actorId, false));
                }
            }
            if (child.getSchool().getEducationLevel() == SchoolLevel.HIGH_SCHOOL && child.getUserAccount() != null) {
                for (MessageConversation conversation : conversationRepository.findHighSchoolConversationsForLinkedParent(child.getId(), child.getUserAccount().getId())) {
                    results.add(toConversationResponse(conversation, child.getUserAccount().getId(), true));
                }
            }
        } else {
            for (MessageConversation conversation : conversationRepository.findForParticipant(actorId)) {
                results.add(toConversationResponse(conversation, actorId, false));
            }
        }
        results.sort(Comparator.comparing(ConversationResponse::getLastMessageAt).reversed()
                .thenComparing(ConversationResponse::getId, Comparator.reverseOrder()));
        return results;
    }

    @Transactional
    public ConversationDetailResponse getConversation(Long actorId, Long conversationId, Long studentProfileId) {
        UserAccount actor = requireActiveAccount(actorId);
        Access access = findConversationAccess(actor, conversationId, studentProfileId);
        List<DirectMessage> messages = messageRepository.findByConversationId(conversationId);
        if (!access.readOnly()) {
            Instant now = Instant.now();
            for (DirectMessage message : messages) {
                if (!message.getSender().getId().equals(actorId) && message.getReadAt() == null) message.setReadAt(now);
            }
            messageRepository.saveAll(messages);
        }
        List<DirectMessageResponse> responses = messages.stream()
                .map(message -> messageMapper.toMessageResponse(message, displayName(message.getSender())))
                .toList();
        return new ConversationDetailResponse(toConversationResponse(access.conversation(), access.viewingAccountId(), access.readOnly()), responses);
    }

    @Transactional
    public DirectMessageResponse sendMessage(Long actorId, Long conversationId, Long studentProfileId, SendMessageRequest request) {
        UserAccount actor = requireActiveAccount(actorId);
        Access access = findConversationAccess(actor, conversationId, studentProfileId);
        if (access.readOnly()) throw new ForbiddenOperationException("This conversation is read-only for the authenticated account.");
        MessageConversation conversation = access.conversation();
        validateReplySchoolContext(actor, conversation);
        DirectMessage message = new DirectMessage();
        message.setConversation(conversation);
        message.setSender(actor);
        message.setBody(normalizedMessage(request.getMessage()));
        DirectMessage savedMessage = messageRepository.saveAndFlush(message);
        conversation.setLastMessageAt(savedMessage.getCreatedAt());
        conversationRepository.saveAndFlush(conversation);
        return messageMapper.toMessageResponse(savedMessage, displayName(actor));
    }

    @Transactional
    public MessageAttachmentResponse addAttachment(Long actorId, Long conversationId, Long messageId, Long studentProfileId, MultipartFile file) {
        UserAccount actor = requireActiveAccount(actorId);
        Access access = findConversationAccess(actor, conversationId, studentProfileId);
        if (access.readOnly()) throw new ForbiddenOperationException("This conversation is read-only for the authenticated account.");
        validateReplySchoolContext(actor, access.conversation());
        DirectMessage message = messageRepository.findByIdAndConversationId(messageId, conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found with id: " + messageId));
        if (!Objects.equals(message.getSender().getId(), actorId)) {
            throw new ForbiddenOperationException("You may only attach files to your own messages.");
        }
        AttachmentValidator.ValidatedAttachment validated = attachmentValidator.validate(file);
        String storageKey;
        try (InputStream input = file.getInputStream()) {
            storageKey = attachmentStorageService.store(input);
        } catch (IOException e) {
            throw new InvalidAttachmentException("Failed to read attachment file content.");
        }
        try {
            DirectMessageAttachment attachment = new DirectMessageAttachment(message, storageKey,
                    validated.getDisplayFilename(), validated.getCanonicalContentType(), validated.getFileSize());
            DirectMessageAttachment saved = attachmentRepository.saveAndFlush(attachment);
            return new MessageAttachmentResponse(saved.getId(), saved.getDisplayFilename(), saved.getContentType(), saved.getFileSize(), saved.getCreatedAt());
        } catch (RuntimeException exception) {
            attachmentStorageService.deleteFile(storageKey);
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public AttachmentDownload downloadAttachment(Long actorId, Long conversationId, Long messageId, Long attachmentId, Long studentProfileId) {
        UserAccount actor = requireActiveAccount(actorId);
        Access access = findConversationAccess(actor, conversationId, studentProfileId);
        DirectMessage message = messageRepository.findByIdAndConversationId(messageId, conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Message not found with id: " + messageId));
        DirectMessageAttachment attachment = attachmentRepository.findByIdAndMessageId(attachmentId, messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message attachment not found with id: " + attachmentId));
        return new AttachmentDownload(attachmentStorageService.loadAsResource(attachment.getStorageKey()),
                attachment.getDisplayFilename(), attachment.getContentType(), attachment.getFileSize());
    }

    private Access findConversationAccess(UserAccount actor, Long conversationId, Long studentProfileId) {
        if (actor.getRole() == UserRole.PARENT) {
            if (studentProfileId == null) throw new IllegalArgumentException("studentProfileId is required when a parent opens a conversation.");
            StudentProfile child = requireLinkedActiveChild(actor.getId(), studentProfileId);
            Optional<MessageConversation> own = conversationRepository.findForParticipantById(conversationId, actor.getId())
                    .filter(c -> c.getStudentProfile() != null && c.getStudentProfile().getId().equals(child.getId()));
            if (own.isPresent()) return new Access(own.get(), actor.getId(), false);
            if (child.getSchool().getEducationLevel() == SchoolLevel.HIGH_SCHOOL && child.getUserAccount() != null) {
                MessageConversation readOnly = conversationRepository.findHighSchoolConversationForLinkedParent(conversationId, child.getId(), child.getUserAccount().getId())
                        .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));
                return new Access(readOnly, child.getUserAccount().getId(), true);
            }
            throw new ResourceNotFoundException("Conversation not found with id: " + conversationId);
        }
        MessageConversation conversation = conversationRepository.findForParticipantById(conversationId, actor.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found with id: " + conversationId));
        return new Access(conversation, actor.getId(), false);
    }

    private void validateReplySchoolContext(UserAccount actor, MessageConversation conversation) {
        UserAccount other = conversation.otherParticipant(actor.getId());
        if (!other.isActive()) throw new ResourceNotFoundException("Conversation not found with id: " + conversation.getId());
        if (actor.getRole() == UserRole.SUPERADMIN) {
            if (other.getRole() != UserRole.SCHOOL_ADMIN && other.getRole() != UserRole.SCHOOL_VICE_ADMIN) throw new ForbiddenOperationException("Superadmin support conversation is not permitted.");
            if (!conversation.getSchool().getId().equals(requireSchoolMembership(other.getId()).getSchool().getId())) throw new ForbiddenOperationException("Conversation school context is invalid.");
            return;
        }
        if (actor.getRole() == UserRole.PARENT || actor.getRole() == UserRole.STUDENT) {
            StudentProfile profile = conversation.getStudentProfile();
            if (profile == null || !profile.getSchool().getId().equals(conversation.getSchool().getId())) throw new ForbiddenOperationException("Conversation student context is invalid.");
            if (actor.getRole() == UserRole.PARENT && (profile.getParentProfile() == null || !profile.getParentProfile().getUserAccount().getId().equals(actor.getId()))) throw new ForbiddenOperationException("The selected child is not linked to this parent account.");
            if (actor.getRole() == UserRole.STUDENT && (profile.getUserAccount() == null || !profile.getUserAccount().getId().equals(actor.getId()))) throw new ForbiddenOperationException("Conversation does not belong to this student account.");
            return;
        }
        SchoolMembership membership = requireSchoolMembership(actor.getId());
        if (!membership.getSchool().getId().equals(conversation.getSchool().getId())) throw new ForbiddenOperationException("Conversation is outside the authenticated user's school.");
        if (conversation.getStudentProfile() != null) {
            if (!conversation.getStudentProfile().isActive()) throw new ResourceNotFoundException("Conversation not found with id: " + conversation.getId());
            UserAccount expectedRecipient = effectiveStudentRecipient(conversation.getStudentProfile());
            if (expectedRecipient == null || !expectedRecipient.getId().equals(other.getId())) throw new ForbiddenOperationException("Conversation student recipient is invalid.");
            return;
        }
        if (other.getRole() == UserRole.SUPERADMIN) {
            if (actor.getRole() != UserRole.SCHOOL_ADMIN && actor.getRole() != UserRole.SCHOOL_VICE_ADMIN) throw new ForbiddenOperationException("Only school administrators may use Superadmin support conversations.");
            if (!membership.getSchool().getId().equals(conversation.getSchool().getId())) throw new ForbiddenOperationException("Support conversation school context is invalid.");
            return;
        }
        if ((actor.getRole() == UserRole.TEACHER && other.getRole() != UserRole.SCHOOL_ADMIN && other.getRole() != UserRole.SCHOOL_VICE_ADMIN)
                || ((actor.getRole() == UserRole.SCHOOL_ADMIN || actor.getRole() == UserRole.SCHOOL_VICE_ADMIN)
                && other.getRole() != UserRole.TEACHER && other.getRole() != UserRole.STUDENT && other.getRole() != UserRole.PARENT)) {
            throw new ForbiddenOperationException("This account role cannot reply in this conversation.");
        }
    }

    private void validateStaffRecipient(UserAccount actor, UserAccount recipient, Long schoolId) {
        if (recipient.getRole() == UserRole.SUPERADMIN) {
            if (actor.getRole() != UserRole.SCHOOL_ADMIN && actor.getRole() != UserRole.SCHOOL_VICE_ADMIN) throw new IllegalArgumentException("Only school administrators may contact Superadmin for support.");
            return;
        }
        requireStaffInSchool(recipient, schoolId);
        boolean permitted = actor.getRole() == UserRole.TEACHER
                ? recipient.getRole() == UserRole.SCHOOL_ADMIN || recipient.getRole() == UserRole.SCHOOL_VICE_ADMIN
                : recipient.getRole() == UserRole.TEACHER;
        if (!permitted) throw new IllegalArgumentException("This recipient role is not permitted for the authenticated account.");
    }

    private void requireStaffInSchool(UserAccount account, Long schoolId) {
        if (!STAFF_ROLES.contains(account.getRole())) throw new IllegalArgumentException("Recipient must be school staff.");
        SchoolMembership membership = schoolMembershipRepository.findByUserAccountId(account.getId())
                .filter(sm -> sm.getSchool().getId().equals(schoolId))
                .orElseThrow(() -> new ResourceNotFoundException("Message recipient not found in the selected school."));
    }

    private StudentProfile requireLinkedActiveChild(Long parentAccountId, Long studentProfileId) {
        if (studentProfileId == null) throw new IllegalArgumentException("studentProfileId is required.");
        ParentProfile parent = parentProfileRepository.findByUserAccountId(parentAccountId)
                .orElseThrow(() -> new ForbiddenOperationException("Parent profile is missing."));
        return studentProfileRepository.findActiveByIdAndParentProfileId(studentProfileId, parent.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found with id: " + studentProfileId));
    }

    private UserAccount effectiveStudentRecipient(StudentProfile student) {
        UserAccount account = student.getSchool().getEducationLevel() == SchoolLevel.HIGH_SCHOOL
                ? student.getUserAccount()
                : student.getParentProfile() == null ? null : student.getParentProfile().getUserAccount();
        return account != null && account.isActive() ? account : null;
    }

    private SchoolMembership requireSchoolMembership(Long accountId) {
        return schoolMembershipRepository.findByUserAccountId(accountId)
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated staff account has no school membership."));
    }

    private UserAccount requireActiveAccount(Long accountId) {
        return userAccountRepository.findById(accountId)
                .filter(UserAccount::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("User account not found."));
    }

    private UserAccount requireAccount(Long accountId) {
        if (accountId == null) throw new IllegalArgumentException("recipientAccountId is required.");
        return requireActiveAccount(accountId);
    }

    private String normalizedMessage(String message) {
        if (message == null || message.trim().isEmpty()) throw new IllegalArgumentException("Message cannot be blank.");
        String normalized = message.trim();
        if (normalized.length() > 5000) throw new IllegalArgumentException("Message cannot exceed 5000 characters.");
        return normalized;
    }

    private MessageRecipientResponse accountRecipient(UserAccount account, String displayName, Long schoolId) {
        return messageMapper.toAccountRecipient(account, displayName, schoolId);
    }

    private String staffName(StaffProfile profile) { return profile.getFirstName() + " " + profile.getLastName(); }

    private String displayName(UserAccount account) {
        if (account.getRole() == UserRole.SCHOOL_ADMIN || account.getRole() == UserRole.SCHOOL_VICE_ADMIN || account.getRole() == UserRole.TEACHER) {
            return staffProfileRepository.findByUserAccountId(account.getId()).map(this::staffName).orElse(account.getUsername());
        }
        if (account.getRole() == UserRole.PARENT) {
            return parentProfileRepository.findByUserAccountId(account.getId()).map(p -> p.getFirstName() + " " + p.getLastName()).orElse(account.getUsername());
        }
        if (account.getRole() == UserRole.STUDENT) {
            return studentProfileRepository.findByUserAccountId(account.getId()).map(s -> s.getFirstName() + " " + s.getLastName()).orElse(account.getUsername());
        }
        return account.getUsername();
    }

    private ConversationResponse toConversationResponse(MessageConversation conversation, Long viewingParticipantId, boolean readOnly) {
        UserAccount other = conversation.otherParticipant(viewingParticipantId);
        StudentProfile student = conversation.getStudentProfile();
        String studentName = student == null ? null : student.getFirstName() + " " + student.getLastName();
        long unread = readOnly ? 0 : messageRepository.countUnreadForParticipant(conversation.getId(), viewingParticipantId);
        String latest = messageRepository.findFirstByConversationIdOrderByCreatedAtDescIdDesc(conversation.getId())
                .map(DirectMessage::getBody).orElse(null);
        return messageMapper.toConversationResponse(conversation, other, displayName(other), studentName, readOnly,
                unread, latest);
    }

    private record Access(MessageConversation conversation, Long viewingAccountId, boolean readOnly) { }
}
