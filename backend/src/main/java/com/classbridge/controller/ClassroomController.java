package com.classbridge.controller;

import com.classbridge.dto.ClassroomRequest;
import com.classbridge.dto.ClassroomResponse;
import com.classbridge.dto.ErrorResponse;
import com.classbridge.exception.DuplicateClassroomException;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.InvalidGradeLevelException;
import com.classbridge.exception.InvalidHomeroomTeacherException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.service.ClassroomService;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/school-admin/classrooms")
public class ClassroomController {

    private final ClassroomService classroomService;

    public ClassroomController(ClassroomService classroomService) {
        this.classroomService = classroomService;
    }

    @PostMapping
    public ResponseEntity<ClassroomResponse> createClassroom(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ClassroomRequest request) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        ClassroomResponse response = classroomService.createClassroom(actorAccountId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<ClassroomResponse>> getClassrooms(
            @AuthenticationPrincipal Jwt jwt) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        List<ClassroomResponse> response = classroomService.getClassrooms(actorAccountId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{classroomId}")
    public ResponseEntity<ClassroomResponse> getClassroom(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long classroomId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        ClassroomResponse response = classroomService.getClassroom(actorAccountId, classroomId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{classroomId}")
    public ResponseEntity<ClassroomResponse> updateClassroom(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long classroomId,
            @Valid @RequestBody ClassroomRequest request) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        ClassroomResponse response = classroomService.updateClassroom(actorAccountId, classroomId, request);
        return ResponseEntity.ok(response);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(ForbiddenOperationException.class)
    public ResponseEntity<ErrorResponse> handleForbiddenOperation(ForbiddenOperationException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(InvalidGradeLevelException.class)
    public ResponseEntity<ErrorResponse> handleInvalidGradeLevel(InvalidGradeLevelException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(InvalidHomeroomTeacherException.class)
    public ResponseEntity<ErrorResponse> handleInvalidHomeroomTeacher(InvalidHomeroomTeacherException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(DuplicateClassroomException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateClassroom(DuplicateClassroomException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse("A database conflict occurred; classroom may already exist."));
    }
}
