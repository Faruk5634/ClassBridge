package com.classbridge.repository;

import com.classbridge.domain.AnnouncementAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface AnnouncementAttachmentRepository extends JpaRepository<AnnouncementAttachment, Long> {

    List<AnnouncementAttachment> findByAnnouncementIdInOrderByCreatedAtAscIdAsc(Collection<Long> announcementIds);

    List<AnnouncementAttachment> findByAnnouncementIdOrderByCreatedAtAscIdAsc(Long announcementId);

    Optional<AnnouncementAttachment> findByIdAndAnnouncementId(Long id, Long announcementId);
}
