package com.classbridge.dto;

import com.classbridge.domain.SchoolLevel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class SchoolRequest {
    @NotBlank
    @Size(max = 255)
    private String name;

    @NotNull
    private SchoolLevel educationLevel;

    @NotBlank
    @Size(max = 100)
    private String province;

    @NotBlank
    @Size(max = 100)
    private String district;

    @Size(max = 255)
    private String neighborhood;

    private String address;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public SchoolLevel getEducationLevel() {
        return educationLevel;
    }

    public void setEducationLevel(SchoolLevel educationLevel) {
        this.educationLevel = educationLevel;
    }

    public String getProvince() {
        return province;
    }

    public void setProvince(String province) {
        this.province = province;
    }

    public String getDistrict() {
        return district;
    }

    public void setDistrict(String district) {
        this.district = district;
    }

    public String getNeighborhood() {
        return neighborhood;
    }

    public void setNeighborhood(String neighborhood) {
        this.neighborhood = neighborhood;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }
}
