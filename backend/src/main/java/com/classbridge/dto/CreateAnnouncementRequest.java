package com.classbridge.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public class CreateAnnouncementRequest {

    @NotBlank(message = "Title is required.")
    @Size(max = 255, message = "Title must not exceed 255 characters.")
    private String title;

    @NotBlank(message = "Body is required.")
    private String body;

    @NotEmpty(message = "At least one target classroom is required.")
    private List<Long> targetClassroomIds;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public List<Long> getTargetClassroomIds() {
        return targetClassroomIds;
    }

    public void setTargetClassroomIds(List<Long> targetClassroomIds) {
        this.targetClassroomIds = targetClassroomIds;
    }
}
