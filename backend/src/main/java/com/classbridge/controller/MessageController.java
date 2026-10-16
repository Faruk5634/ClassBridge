package com.classbridge.controller;

import com.classbridge.dto.ConversationDetailResponse;
import com.classbridge.dto.ConversationResponse;
import com.classbridge.dto.CreateConversationRequest;
import com.classbridge.dto.DirectMessageResponse;
import com.classbridge.dto.ErrorResponse;
import com.classbridge.dto.MessageRecipientResponse;
import com.classbridge.dto.SendMessageRequest;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.service.MessageService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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
}
