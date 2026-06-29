package com.theieum.approval.attachment;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.util.Objects;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.theieum.approval.common.FileStorageException;

@Component
public class LocalFileStorage implements FileStorage {

    private final Path storageDirectory;

    public LocalFileStorage(@Value("${app.file-storage.root-path}") Path storageDirectory) {
        this.storageDirectory = storageDirectory.toAbsolutePath().normalize();
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
            throw new FileStorageException("Unable to store attachment", ex);
        }

        return new StoredFile(storedFilename, storedPath.toString(), bytes.length, contentType);
    }

    @Override
    public byte[] read(String path) {
        Path resolvedPath = resolveReadablePath(path);
        try {
            return Files.readAllBytes(resolvedPath);
        } catch (IOException ex) {
            throw new FileStorageException("Unable to read attachment", ex);
        }
    }

    @Override
    public void deleteIfExists(String path) {
        Path resolvedPath = resolveDeletablePath(path);
        try {
            Files.deleteIfExists(resolvedPath);
        } catch (IOException ex) {
            throw new FileStorageException("Unable to delete attachment", ex);
        }
    }

    private Path resolveInsideStorageRoot(String path) {
        Path resolvedPath = Path.of(path).toAbsolutePath().normalize();
        if (!resolvedPath.startsWith(storageDirectory)) {
            throw new FileStorageException("Attachment path is outside configured storage root", null);
        }
        return resolvedPath;
    }

    private Path resolveReadablePath(String path) {
        Path resolvedPath = resolveInsideStorageRoot(path);
        return requireRealPathInsideStorageRoot(resolvedPath);
    }

    private Path resolveDeletablePath(String path) {
        Path resolvedPath = resolveInsideStorageRoot(path);
        if (!Files.exists(resolvedPath, LinkOption.NOFOLLOW_LINKS)) {
            return resolvedPath;
        }
        requireRealPathInsideStorageRoot(resolvedPath);
        return resolvedPath;
    }

    private Path requireRealPathInsideStorageRoot(Path resolvedPath) {
        try {
            Path storageRoot = storageDirectory.toRealPath();
            Path realPath = resolvedPath.toRealPath();
            if (!realPath.startsWith(storageRoot)) {
                throw new FileStorageException("Attachment path is outside configured storage root", null);
            }
            return realPath;
        } catch (IOException ex) {
            throw new FileStorageException("Unable to resolve attachment path", ex);
        }
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
