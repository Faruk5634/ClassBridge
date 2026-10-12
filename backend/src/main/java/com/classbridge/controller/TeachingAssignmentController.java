package com.classbridge.controller;

import com.classbridge.dto.CreateTeachingAssignmentRequest;
import com.classbridge.dto.ErrorResponse;
import com.classbridge.dto.TeachingAssignmentResponse;
import com.classbridge.exception.DuplicateTeachingAssignmentException;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.InvalidTeachingAssignmentException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.service.TeachingAssignmentService;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/school-admin/classrooms/{classroomId}/teaching-assignments")
public class TeachingAssignmentController {

    private final TeachingAssignmentService teachingAssignmentService;

    public TeachingAssignmentController(TeachingAssignmentService teachingAssignmentService) {
        this.teachingAssignmentService = teachingAssignmentService;
    }

    @PostMapping
    public ResponseEntity<TeachingAssignmentResponse> createTeachingAssignment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long classroomId,
            @Valid @RequestBody CreateTeachingAssignmentRequest request) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        TeachingAssignmentResponse response = teachingAssignmentService.createTeachingAssignment(actorAccountId, classroomId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<TeachingAssignmentResponse>> getTeachingAssignments(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long classroomId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        List<TeachingAssignmentResponse> response = teachingAssignmentService.getTeachingAssignments(actorAccountId, classroomId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{teacherAccountId}")
    public ResponseEntity<Void> deleteTeachingAssignment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long classroomId,
            @PathVariable Long teacherAccountId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        teachingAssignmentService.deleteTeachingAssignment(actorAccountId, classroomId, teacherAccountId);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(ForbiddenOperationException.class)
    public ResponseEntity<ErrorResponse> handleForbiddenOperation(ForbiddenOperationException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(InvalidTeachingAssignmentException.class)
    public ResponseEntity<ErrorResponse> handleInvalidTeachingAssignment(InvalidTeachingAssignmentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(DuplicateTeachingAssignmentException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateTeachingAssignment(DuplicateTeachingAssignmentException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse("A database conflict occurred; teacher may already be assigned to this classroom."));
    }
}
