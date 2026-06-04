package com.theieum.approval.attachment;

public interface FileStorage {

    StoredFile store(String originalFilename, String contentType, byte[] bytes);

    byte[] read(String path);

    void deleteIfExists(String path);
}
