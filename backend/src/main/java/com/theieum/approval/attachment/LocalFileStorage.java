package com.theieum.approval.attachment;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class LocalFileStorage implements FileStorage {

    private final Path storageDirectory;

    public LocalFileStorage(@Value("${app.file-storage.root-path}") Path storageDirectory) {
        this.storageDirectory = storageDirectory;
    }

    @Override
    public StoredFile store(String originalFilename, String contentType, byte[] bytes) {
        Objects.requireNonNull(bytes, "bytes must not be null");

        String extension = extractExtension(originalFilename);
        String storedFilename = UUID.randomUUID() + extension;
        Path storedPath = storageDirectory.resolve(storedFilename);

        try {
            Files.createDirectories(storageDirectory);
            Files.write(storedPath, bytes);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to store attachment", ex);
        }

        return new StoredFile(storedFilename, storedPath.toString(), bytes.length, contentType);
    }

    private String extractExtension(String originalFilename) {
        if (originalFilename == null) {
            return "";
        }

        int dotIndex = originalFilename.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == originalFilename.length() - 1) {
            return "";
        }

        return originalFilename.substring(dotIndex);
    }
}
