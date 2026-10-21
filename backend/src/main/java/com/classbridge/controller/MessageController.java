package com.classbridge.controller;

import com.classbridge.dto.ConversationDetailResponse;
import com.classbridge.dto.ConversationResponse;
import com.classbridge.dto.CreateConversationRequest;
import com.classbridge.dto.DirectMessageResponse;
import com.classbridge.dto.AttachmentDownload;
import com.classbridge.dto.MessageAttachmentResponse;
import com.classbridge.dto.ErrorResponse;
import com.classbridge.exception.InvalidAttachmentException;
import com.classbridge.dto.MessageRecipientResponse;
import com.classbridge.dto.SendMessageRequest;
import com.classbridge.dto.StartStudentConversationsRequest;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.service.MessageService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;

import java.util.List;

@RestController
@RequestMapping("/api/messages")
public class MessageController {
    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    @GetMapping("/recipients")
    public ResponseEntity<List<MessageRecipientResponse>> searchRecipients(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam String query,
            @RequestParam(required = false) Long studentProfileId,
            @RequestParam(required = false) Long schoolId) {
        return ResponseEntity.ok(messageService.searchRecipients(accountId(jwt), query, studentProfileId, schoolId));
    }

    @GetMapping("/conversations")
    public ResponseEntity<List<ConversationResponse>> getConversations(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long studentProfileId) {
        return ResponseEntity.ok(messageService.getConversations(accountId(jwt), studentProfileId));
    }

    @PostMapping("/conversations")
    public ResponseEntity<ConversationResponse> startConversation(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateConversationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(messageService.startConversation(accountId(jwt), request));
    }

    @PostMapping("/conversations/students")
    public ResponseEntity<List<ConversationResponse>> startStudentConversations(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody StartStudentConversationsRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(messageService.startStudentConversations(accountId(jwt), request));
    }

    @GetMapping("/conversations/{conversationId}")
    public ResponseEntity<ConversationDetailResponse> getConversation(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long conversationId,
            @RequestParam(required = false) Long studentProfileId) {
        return ResponseEntity.ok(messageService.getConversation(accountId(jwt), conversationId, studentProfileId));
    }

    @PostMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<DirectMessageResponse> sendMessage(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long conversationId,
            @RequestParam(required = false) Long studentProfileId,
            @Valid @RequestBody SendMessageRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(messageService.sendMessage(accountId(jwt), conversationId, studentProfileId, request));
    }

    @PostMapping(value = "/conversations/{conversationId}/messages/{messageId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MessageAttachmentResponse> addAttachment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long conversationId,
            @PathVariable Long messageId,
            @RequestParam(required = false) Long studentProfileId,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(messageService.addAttachment(accountId(jwt), conversationId, messageId, studentProfileId, file));
    }

    @GetMapping("/conversations/{conversationId}/messages/{messageId}/attachments/{attachmentId}")
    public ResponseEntity<Resource> downloadAttachment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long conversationId,
            @PathVariable Long messageId,
            @PathVariable Long attachmentId,
            @RequestParam(required = false) Long studentProfileId) {
        AttachmentDownload download = messageService.downloadAttachment(accountId(jwt), conversationId, messageId, attachmentId, studentProfileId);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(download.getContentType()))
                .contentLength(download.getFileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(download.getDisplayFilename(), StandardCharsets.UTF_8).build().toString())
                .body(download.getResource());
    }

    private Long accountId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(exception.getMessage()));
    }

    @ExceptionHandler(ForbiddenOperationException.class)
    public ResponseEntity<ErrorResponse> handleForbidden(ForbiddenOperationException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorResponse(exception.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(new ErrorResponse(exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        return ResponseEntity.badRequest().body(new ErrorResponse("Request validation failed. Check the required fields and message length."));
    }

    @ExceptionHandler(InvalidAttachmentException.class)
    public ResponseEntity<ErrorResponse> handleInvalidAttachment(InvalidAttachmentException exception) {
        return ResponseEntity.badRequest().body(new ErrorResponse(exception.getMessage()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleUploadLimit(MaxUploadSizeExceededException exception) {
        return ResponseEntity.badRequest().body(new ErrorResponse("Attachment size exceeds the maximum permitted limit of 10 MB."));
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ErrorResponse> handleMultipart(MultipartException exception) {
        return ResponseEntity.badRequest().body(new ErrorResponse("Invalid multipart file upload request."));
    }
}
