package com.theieum.approval.attachment;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    boolean existsByApplicationIdAndMimeTypeStartingWith(Long applicationId, String mimeTypePrefix);

    List<Attachment> findByApplicationIdOrderByIdAsc(Long applicationId);

    Optional<Attachment> findByIdAndApplicationId(Long id, Long applicationId);

    long countByApplicationId(Long applicationId);
}
