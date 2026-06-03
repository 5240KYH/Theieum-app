package com.theieum.approval.attachment;

public record StoredFile(String storedFilename, String path, long size, String contentType) {
}
