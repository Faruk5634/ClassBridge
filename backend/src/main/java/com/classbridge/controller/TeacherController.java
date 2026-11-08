package com.classbridge.controller;

import com.classbridge.dto.CreateTeacherRequest;
import com.classbridge.dto.CreateTeacherResponse;
import com.classbridge.dto.ErrorResponse;
import com.classbridge.dto.PageResponse;
import com.classbridge.dto.TeacherProfileResponse;
import com.classbridge.dto.UpdateTeacherRequest;
import com.classbridge.exception.DuplicateUsernameException;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.service.TeacherService;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/school-admin/teachers")
public class TeacherController {

    private final TeacherService teacherService;

    public TeacherController(TeacherService teacherService) {
        this.teacherService = teacherService;
    }

    @PostMapping
    public ResponseEntity<CreateTeacherResponse> createTeacher(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateTeacherRequest request) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        CreateTeacherResponse response = teacherService.createTeacher(actorAccountId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<PageResponse<TeacherProfileResponse>> getTeachers(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "true") boolean active,
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(teacherService.getTeachers(actorAccountId, active, query, page, size));
    }

    @GetMapping("/{teacherAccountId}")
    public ResponseEntity<TeacherProfileResponse> getTeacher(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long teacherAccountId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(teacherService.getTeacher(actorAccountId, teacherAccountId));
    }

    @PutMapping("/{teacherAccountId}")
    public ResponseEntity<TeacherProfileResponse> updateTeacher(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long teacherAccountId,
            @Valid @RequestBody UpdateTeacherRequest request) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(teacherService.updateTeacher(actorAccountId, teacherAccountId, request));
    }

    @PostMapping("/{teacherAccountId}/archive")
    public ResponseEntity<TeacherProfileResponse> archiveTeacher(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long teacherAccountId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(teacherService.archiveTeacher(actorAccountId, teacherAccountId));
    }

    @PostMapping("/{teacherAccountId}/restore")
    public ResponseEntity<TeacherProfileResponse> restoreTeacher(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long teacherAccountId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(teacherService.restoreTeacher(actorAccountId, teacherAccountId));
    }

    @ExceptionHandler(DuplicateUsernameException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateUsername(DuplicateUsernameException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(ForbiddenOperationException.class)
    public ResponseEntity<ErrorResponse> handleForbiddenOperation(ForbiddenOperationException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse("A database conflict occurred; username may already be in use."));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleConflict(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(ex.getMessage()));
    }
}
