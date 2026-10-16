package com.classbridge.controller;

import com.classbridge.dto.ErrorResponse;
import com.classbridge.dto.MyProfileResponse;
import com.classbridge.dto.UpdatePhoneNumberRequest;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.service.AccountProfileService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AccountProfileController {

    private final AccountProfileService accountProfileService;

    public AccountProfileController(AccountProfileService accountProfileService) {
        this.accountProfileService = accountProfileService;
    }

    @GetMapping("/me")
    public ResponseEntity<MyProfileResponse> getMyProfile(@AuthenticationPrincipal Jwt jwt) {
        Long accountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(accountProfileService.getMyProfile(accountId));
    }

    @PutMapping("/phone")
    public ResponseEntity<MyProfileResponse> updatePhoneNumber(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdatePhoneNumberRequest request) {
        Long accountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(accountProfileService.updatePhoneNumber(accountId, request));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(exception.getMessage()));
    }
}
