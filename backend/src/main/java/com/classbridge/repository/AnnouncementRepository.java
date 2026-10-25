package com.classbridge.repository;

import com.classbridge.domain.Announcement;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {

    @EntityGraph(attributePaths = {"targetClassrooms", "targetClassrooms.classroom", "authorAccount"})
    @Query("SELECT DISTINCT a FROM Announcement a " +
           "WHERE a.school.id = :schoolId " +
           "ORDER BY a.createdAt DESC, a.id DESC")
    List<Announcement> findBySchoolIdOrderByCreatedAtDesc(@Param("schoolId") Long schoolId);

    @EntityGraph(attributePaths = {"targetClassrooms", "targetClassrooms.classroom", "authorAccount"})
    @Query("SELECT DISTINCT a FROM Announcement a " +
           "WHERE a.school.id = :schoolId AND a.authorAccount.id = :authorAccountId " +
           "ORDER BY a.createdAt DESC, a.id DESC")
    List<Announcement> findBySchoolIdAndAuthorAccountIdOrderByCreatedAtDesc(@Param("schoolId") Long schoolId,
                                                                            @Param("authorAccountId") Long authorAccountId);

    @EntityGraph(attributePaths = {"targetClassrooms", "targetClassrooms.classroom", "authorAccount"})
    @Query("SELECT DISTINCT a FROM Announcement a " +
           "JOIN a.targetClassrooms tc " +
           "WHERE a.school.id = :schoolId AND tc.classroom.id = :classroomId " +
           "ORDER BY a.createdAt DESC, a.id DESC")
    List<Announcement> findBySchoolIdAndClassroomIdOrderByCreatedAtDesc(@Param("schoolId") Long schoolId,
                                                                        @Param("classroomId") Long classroomId);

    @EntityGraph(attributePaths = {"targetClassrooms", "targetClassrooms.classroom", "authorAccount"})
    @Query("SELECT a FROM Announcement a WHERE a.id = :id AND a.school.id = :schoolId")
    Optional<Announcement> findByIdAndSchoolId(@Param("id") Long id, @Param("schoolId") Long schoolId);
}
