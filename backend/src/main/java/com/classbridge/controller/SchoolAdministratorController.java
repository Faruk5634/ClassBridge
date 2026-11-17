package com.classbridge.controller;

import com.classbridge.dto.AssignSchoolAdministratorRequest;
import com.classbridge.dto.CreateSchoolAdministratorRequest;
import com.classbridge.dto.CreateSchoolAdministratorResponse;
import com.classbridge.dto.ErrorResponse;
import com.classbridge.dto.SchoolAdministratorSummaryResponse;
import com.classbridge.exception.DuplicateUsernameException;
import com.classbridge.exception.InvalidRoleException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.service.SchoolAdministratorService;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
@RequestMapping("/api/superadmin/schools/{schoolId}/administrators")
public class SchoolAdministratorController {

    private final SchoolAdministratorService schoolAdministratorService;

    public SchoolAdministratorController(SchoolAdministratorService schoolAdministratorService) {
        this.schoolAdministratorService = schoolAdministratorService;
    }

    @GetMapping
    public ResponseEntity<List<SchoolAdministratorSummaryResponse>> getSchoolAdministrators(@PathVariable Long schoolId) {
        return ResponseEntity.ok(schoolAdministratorService.getSchoolAdministrators(schoolId));
    }

    @GetMapping("/available")
    public ResponseEntity<List<SchoolAdministratorSummaryResponse>> getAvailableAdministrators(@PathVariable Long schoolId) {
        return ResponseEntity.ok(schoolAdministratorService.getAvailableAdministrators(schoolId));
    }

    @PostMapping
    public ResponseEntity<CreateSchoolAdministratorResponse> createAdministrator(
            @PathVariable Long schoolId,
            @Valid @RequestBody CreateSchoolAdministratorRequest request) {
        CreateSchoolAdministratorResponse response = schoolAdministratorService.createAdministrator(schoolId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/assignments")
    public ResponseEntity<SchoolAdministratorSummaryResponse> assignAdministrator(
            @PathVariable Long schoolId,
            @Valid @RequestBody AssignSchoolAdministratorRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(schoolAdministratorService.assignAdministrator(schoolId, request));
    }

    @PostMapping("/{userAccountId:\\d+}")
    public ResponseEntity<SchoolAdministratorSummaryResponse> assignAdministratorById(
            @PathVariable Long schoolId,
            @PathVariable Long userAccountId) {
        AssignSchoolAdministratorRequest request = new AssignSchoolAdministratorRequest();
        request.setSchoolId(schoolId);
        request.setUserAccountId(userAccountId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(schoolAdministratorService.assignAdministrator(schoolId, request));
    }

    @DeleteMapping("/{userAccountId:\\d+}")
    public ResponseEntity<Void> unassignAdministrator(
            @PathVariable Long schoolId,
            @PathVariable Long userAccountId) {
        schoolAdministratorService.unassignAdministrator(schoolId, userAccountId);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(DuplicateUsernameException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateUsername(DuplicateUsernameException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler({InvalidRoleException.class, IllegalArgumentException.class})
    public ResponseEntity<ErrorResponse> handleBadRequest(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleConflictState(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse("A database conflict occurred; this administrator or username may already be assigned."));
    }
}
