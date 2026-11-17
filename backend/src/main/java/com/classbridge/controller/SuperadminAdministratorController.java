package com.classbridge.controller;

import com.classbridge.domain.SchoolLevel;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.CreateSchoolAdministratorRequest;
import com.classbridge.dto.CreateSchoolAdministratorResponse;
import com.classbridge.dto.ErrorResponse;
import com.classbridge.dto.PageResponse;
import com.classbridge.dto.SchoolAdministratorProfileResponse;
import com.classbridge.dto.SchoolAdministratorSummaryResponse;
import com.classbridge.dto.UpdateSchoolAdministratorRequest;
import com.classbridge.exception.DuplicateUsernameException;
import com.classbridge.exception.InvalidRoleException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.service.SchoolAdministratorService;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Platform-wide administrator directory, profile management, and account creation. Restricted to SUPERADMIN by SecurityConfig (/api/superadmin/**). */
@RestController
@RequestMapping("/api/superadmin/administrators")
public class SuperadminAdministratorController {

    private final SchoolAdministratorService schoolAdministratorService;

    public SuperadminAdministratorController(SchoolAdministratorService schoolAdministratorService) {
        this.schoolAdministratorService = schoolAdministratorService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<SchoolAdministratorSummaryResponse>> getAdministrators(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(required = false) UserRole role,
            @RequestParam(required = false) SchoolLevel educationLevel,
            @RequestParam(required = false) Long schoolId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(schoolAdministratorService.getAdministrators(query, role, educationLevel, schoolId, page, size));
    }

    @GetMapping("/{userAccountId:\\d+}")
    public ResponseEntity<SchoolAdministratorProfileResponse> getAdministrator(@PathVariable Long userAccountId) {
        return ResponseEntity.ok(schoolAdministratorService.getAdministrator(userAccountId));
    }

    @PutMapping("/{userAccountId:\\d+}")
    public ResponseEntity<SchoolAdministratorProfileResponse> updateAdministrator(
            @PathVariable Long userAccountId,
            @Valid @RequestBody UpdateSchoolAdministratorRequest request) {
        return ResponseEntity.ok(schoolAdministratorService.updateAdministrator(userAccountId, request));
    }

    @PostMapping("/{userAccountId:\\d+}/archive")
    public ResponseEntity<SchoolAdministratorProfileResponse> archiveAdministrator(@PathVariable Long userAccountId) {
        return ResponseEntity.ok(schoolAdministratorService.archiveAdministrator(userAccountId));
    }

    @PostMapping("/{userAccountId:\\d+}/restore")
    public ResponseEntity<SchoolAdministratorProfileResponse> restoreAdministrator(@PathVariable Long userAccountId) {
        return ResponseEntity.ok(schoolAdministratorService.restoreAdministrator(userAccountId));
    }

    @PostMapping
    public ResponseEntity<CreateSchoolAdministratorResponse> createAdministrator(
            @Valid @RequestBody CreateSchoolAdministratorRequest request) {
        CreateSchoolAdministratorResponse response = schoolAdministratorService.createAdministrator(request.getSchoolId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
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
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse("A database conflict occurred; username may already be in use."));
    }
}
