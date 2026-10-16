package com.classbridge.controller;

import com.classbridge.dto.AnnouncementResponse;
import com.classbridge.dto.AttachmentDownload;
import com.classbridge.dto.ChildResponse;
import com.classbridge.dto.ErrorResponse;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.service.AnnouncementService;
import com.classbridge.service.ParentService;
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
@RequestMapping("/api/parent/children")
public class ParentChildController {

    private final ParentService parentService;
    private final AnnouncementService announcementService;

    public ParentChildController(ParentService parentService, AnnouncementService announcementService) {
        this.parentService = parentService;
        this.announcementService = announcementService;
    }

    @GetMapping
    public ResponseEntity<List<ChildResponse>> getChildren(@AuthenticationPrincipal Jwt jwt) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        List<ChildResponse> children = parentService.getChildren(actorAccountId);
        return ResponseEntity.ok(children);
    }

    @GetMapping("/{studentProfileId}")
    public ResponseEntity<ChildResponse> getChild(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long studentProfileId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        ChildResponse child = parentService.getChild(actorAccountId, studentProfileId);
        return ResponseEntity.ok(child);
    }

    @GetMapping("/{studentProfileId}/announcements")
    public ResponseEntity<List<AnnouncementResponse>> getChildAnnouncements(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long studentProfileId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        List<AnnouncementResponse> announcements = announcementService.getParentAnnouncements(actorAccountId, studentProfileId);
        return ResponseEntity.ok(announcements);
    }

    @GetMapping("/{studentProfileId}/announcements/{announcementId}")
    public ResponseEntity<AnnouncementResponse> getChildAnnouncement(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long studentProfileId,
            @PathVariable Long announcementId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        AnnouncementResponse announcement = announcementService.getParentAnnouncement(actorAccountId, studentProfileId, announcementId);
        return ResponseEntity.ok(announcement);
    }

    @GetMapping("/{studentProfileId}/announcements/{announcementId}/attachments/{attachmentId}")
    public ResponseEntity<Resource> downloadChildAttachment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long studentProfileId,
            @PathVariable Long announcementId,
            @PathVariable Long attachmentId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        AttachmentDownload download = announcementService.downloadParentAttachment(actorAccountId, studentProfileId, announcementId, attachmentId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.getContentType()))
                .contentLength(download.getFileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(download.getDisplayFilename(), StandardCharsets.UTF_8)
                                .build().toString())
                .body(download.getResource());
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(ex.getMessage()));
    }
}
