package com.classbridge.repository;

import com.classbridge.domain.MessageConversation;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageConversationRepository extends JpaRepository<MessageConversation, Long> {

    @EntityGraph(attributePaths = {"school", "participantOne", "participantTwo", "studentProfile", "studentProfile.school"})
    @Query("SELECT c FROM MessageConversation c WHERE c.participantOne.id = :accountId OR c.participantTwo.id = :accountId " +
           "ORDER BY c.lastMessageAt DESC, c.id DESC")
    List<MessageConversation> findForParticipant(@Param("accountId") Long accountId);

    @EntityGraph(attributePaths = {"school", "participantOne", "participantTwo", "studentProfile", "studentProfile.school", "studentProfile.userAccount"})
    @Query("SELECT c FROM MessageConversation c WHERE c.id = :id AND " +
           "(c.participantOne.id = :accountId OR c.participantTwo.id = :accountId)")
    Optional<MessageConversation> findForParticipantById(@Param("id") Long id, @Param("accountId") Long accountId);

    @EntityGraph(attributePaths = {"school", "participantOne", "participantTwo", "studentProfile", "studentProfile.school", "studentProfile.userAccount"})
    @Query("SELECT c FROM MessageConversation c WHERE c.school.id = :schoolId AND c.studentProfile.id = :studentProfileId AND " +
           "((c.participantOne.id = :actorId AND c.participantTwo.id = :recipientId) OR " +
           "(c.participantOne.id = :recipientId AND c.participantTwo.id = :actorId))")
    Optional<MessageConversation> findStudentContextConversation(@Param("schoolId") Long schoolId,
                                                                 @Param("studentProfileId") Long studentProfileId,
                                                                 @Param("actorId") Long actorId,
                                                                 @Param("recipientId") Long recipientId);

    @EntityGraph(attributePaths = {"school", "participantOne", "participantTwo", "studentProfile", "studentProfile.school", "studentProfile.userAccount"})
    @Query("SELECT c FROM MessageConversation c WHERE c.id = :id AND c.studentProfile.id = :studentProfileId " +
           "AND c.studentProfile.isActive = true AND c.studentProfile.userAccount.id = :studentAccountId " +
           "AND (c.participantOne.id = :studentAccountId OR c.participantTwo.id = :studentAccountId)")
    Optional<MessageConversation> findHighSchoolConversationForLinkedParent(@Param("id") Long id,
                                                                            @Param("studentProfileId") Long studentProfileId,
                                                                            @Param("studentAccountId") Long studentAccountId);

    @EntityGraph(attributePaths = {"school", "participantOne", "participantTwo", "studentProfile", "studentProfile.school", "studentProfile.userAccount"})
    @Query("SELECT c FROM MessageConversation c WHERE c.studentProfile.id = :studentProfileId " +
           "AND c.studentProfile.isActive = true AND c.studentProfile.userAccount.id = :studentAccountId " +
           "AND (c.participantOne.id = :studentAccountId OR c.participantTwo.id = :studentAccountId) " +
           "ORDER BY c.lastMessageAt DESC, c.id DESC")
    List<MessageConversation> findHighSchoolConversationsForLinkedParent(@Param("studentProfileId") Long studentProfileId,
                                                                          @Param("studentAccountId") Long studentAccountId);
}
