package com.classbridge.repository;

import com.classbridge.domain.DirectMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface DirectMessageRepository extends JpaRepository<DirectMessage, Long> {

    @Query("SELECT m FROM DirectMessage m JOIN FETCH m.sender WHERE m.conversation.id = :conversationId ORDER BY m.createdAt ASC, m.id ASC")
    List<DirectMessage> findByConversationId(@Param("conversationId") Long conversationId);

    Optional<DirectMessage> findFirstByConversationIdOrderByCreatedAtDescIdDesc(Long conversationId);

    Optional<DirectMessage> findByIdAndConversationId(Long id, Long conversationId);

    @Query("SELECT COUNT(m) FROM DirectMessage m WHERE m.conversation.id = :conversationId " +
           "AND m.sender.id <> :accountId AND m.readAt IS NULL")
    long countUnreadForParticipant(@Param("conversationId") Long conversationId, @Param("accountId") Long accountId);

    @Modifying
    @Query("UPDATE DirectMessage m SET m.readAt = :readAt WHERE m.conversation.id = :conversationId " +
           "AND m.sender.id <> :accountId AND m.readAt IS NULL")
    int markIncomingRead(@Param("conversationId") Long conversationId,
                         @Param("accountId") Long accountId,
                         @Param("readAt") Instant readAt);
}
