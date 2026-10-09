package com.classbridge.mapper;

import com.classbridge.domain.School;
import com.classbridge.dto.SchoolRequest;
import com.classbridge.dto.SchoolResponse;
import org.springframework.stereotype.Component;

@Component
public class SchoolMapper {

    public School toEntity(SchoolRequest request) {
        School school = new School();
        school.setName(request.getName());
        school.setEducationLevel(request.getEducationLevel());
        school.setProvince(request.getProvince());
        school.setDistrict(request.getDistrict());
        school.setNeighborhood(request.getNeighborhood());
        school.setAddress(request.getAddress());
        return school;
    }

    public void updateEntity(School school, SchoolRequest request) {
        school.setName(request.getName());
        school.setEducationLevel(request.getEducationLevel());
        school.setProvince(request.getProvince());
        school.setDistrict(request.getDistrict());
        school.setNeighborhood(request.getNeighborhood());
        school.setAddress(request.getAddress());
    }

    public SchoolResponse toResponse(School school) {
        SchoolResponse response = new SchoolResponse();
        response.setId(school.getId());
        response.setName(school.getName());
        response.setEducationLevel(school.getEducationLevel());
        response.setProvince(school.getProvince());
        response.setDistrict(school.getDistrict());
        response.setNeighborhood(school.getNeighborhood());
        response.setAddress(school.getAddress());
        response.setCreatedAt(school.getCreatedAt());
        response.setUpdatedAt(school.getUpdatedAt());
        return response;
    }
}
