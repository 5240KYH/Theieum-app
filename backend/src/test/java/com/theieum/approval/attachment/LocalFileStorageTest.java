package com.theieum.approval.attachment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import com.theieum.approval.common.FileStorageException;

class LocalFileStorageTest {

    @TempDir
    Path tempDir;

    @Test
    void readsStoredFileInsideRoot() {
        LocalFileStorage storage = new LocalFileStorage(tempDir);
        StoredFile stored = storage.store("receipt.png", "image/png", new byte[] {1, 2, 3});

        assertThat(storage.read(stored.path())).containsExactly(1, 2, 3);
    }

    @Test
    void rejectsReadOutsideRoot() throws Exception {
        LocalFileStorage storage = new LocalFileStorage(tempDir.resolve("attachments"));
        Path outside = tempDir.resolve("outside.txt");
        Files.writeString(outside, "secret");

        assertThatThrownBy(() -> storage.read(outside.toString()))
                .isInstanceOf(FileStorageException.class)
                .hasMessageContaining("outside configured storage root");
    }

    @Test
    void rejectsDeleteOutsideRoot() throws Exception {
        LocalFileStorage storage = new LocalFileStorage(tempDir.resolve("attachments"));
        Path outside = tempDir.resolve("outside.txt");
        Files.writeString(outside, "secret");

        assertThatThrownBy(() -> storage.deleteIfExists(outside.toString()))
                .isInstanceOf(FileStorageException.class)
                .hasMessageContaining("outside configured storage root");
        assertThat(Files.exists(outside)).isTrue();
    }

    @Test
    void rejectsReadThroughSymlinkEscapingRoot() throws Exception {
        Path attachments = tempDir.resolve("attachments");
        Files.createDirectories(attachments);
        Path outside = tempDir.resolve("outside.txt");
        Files.writeString(outside, "secret");
        Path symlink = attachments.resolve("linked-outside.txt");
        Files.createSymbolicLink(symlink, outside);
        LocalFileStorage storage = new LocalFileStorage(attachments);

        assertThatThrownBy(() -> storage.read(symlink.toString()))
                .isInstanceOf(FileStorageException.class)
                .hasMessageContaining("outside configured storage root");
    }

    @Test
    void rejectsDeleteThroughSymlinkEscapingRoot() throws Exception {
        Path attachments = tempDir.resolve("attachments");
        Files.createDirectories(attachments);
        Path outside = tempDir.resolve("outside.txt");
        Files.writeString(outside, "secret");
        Path symlink = attachments.resolve("linked-outside.txt");
        Files.createSymbolicLink(symlink, outside);
        LocalFileStorage storage = new LocalFileStorage(attachments);

        assertThatThrownBy(() -> storage.deleteIfExists(symlink.toString()))
                .isInstanceOf(FileStorageException.class)
                .hasMessageContaining("outside configured storage root");
        assertThat(Files.exists(outside)).isTrue();
        assertThat(Files.exists(symlink)).isTrue();
    }
}
