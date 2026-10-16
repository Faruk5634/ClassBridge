package com.classbridge.repository;

import com.classbridge.domain.AnnouncementClassroom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnnouncementClassroomRepository extends JpaRepository<AnnouncementClassroom, Long> {

    List<AnnouncementClassroom> findByAnnouncementId(Long announcementId);

    List<AnnouncementClassroom> findByClassroomId(Long classroomId);
}
