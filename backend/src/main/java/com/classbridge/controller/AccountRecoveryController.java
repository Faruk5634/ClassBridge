package com.classbridge.controller;

import com.classbridge.dto.CompletePasswordResetRequest;
import com.classbridge.dto.ConfirmAccountTokenRequest;
import com.classbridge.dto.ErrorResponse;
import com.classbridge.dto.MessageResponse;
import com.classbridge.dto.PasswordResetRequest;
import com.classbridge.dto.UpdateEmailRequest;
import com.classbridge.exception.InvalidRecoveryCodeException;
import com.classbridge.service.AccountRecoveryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AccountRecoveryController {

    private final AccountRecoveryService accountRecoveryService;

    public AccountRecoveryController(AccountRecoveryService accountRecoveryService) {
        this.accountRecoveryService = accountRecoveryService;
    }

    @PostMapping("/email-verification/request")
    public ResponseEntity<MessageResponse> requestEmailVerification(@AuthenticationPrincipal Jwt jwt) {
        accountRecoveryService.requestEmailVerification(Long.valueOf(jwt.getSubject()));
        return ResponseEntity.accepted().body(new MessageResponse("Verification code sent if email delivery is available."));
    }

    @PutMapping("/email")
    public ResponseEntity<MessageResponse> updateEmail(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateEmailRequest request) {
        accountRecoveryService.updateEmail(Long.valueOf(jwt.getSubject()), request);
        return ResponseEntity.ok(new MessageResponse("Email address updated. Verify it before using it for password recovery."));
    }

    @PostMapping("/email-verification/confirm")
    public ResponseEntity<Void> confirmEmailVerification(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ConfirmAccountTokenRequest request) {
        accountRecoveryService.confirmEmailVerification(Long.valueOf(jwt.getSubject()), request.getCode());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password-reset/request")
    public ResponseEntity<MessageResponse> requestPasswordReset(@Valid @RequestBody PasswordResetRequest request) {
        accountRecoveryService.requestPasswordReset(request.getEmail());
        return ResponseEntity.accepted().body(new MessageResponse(
                "If an active account has a verified email address, a recovery code will be sent."));
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<Void> completePasswordReset(@Valid @RequestBody CompletePasswordResetRequest request) {
        accountRecoveryService.completePasswordReset(request);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(new ErrorResponse(exception.getMessage()));
    }

    @ExceptionHandler(InvalidRecoveryCodeException.class)
    public ResponseEntity<ErrorResponse> handleInvalidRecoveryCode(InvalidRecoveryCodeException exception) {
        return ResponseEntity.badRequest().body(new ErrorResponse(exception.getMessage()));
    }

    @ExceptionHandler(AccountRecoveryService.RateLimitException.class)
    public ResponseEntity<ErrorResponse> handleRateLimit(AccountRecoveryService.RateLimitException exception) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(new ErrorResponse(exception.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleUnavailable(IllegalStateException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ErrorResponse("Email verification is temporarily unavailable."));
    }
}
