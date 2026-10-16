package com.classbridge.controller;

import com.classbridge.dto.AdminPasswordResetResponse;
import com.classbridge.dto.ErrorResponse;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.service.AdminPasswordResetService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/superadmin/accounts")
public class SuperadminAccountPasswordResetController {

    private final AdminPasswordResetService adminPasswordResetService;

    public SuperadminAccountPasswordResetController(AdminPasswordResetService adminPasswordResetService) {
        this.adminPasswordResetService = adminPasswordResetService;
    }

    @PostMapping("/{accountId}/password-reset")
    public ResponseEntity<AdminPasswordResetResponse> resetPassword(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long accountId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(adminPasswordResetService.resetBySuperadmin(actorAccountId, accountId));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(ex.getMessage()));
    }
}
