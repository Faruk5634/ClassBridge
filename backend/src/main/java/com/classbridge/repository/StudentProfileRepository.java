package com.classbridge.repository;

import com.classbridge.domain.StudentProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentProfileRepository extends JpaRepository<StudentProfile, Long> {

    boolean existsBySchoolIdAndSchoolNumber(Long schoolId, String schoolNumber);

    Optional<StudentProfile> findBySchoolIdAndSchoolNumber(Long schoolId, String schoolNumber);

    Optional<StudentProfile> findByUserAccountId(Long userAccountId);

    List<StudentProfile> findByClassroomId(Long classroomId);

    List<StudentProfile> findByParentProfileId(Long parentProfileId);
}
