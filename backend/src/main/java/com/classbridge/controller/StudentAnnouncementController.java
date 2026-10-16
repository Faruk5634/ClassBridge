package com.classbridge.controller;

import com.classbridge.dto.AnnouncementResponse;
import com.classbridge.dto.AttachmentDownload;
import com.classbridge.dto.ErrorResponse;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.service.AnnouncementService;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/student/announcements")
public class StudentAnnouncementController {

    private final AnnouncementService announcementService;

    public StudentAnnouncementController(AnnouncementService announcementService) {
        this.announcementService = announcementService;
    }

    @GetMapping
    public ResponseEntity<List<AnnouncementResponse>> getStudentAnnouncements(@AuthenticationPrincipal Jwt jwt) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        List<AnnouncementResponse> announcements = announcementService.getStudentAnnouncements(actorAccountId);
        return ResponseEntity.ok(announcements);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AnnouncementResponse> getStudentAnnouncement(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        AnnouncementResponse announcement = announcementService.getStudentAnnouncement(actorAccountId, id);
        return ResponseEntity.ok(announcement);
    }

    @GetMapping("/{announcementId}/attachments/{attachmentId}")
    public ResponseEntity<Resource> downloadAttachment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long announcementId,
            @PathVariable Long attachmentId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        AttachmentDownload download = announcementService.downloadStudentAttachment(actorAccountId, announcementId, attachmentId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.getContentType()))
                .contentLength(download.getFileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(download.getDisplayFilename(), StandardCharsets.UTF_8)
                                .build().toString())
                .body(download.getResource());
    }

    @ExceptionHandler(ForbiddenOperationException.class)
    public ResponseEntity<ErrorResponse> handleForbiddenOperation(ForbiddenOperationException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(ex.getMessage()));
    }
}
