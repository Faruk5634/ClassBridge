package com.classbridge.service;

import com.classbridge.exception.InvalidAttachmentException;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

@Component
public class AttachmentValidator {

    public static final long MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

    public static class ValidatedAttachment {
        private final String displayFilename;
        private final String canonicalContentType;
        private final long fileSize;

        public ValidatedAttachment(String displayFilename, String canonicalContentType, long fileSize) {
            this.displayFilename = displayFilename;
            this.canonicalContentType = canonicalContentType;
            this.fileSize = fileSize;
        }

        public String getDisplayFilename() {
            return displayFilename;
        }

        public String getCanonicalContentType() {
            return canonicalContentType;
        }

        public long getFileSize() {
            return fileSize;
        }
    }

    public ValidatedAttachment validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new InvalidAttachmentException("Attachment file must not be empty.");
        }

        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new InvalidAttachmentException("Attachment size exceeds the maximum permitted limit of 10 MB.");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.trim().isEmpty()) {
            throw new InvalidAttachmentException("Attachment filename must not be empty.");
        }

        String sanitizedFilename = sanitizeFilename(originalFilename);
        int extIndex = sanitizedFilename.lastIndexOf('.');
        if (extIndex <= 0 || extIndex == sanitizedFilename.length() - 1) {
            throw new InvalidAttachmentException("Attachment must have a valid extension (.pdf, .jpg, .jpeg, or .png).");
        }

        String extension = sanitizedFilename.substring(extIndex).toLowerCase(Locale.ROOT);
        String declaredContentType = file.getContentType();
        String cleanDeclaredContentType = declaredContentType != null
                ? declaredContentType.split(";")[0].trim().toLowerCase(Locale.ROOT)
                : "";

        byte[] header = new byte[16];
        int bytesRead;
        try (InputStream is = file.getInputStream()) {
            bytesRead = is.readNBytes(header, 0, 16);
        } catch (IOException e) {
            throw new InvalidAttachmentException("Failed to read attachment file content.");
        }

        String canonicalContentType;

        switch (extension) {
            case ".pdf" -> {
                if (!cleanDeclaredContentType.isEmpty()
                        && !cleanDeclaredContentType.equals("application/pdf")
                        && !cleanDeclaredContentType.equals("application/x-pdf")) {
                    throw new InvalidAttachmentException("Content-Type does not match PDF file extension.");
                }
                boolean isPdf = bytesRead >= 5
                        && header[0] == 0x25 // %
                        && header[1] == 0x50 // P
                        && header[2] == 0x44 // D
                        && header[3] == 0x46 // F
                        && header[4] == 0x2D; // -
                if (!isPdf) {
                    throw new InvalidAttachmentException("File content signature does not match PDF format.");
                }
                canonicalContentType = "application/pdf";
            }
            case ".jpg", ".jpeg" -> {
                if (!cleanDeclaredContentType.isEmpty()
                        && !cleanDeclaredContentType.equals("image/jpeg")
                        && !cleanDeclaredContentType.equals("image/jpg")
                        && !cleanDeclaredContentType.equals("image/pjpeg")) {
                    throw new InvalidAttachmentException("Content-Type does not match JPEG file extension.");
                }
                boolean isJpeg = bytesRead >= 3
                        && (header[0] & 0xFF) == 0xFF
                        && (header[1] & 0xFF) == 0xD8
                        && (header[2] & 0xFF) == 0xFF;
                if (!isJpeg) {
                    throw new InvalidAttachmentException("File content signature does not match JPEG format.");
                }
                canonicalContentType = "image/jpeg";
            }
            case ".png" -> {
                if (!cleanDeclaredContentType.isEmpty()
                        && !cleanDeclaredContentType.equals("image/png")
                        && !cleanDeclaredContentType.equals("image/x-png")) {
                    throw new InvalidAttachmentException("Content-Type does not match PNG file extension.");
                }
                boolean isPng = bytesRead >= 8
                        && (header[0] & 0xFF) == 0x89
                        && (header[1] & 0xFF) == 0x50
                        && (header[2] & 0xFF) == 0x4E
                        && (header[3] & 0xFF) == 0x47
                        && (header[4] & 0xFF) == 0x0D
                        && (header[5] & 0xFF) == 0x0A
                        && (header[6] & 0xFF) == 0x1A
                        && (header[7] & 0xFF) == 0x0A;
                if (!isPng) {
                    throw new InvalidAttachmentException("File content signature does not match PNG format.");
                }
                canonicalContentType = "image/png";
            }
            default -> throw new InvalidAttachmentException("Unsupported file type. Only PDF, JPEG, and PNG files are supported.");
        }

        return new ValidatedAttachment(sanitizedFilename, canonicalContentType, file.getSize());
    }

    private String sanitizeFilename(String filename) {
        String clean = filename.trim();
        int lastSlash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
        if (lastSlash >= 0) {
            clean = clean.substring(lastSlash + 1).trim();
        }
        clean = clean.replaceAll("[\\p{Cntrl}]", "");
        clean = clean.replace("..", "").trim();
        if (clean.isEmpty() || clean.equals(".")) {
            throw new InvalidAttachmentException("Attachment filename is invalid after sanitization.");
        }

        if (clean.length() > 255) {
            int extIndex = clean.lastIndexOf('.');
            if (extIndex > 0) {
                String ext = clean.substring(extIndex);
                int keepBase = 255 - ext.length();
                if (keepBase > 0) {
                    clean = clean.substring(0, keepBase) + ext;
                } else {
                    clean = clean.substring(0, 255);
                }
            } else {
                clean = clean.substring(0, 255);
            }
        }
        return clean;
    }
}
