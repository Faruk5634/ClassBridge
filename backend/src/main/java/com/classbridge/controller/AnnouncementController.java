package com.classbridge.controller;

import com.classbridge.dto.AnnouncementAttachmentResponse;
import com.classbridge.dto.AnnouncementResponse;
import com.classbridge.dto.AttachmentDownload;
import com.classbridge.dto.CreateAnnouncementRequest;
import com.classbridge.dto.ErrorResponse;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.InvalidAttachmentException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.service.AnnouncementService;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/api/announcements", "/api/school-admin/announcements"})
public class AnnouncementController {

    private final AnnouncementService announcementService;

    public AnnouncementController(AnnouncementService announcementService) {
        this.announcementService = announcementService;
    }

    @PostMapping
    public ResponseEntity<AnnouncementResponse> createAnnouncement(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateAnnouncementRequest request) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        AnnouncementResponse response = announcementService.createAnnouncement(actorAccountId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping(value = "/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AnnouncementAttachmentResponse> uploadAttachment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        AnnouncementAttachmentResponse response = announcementService.addAttachment(actorAccountId, id, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<AnnouncementResponse>> getSchoolAnnouncements(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long classroomId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        List<AnnouncementResponse> announcements = announcementService.getSchoolAnnouncements(actorAccountId, classroomId);
        return ResponseEntity.ok(announcements);
    }

    @GetMapping("/created-by-user")
    public ResponseEntity<List<AnnouncementResponse>> getTeacherAnnouncementHistory(@AuthenticationPrincipal Jwt jwt) {
        Long teacherAccountId = Long.valueOf(jwt.getSubject());
        List<AnnouncementResponse> announcements = announcementService.getTeacherAnnouncementHistory(teacherAccountId);
        return ResponseEntity.ok(announcements);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AnnouncementResponse> getSchoolAnnouncement(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        AnnouncementResponse announcement = announcementService.getSchoolAnnouncement(actorAccountId, id);
        return ResponseEntity.ok(announcement);
    }

    @GetMapping("/{announcementId}/attachments/{attachmentId}")
    public ResponseEntity<Resource> downloadAttachment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long announcementId,
            @PathVariable Long attachmentId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        AttachmentDownload download = announcementService.downloadSchoolAttachment(actorAccountId, announcementId, attachmentId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.getContentType()))
                .contentLength(download.getFileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(download.getDisplayFilename(), StandardCharsets.UTF_8)
                                .build().toString())
                .body(download.getResource());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationErrors(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(message.isEmpty() ? "Validation failed." : message));
    }

    @ExceptionHandler(InvalidAttachmentException.class)
    public ResponseEntity<ErrorResponse> handleInvalidAttachment(InvalidAttachmentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse("Attachment size exceeds the maximum permitted limit of 10 MB."));
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ErrorResponse> handleMultipart(MultipartException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse("Invalid multipart file upload request."));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(ex.getMessage()));
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
