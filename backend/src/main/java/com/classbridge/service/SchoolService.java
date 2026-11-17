package com.classbridge.service;

import com.classbridge.domain.School;
import com.classbridge.dto.SchoolRequest;
import com.classbridge.dto.SchoolResponse;
import com.classbridge.mapper.SchoolMapper;
import com.classbridge.repository.SchoolRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class SchoolService {

    private final SchoolRepository schoolRepository;
    private final SchoolMapper schoolMapper;

    public SchoolService(SchoolRepository schoolRepository, SchoolMapper schoolMapper) {
        this.schoolRepository = schoolRepository;
        this.schoolMapper = schoolMapper;
    }

    @Transactional
    public SchoolResponse createSchool(SchoolRequest request) {
        School school = schoolMapper.toEntity(request);
        School savedSchool = schoolRepository.save(school);
        return schoolMapper.toResponse(savedSchool);
    }

    @Transactional(readOnly = true)
    public List<SchoolResponse> getSchools() {
        return getSchools(null);
    }

    @Transactional(readOnly = true)
    public List<SchoolResponse> getSchools(Boolean active) {
        return schoolRepository.findAll().stream()
                .filter(school -> active == null || school.isActive() == active)
                .map(schoolMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Optional<SchoolResponse> getSchool(Long id) {
        return schoolRepository.findById(id)
                .map(schoolMapper::toResponse);
    }

    @Transactional
    public Optional<SchoolResponse> updateSchool(Long id, SchoolRequest request) {
        return schoolRepository.findById(id)
                .map(school -> {
                    if (!school.isActive()) {
                        throw new IllegalStateException("Archived schools are read-only until restored.");
                    }
                    schoolMapper.updateEntity(school, request);
                    School updatedSchool = schoolRepository.save(school);
                    return schoolMapper.toResponse(updatedSchool);
                });
    }

    @Transactional
    public Optional<SchoolResponse> archiveSchool(Long id) {
        return schoolRepository.findById(id)
                .map(school -> {
                    school.setActive(false);
                    return schoolMapper.toResponse(schoolRepository.save(school));
                });
    }

    @Transactional
    public Optional<SchoolResponse> restoreSchool(Long id) {
        return schoolRepository.findById(id)
                .map(school -> {
                    school.setActive(true);
                    return schoolMapper.toResponse(schoolRepository.save(school));
                });
    }
}
