package com.classbridge.mapper;

import com.classbridge.domain.Announcement;
import com.classbridge.domain.AnnouncementAttachment;
import com.classbridge.domain.Classroom;
import com.classbridge.domain.School;
import com.classbridge.domain.UserAccount;
import com.classbridge.dto.AnnouncementAttachmentResponse;
import com.classbridge.dto.AnnouncementResponse;
import com.classbridge.dto.CreateAnnouncementRequest;
import com.classbridge.dto.TargetClassroomResponse;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class AnnouncementMapper {

    public Announcement toEntity(CreateAnnouncementRequest request, School school, UserAccount authorAccount, List<Classroom> classrooms) {
        Announcement announcement = new Announcement();
        announcement.setSchool(school);
        announcement.setAuthorAccount(authorAccount);
        announcement.setTitle(request.getTitle().trim());
        announcement.setBody(request.getBody().trim());
        announcement.setType(request.getType());
        for (Classroom classroom : classrooms) {
            announcement.addTargetClassroom(classroom);
        }
        return announcement;
    }

    public AnnouncementAttachmentResponse toAttachmentResponse(AnnouncementAttachment attachment) {
        return new AnnouncementAttachmentResponse(
                attachment.getId(),
                attachment.getDisplayFilename(),
                attachment.getContentType(),
                attachment.getFileSize(),
                attachment.getCreatedAt()
        );
    }

    public AnnouncementResponse toResponse(Announcement announcement, String authorDisplayName) {
        return toResponse(announcement, authorDisplayName, announcement.getAttachments());
    }

    public AnnouncementResponse toResponse(Announcement announcement, String authorDisplayName, List<AnnouncementAttachment> attachments) {
        AnnouncementResponse response = new AnnouncementResponse();
        response.setId(announcement.getId());
        response.setSchoolId(announcement.getSchool().getId());
        response.setTitle(announcement.getTitle());
        response.setBody(announcement.getBody());
        response.setType(announcement.getType());
        response.setAuthorAccountId(announcement.getAuthorAccount().getId());
        response.setAuthorDisplayName(authorDisplayName != null ? authorDisplayName : announcement.getAuthorAccount().getUsername());
        response.setCreatedAt(announcement.getCreatedAt());
        response.setUpdatedAt(announcement.getUpdatedAt());

        List<TargetClassroomResponse> targetClassrooms = announcement.getTargetClassrooms().stream()
                .map(tc -> new TargetClassroomResponse(
                        tc.getClassroom().getId(),
                        tc.getClassroom().getGradeLevel(),
                        tc.getClassroom().getSectionName()
                ))
                .sorted(Comparator.comparing(TargetClassroomResponse::getGradeLevel)
                        .thenComparing(TargetClassroomResponse::getSectionName)
                        .thenComparing(TargetClassroomResponse::getId))
                .collect(Collectors.toList());
        response.setTargetClassrooms(targetClassrooms);

        if (attachments != null && !attachments.isEmpty()) {
            List<AnnouncementAttachmentResponse> attachmentResponses = attachments.stream()
                    .sorted(Comparator.comparing(AnnouncementAttachment::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                            .thenComparing(AnnouncementAttachment::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                    .map(this::toAttachmentResponse)
                    .collect(Collectors.toList());
            response.setAttachments(attachmentResponses);
        } else {
            response.setAttachments(Collections.emptyList());
        }

        return response;
    }
}
