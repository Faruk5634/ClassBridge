package com.classbridge.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "account_appearances")
public class AccountAppearance {

    @Id
    @Column(name = "user_account_id", nullable = false)
    private Long userAccountId;

    @Column(name = "avatar_type", nullable = false, length = 16)
    private String avatarType = "INITIALS";

    @Column(length = 32)
    private String animal;

    @Column(name = "image_data_url", columnDefinition = "text")
    private String imageDataUrl;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Long getUserAccountId() { return userAccountId; }
    public void setUserAccountId(Long userAccountId) { this.userAccountId = userAccountId; }
    public String getAvatarType() { return avatarType; }
    public void setAvatarType(String avatarType) { this.avatarType = avatarType; }
    public String getAnimal() { return animal; }
    public void setAnimal(String animal) { this.animal = animal; }
    public String getImageDataUrl() { return imageDataUrl; }
    public void setImageDataUrl(String imageDataUrl) { this.imageDataUrl = imageDataUrl; }
    public Instant getUpdatedAt() { return updatedAt; }
}
