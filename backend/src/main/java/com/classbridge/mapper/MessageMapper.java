package com.classbridge.mapper;

import com.classbridge.domain.DirectMessage;
import com.classbridge.domain.MessageConversation;
import com.classbridge.domain.StudentProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.dto.ConversationResponse;
import com.classbridge.dto.AccountAppearanceResponse;
import com.classbridge.dto.DirectMessageResponse;
import com.classbridge.dto.MessageAttachmentResponse;
import com.classbridge.dto.MessageRecipientResponse;
import org.springframework.stereotype.Component;

@Component
public class MessageMapper {

    public MessageRecipientResponse toStudentRecipient(StudentProfile student, UserAccount recipient, String displayName) {
        return new MessageRecipientResponse(recipient.getId(), recipient.getRole(), displayName,
                student.getId(), student.getSchoolNumber(), student.getSchool().getId());
    }

    public MessageRecipientResponse toAccountRecipient(UserAccount account, String displayName, Long schoolId) {
        return new MessageRecipientResponse(account.getId(), account.getRole(), displayName, null, null, schoolId);
    }

    public ConversationResponse toConversationResponse(MessageConversation conversation, UserAccount otherParticipant,
                                                       String otherDisplayName, AccountAppearanceResponse otherAppearance, String studentDisplayName,
                                                       boolean readOnly, long unreadCount, String latestMessage) {
        StudentProfile student = conversation.getStudentProfile();
        return new ConversationResponse(conversation.getId(), conversation.getSchool().getId(),
                student == null ? null : student.getId(), studentDisplayName,
                otherParticipant.getId(), otherDisplayName, otherParticipant.getRole(), otherAppearance, readOnly,
                unreadCount, latestMessage, conversation.getCreatedAt(), conversation.getLastMessageAt());
    }

    public DirectMessageResponse toMessageResponse(DirectMessage message, String senderDisplayName) {
        UserAccount sender = message.getSender();
        return new DirectMessageResponse(message.getId(), sender.getId(), senderDisplayName, sender.getRole(),
                sender.getRole() == com.classbridge.domain.UserRole.PARENT, message.getBody(), message.getCreatedAt(), message.getReadAt(),
                message.getAttachments().stream().map(attachment -> new MessageAttachmentResponse(attachment.getId(), attachment.getDisplayFilename(),
                        attachment.getContentType(), attachment.getFileSize(), attachment.getCreatedAt())).toList());
    }
}
