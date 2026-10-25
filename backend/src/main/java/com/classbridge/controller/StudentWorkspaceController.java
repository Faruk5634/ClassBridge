package com.classbridge.controller;

import com.classbridge.dto.ErrorResponse;
import com.classbridge.dto.StudentWorkspaceProfileResponse;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.service.StudentWorkspaceService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/student")
public class StudentWorkspaceController {
    private final StudentWorkspaceService studentWorkspaceService;

    public StudentWorkspaceController(StudentWorkspaceService studentWorkspaceService) {
        this.studentWorkspaceService = studentWorkspaceService;
    }

    @GetMapping("/profile")
    public ResponseEntity<StudentWorkspaceProfileResponse> getOwnProfile(@AuthenticationPrincipal Jwt jwt) {
        Long accountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(studentWorkspaceService.getOwnProfile(accountId));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException exception) {
        return ResponseEntity.status(404).body(new ErrorResponse(exception.getMessage()));
    }
}
