package com.classbridge.controller;

import com.classbridge.dto.CreateParentRequest;
import com.classbridge.dto.CreateParentResponse;
import com.classbridge.dto.ErrorResponse;
import com.classbridge.dto.SchoolParentResponse;
import com.classbridge.dto.SchoolParentStudentResponse;
import com.classbridge.dto.UpdateParentRequest;
import com.classbridge.exception.DuplicateUsernameException;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.service.ParentService;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/school-admin/parents")
public class ParentController {

    private final ParentService parentService;

    public ParentController(ParentService parentService) {
        this.parentService = parentService;
    }

    @GetMapping
    public ResponseEntity<java.util.List<SchoolParentResponse>> getSchoolParents(@AuthenticationPrincipal Jwt jwt) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(parentService.getSchoolParents(actorAccountId));
    }

    @GetMapping("/{parentProfileId}")
    public ResponseEntity<SchoolParentResponse> getSchoolParent(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long parentProfileId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(parentService.getSchoolParent(actorAccountId, parentProfileId));
    }

    @GetMapping("/{parentProfileId}/students")
    public ResponseEntity<java.util.List<SchoolParentStudentResponse>> getSchoolParentStudents(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long parentProfileId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(parentService.getSchoolParentStudents(actorAccountId, parentProfileId, false));
    }

    @GetMapping("/{parentProfileId}/available-students")
    public ResponseEntity<java.util.List<SchoolParentStudentResponse>> getAvailableStudents(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long parentProfileId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(parentService.getSchoolParentStudents(actorAccountId, parentProfileId, true));
    }

    @PostMapping("/{parentProfileId}/students/{studentProfileId}")
    public ResponseEntity<SchoolParentResponse> linkStudent(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long parentProfileId,
            @PathVariable Long studentProfileId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(parentService.linkStudent(actorAccountId, parentProfileId, studentProfileId));
    }

    @DeleteMapping("/{parentProfileId}/students/{studentProfileId}")
    public ResponseEntity<SchoolParentResponse> unlinkStudent(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long parentProfileId,
            @PathVariable Long studentProfileId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(parentService.unlinkStudent(actorAccountId, parentProfileId, studentProfileId));
    }

    @PutMapping("/{parentProfileId}")
    public ResponseEntity<SchoolParentResponse> updateSchoolParent(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long parentProfileId,
            @Valid @RequestBody UpdateParentRequest request) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(parentService.updateSchoolParent(actorAccountId, parentProfileId, request));
    }

    @PostMapping("/{parentProfileId}/archive")
    public ResponseEntity<SchoolParentResponse> archiveSchoolParent(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long parentProfileId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(parentService.archiveSchoolParent(actorAccountId, parentProfileId));
    }

    @PostMapping("/{parentProfileId}/restore")
    public ResponseEntity<SchoolParentResponse> restoreSchoolParent(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long parentProfileId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        return ResponseEntity.ok(parentService.restoreSchoolParent(actorAccountId, parentProfileId));
    }

    @PostMapping
    public ResponseEntity<CreateParentResponse> createParent(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateParentRequest request) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        CreateParentResponse response = parentService.createParent(actorAccountId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @ExceptionHandler(DuplicateUsernameException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateUsername(DuplicateUsernameException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(ForbiddenOperationException.class)
    public ResponseEntity<ErrorResponse> handleForbiddenOperation(ForbiddenOperationException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse("A database conflict occurred; username may already be in use."));
    }
}
