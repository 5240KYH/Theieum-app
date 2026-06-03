package com.theieum.approval.attachment;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    boolean existsByApplicationIdAndMimeTypeStartingWith(Long applicationId, String mimeTypePrefix);
}
