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
        return schoolRepository.findAll().stream()
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
                    schoolMapper.updateEntity(school, request);
                    School updatedSchool = schoolRepository.save(school);
                    return schoolMapper.toResponse(updatedSchool);
                });
    }
}
