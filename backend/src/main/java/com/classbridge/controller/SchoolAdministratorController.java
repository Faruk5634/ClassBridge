package com.classbridge.controller;

import com.classbridge.dto.CreateSchoolAdministratorRequest;
import com.classbridge.dto.CreateSchoolAdministratorResponse;
import com.classbridge.dto.ErrorResponse;
import com.classbridge.exception.DuplicateUsernameException;
import com.classbridge.exception.InvalidRoleException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.service.SchoolAdministratorService;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/superadmin/schools/{schoolId}/administrators")
public class SchoolAdministratorController {

    private final SchoolAdministratorService schoolAdministratorService;

    public SchoolAdministratorController(SchoolAdministratorService schoolAdministratorService) {
        this.schoolAdministratorService = schoolAdministratorService;
    }

    @PostMapping
    public ResponseEntity<CreateSchoolAdministratorResponse> createAdministrator(
            @PathVariable Long schoolId,
            @Valid @RequestBody CreateSchoolAdministratorRequest request) {
        CreateSchoolAdministratorResponse response = schoolAdministratorService.createAdministrator(schoolId, request);
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

    @ExceptionHandler(InvalidRoleException.class)
    public ResponseEntity<ErrorResponse> handleInvalidRole(InvalidRoleException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse("A database conflict occurred; username may already be in use."));
    }
}
