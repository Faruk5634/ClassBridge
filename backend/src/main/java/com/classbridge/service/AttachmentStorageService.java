package com.classbridge.service;

import com.classbridge.exception.ResourceNotFoundException;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class AttachmentStorageService {

    private final Path storageDirectory;

    public AttachmentStorageService(
            @Value("${classbridge.attachments.storage-dir:${CLASSBRIDGE_ATTACHMENT_STORAGE_DIR:${user.home}/.classbridge/attachments}}")
            String storageDirPath) {
        this.storageDirectory = Paths.get(storageDirPath).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(storageDirectory);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to initialize attachment storage directory: " + storageDirectory, e);
        }
    }

    public String store(InputStream inputStream) {
        String storageKey = UUID.randomUUID().toString();
        Path targetPath = storageDirectory.resolve(storageKey).normalize();
        if (!targetPath.startsWith(storageDirectory)) {
            throw new SecurityException("Invalid storage key path traversal detected.");
        }

        Path tempFile = null;
        try {
            Files.createDirectories(storageDirectory);
            tempFile = Files.createTempFile(storageDirectory, "upload-", ".tmp");
            Files.copy(inputStream, tempFile, StandardCopyOption.REPLACE_EXISTING);

            try {
                Files.move(tempFile, targetPath, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException e) {
                Files.move(tempFile, targetPath, StandardCopyOption.REPLACE_EXISTING);
            }
            return storageKey;
        } catch (IOException e) {
            if (tempFile != null) {
                try {
                    Files.deleteIfExists(tempFile);
                } catch (IOException ignored) {
                }
            }
            try {
                Files.deleteIfExists(targetPath);
            } catch (IOException ignored) {
            }
            throw new RuntimeException("Failed to store attachment file.", e);
        }
    }

    public Resource loadAsResource(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            throw new ResourceNotFoundException("Attachment file not found.");
        }
        Path filePath = storageDirectory.resolve(storageKey).normalize();
        if (!filePath.startsWith(storageDirectory)) {
            throw new ResourceNotFoundException("Attachment file not found.");
        }
        if (!Files.exists(filePath) || !Files.isReadable(filePath)) {
            throw new ResourceNotFoundException("Attachment file not found.");
        }
        return new FileSystemResource(filePath);
    }

    public void deleteFile(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            return;
        }
        try {
            Path filePath = storageDirectory.resolve(storageKey).normalize();
            if (filePath.startsWith(storageDirectory)) {
                Files.deleteIfExists(filePath);
            }
        } catch (IOException ignored) {
        }
    }
}
