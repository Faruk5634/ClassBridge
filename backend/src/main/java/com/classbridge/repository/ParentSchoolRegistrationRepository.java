package com.classbridge.repository;

import com.classbridge.domain.ParentSchoolRegistration;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ParentSchoolRegistrationRepository extends JpaRepository<ParentSchoolRegistration, Long> {
    List<ParentSchoolRegistration> findAllBySchoolId(Long schoolId);
    boolean existsBySchoolIdAndParentProfileIdAndIsActiveTrue(Long schoolId, Long parentProfileId);
    boolean existsBySchoolIdAndParentProfileId(Long schoolId, Long parentProfileId);
    boolean existsByParentProfileIdAndSchoolIdNot(Long parentProfileId, Long schoolId);

    @EntityGraph(attributePaths = {"parentProfile", "parentProfile.userAccount"})
    List<ParentSchoolRegistration> findBySchoolIdOrderByCreatedAtDesc(Long schoolId);
}
