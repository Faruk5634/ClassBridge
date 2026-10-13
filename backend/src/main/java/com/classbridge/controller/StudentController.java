package com.classbridge.controller;

import com.classbridge.dto.CreateStudentRequest;
import com.classbridge.dto.CreateStudentResponse;
import com.classbridge.dto.ErrorResponse;
import com.classbridge.dto.PageResponse;
import com.classbridge.dto.StudentProfileResponse;
import com.classbridge.dto.UpdateStudentRequest;
import com.classbridge.exception.ArchivedStudentProfileException;
import com.classbridge.exception.DuplicateSchoolNumberException;
import com.classbridge.exception.DuplicateUsernameException;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.InvalidGradeLevelException;
import com.classbridge.exception.InvalidStudentEnrollmentException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.service.StudentService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/school-admin/students")
public class StudentController {

    private final StudentService studentService;

    public StudentController(StudentService studentService) {
        this.studentService = studentService;
    }

    @PostMapping
    public ResponseEntity<CreateStudentResponse> enrollStudent(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateStudentRequest request) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        CreateStudentResponse response = studentService.enrollStudent(actorAccountId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<PageResponse<StudentProfileResponse>> getStudents(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long classroomId,
            @RequestParam(defaultValue = "true") boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        PageResponse<StudentProfileResponse> response = studentService.getStudents(
                actorAccountId, classroomId, active, page, size
        );
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{studentProfileId}")
    public ResponseEntity<StudentProfileResponse> getStudent(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long studentProfileId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        StudentProfileResponse response = studentService.getStudent(actorAccountId, studentProfileId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{studentProfileId}")
    public ResponseEntity<StudentProfileResponse> updateStudent(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long studentProfileId,
            @Valid @RequestBody UpdateStudentRequest request) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        StudentProfileResponse response = studentService.updateStudent(actorAccountId, studentProfileId, request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{studentProfileId}/archive")
    public ResponseEntity<StudentProfileResponse> archiveStudent(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long studentProfileId) {
        Long actorAccountId = Long.valueOf(jwt.getSubject());
        StudentProfileResponse response = studentService.archiveStudent(actorAccountId, studentProfileId);
        return ResponseEntity.ok(response);
    }

    @ExceptionHandler(ArchivedStudentProfileException.class)
    public ResponseEntity<ErrorResponse> handleArchivedStudentProfile(ArchivedStudentProfileException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(DuplicateSchoolNumberException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateSchoolNumber(DuplicateSchoolNumberException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(DuplicateUsernameException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateUsername(DuplicateUsernameException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse("A database conflict occurred; school number or username may already be in use."));
    }

    @ExceptionHandler(InvalidStudentEnrollmentException.class)
    public ResponseEntity<ErrorResponse> handleInvalidStudentEnrollment(InvalidStudentEnrollmentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(InvalidGradeLevelException.class)
    public ResponseEntity<ErrorResponse> handleInvalidGradeLevel(InvalidGradeLevelException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(ForbiddenOperationException.class)
    public ResponseEntity<ErrorResponse> handleForbiddenOperation(ForbiddenOperationException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorResponse(ex.getMessage()));
    }
}
