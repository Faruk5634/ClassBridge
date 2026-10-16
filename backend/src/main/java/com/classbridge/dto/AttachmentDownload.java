package com.classbridge.dto;

import org.springframework.core.io.Resource;

public class AttachmentDownload {

    private final Resource resource;
    private final String displayFilename;
    private final String contentType;
    private final long fileSize;

    public AttachmentDownload(Resource resource, String displayFilename, String contentType, long fileSize) {
        this.resource = resource;
        this.displayFilename = displayFilename;
        this.contentType = contentType;
        this.fileSize = fileSize;
    }

    public Resource getResource() {
        return resource;
    }

    public String getDisplayFilename() {
        return displayFilename;
    }

    public String getContentType() {
        return contentType;
    }

    public long getFileSize() {
        return fileSize;
    }
}
