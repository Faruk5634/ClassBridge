package com.classbridge.repository;

import com.classbridge.domain.DirectMessageAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DirectMessageAttachmentRepository extends JpaRepository<DirectMessageAttachment, Long> {
    List<DirectMessageAttachment> findByMessageIdOrderByCreatedAtAscIdAsc(Long messageId);
    Optional<DirectMessageAttachment> findByIdAndMessageId(Long id, Long messageId);
}
