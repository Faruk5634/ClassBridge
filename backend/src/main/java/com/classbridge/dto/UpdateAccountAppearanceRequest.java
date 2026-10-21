package com.classbridge.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class UpdateAccountAppearanceRequest {

    @NotBlank
    @Pattern(regexp = "INITIALS|ANIMAL|PHOTO")
    private String avatarType;

    @Size(max = 32)
    private String animal;

    @Size(max = 2_800_000)
    private String imageDataUrl;

    public String getAvatarType() { return avatarType; }
    public void setAvatarType(String avatarType) { this.avatarType = avatarType; }
    public String getAnimal() { return animal; }
    public void setAnimal(String animal) { this.animal = animal; }
    public String getImageDataUrl() { return imageDataUrl; }
    public void setImageDataUrl(String imageDataUrl) { this.imageDataUrl = imageDataUrl; }
}
