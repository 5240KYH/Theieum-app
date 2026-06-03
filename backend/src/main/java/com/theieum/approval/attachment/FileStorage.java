package com.theieum.approval.attachment;

public interface FileStorage {

    StoredFile store(String originalFilename, String contentType, byte[] bytes);
}
