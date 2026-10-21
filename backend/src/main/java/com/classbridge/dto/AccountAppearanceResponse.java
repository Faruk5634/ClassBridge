package com.classbridge.dto;

public class AccountAppearanceResponse {

    private final String avatarType;
    private final String animal;
    private final String imageDataUrl;

    public AccountAppearanceResponse(String avatarType, String animal, String imageDataUrl) {
        this.avatarType = avatarType;
        this.animal = animal;
        this.imageDataUrl = imageDataUrl;
    }

    public String getAvatarType() { return avatarType; }
    public String getAnimal() { return animal; }
    public String getImageDataUrl() { return imageDataUrl; }
}
