package com.classbridge.service;

import com.classbridge.domain.School;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.repository.AnnouncementRepository;
import com.classbridge.repository.ClassroomRepository;
import com.classbridge.repository.MessageConversationRepository;
import com.classbridge.repository.ParentSchoolRegistrationRepository;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.StudentProfileRepository;
import com.classbridge.repository.TeachingAssignmentRepository;
import com.classbridge.repository.UserAccountRepository;
import com.classbridge.dto.SchoolRequest;
import com.classbridge.dto.SchoolResponse;
import com.classbridge.mapper.SchoolMapper;
import com.classbridge.repository.SchoolRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class SchoolService {

    private final SchoolRepository schoolRepository;
    private final SchoolMapper schoolMapper;
    private final SchoolMembershipRepository membershipRepository;
    private final StudentProfileRepository studentRepository;
    private final ClassroomRepository classroomRepository;
    private final TeachingAssignmentRepository teachingAssignmentRepository;
    private final ParentSchoolRegistrationRepository parentRegistrationRepository;
    private final AnnouncementRepository announcementRepository;
    private final MessageConversationRepository conversationRepository;
    private final UserAccountRepository userAccountRepository;

    public SchoolService(SchoolRepository schoolRepository, SchoolMapper schoolMapper,
                         SchoolMembershipRepository membershipRepository,
                         StudentProfileRepository studentRepository,
                         ClassroomRepository classroomRepository,
                         TeachingAssignmentRepository teachingAssignmentRepository,
                         ParentSchoolRegistrationRepository parentRegistrationRepository,
                         AnnouncementRepository announcementRepository,
                         MessageConversationRepository conversationRepository,
                         UserAccountRepository userAccountRepository) {
        this.schoolRepository = schoolRepository;
        this.schoolMapper = schoolMapper;
        this.membershipRepository = membershipRepository;
        this.studentRepository = studentRepository;
        this.classroomRepository = classroomRepository;
        this.teachingAssignmentRepository = teachingAssignmentRepository;
        this.parentRegistrationRepository = parentRegistrationRepository;
        this.announcementRepository = announcementRepository;
        this.conversationRepository = conversationRepository;
        this.userAccountRepository = userAccountRepository;
    }

    @Transactional
    public SchoolResponse createSchool(SchoolRequest request) {
        School school = schoolMapper.toEntity(request);
        School savedSchool = schoolRepository.save(school);
        return schoolMapper.toResponse(savedSchool);
    }

    @Transactional(readOnly = true)
    public List<SchoolResponse> getSchools() {
        return getSchools(null);
    }

    @Transactional(readOnly = true)
    public List<SchoolResponse> getSchools(Boolean active) {
        return schoolRepository.findAll().stream()
                .filter(school -> active == null || school.isActive() == active)
                .map(schoolMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Optional<SchoolResponse> getSchool(Long id) {
        return schoolRepository.findById(id)
                .map(schoolMapper::toResponse);
    }

    @Transactional
    public Optional<SchoolResponse> updateSchool(Long id, SchoolRequest request) {
        return schoolRepository.findById(id)
                .map(school -> {
                    if (!school.isActive()) {
                        throw new IllegalStateException("Archived schools are read-only until restored.");
                    }
                    schoolMapper.updateEntity(school, request);
                    School updatedSchool = schoolRepository.save(school);
                    return schoolMapper.toResponse(updatedSchool);
                });
    }

    @Transactional
    public Optional<SchoolResponse> archiveSchool(Long id) {
        return schoolRepository.findById(id)
                .map(school -> {
                    if (!school.isActive()) return schoolMapper.toResponse(school);
                    school.setActive(false);
                    membershipRepository.findAllBySchoolId(id).forEach(membership -> {
                        if (membership.isActive()) {
                            membership.setActive(false);
                            membership.setArchivedBySchool(true);
                        }
                        deactivateForSchool(membership.getUserAccount());
                    });
                    studentRepository.findAllBySchoolId(id).forEach(student -> {
                        if (student.isActive()) {
                            student.setActive(false);
                            student.setArchivedBySchool(true);
                        }
                        if (student.getUserAccount() != null) deactivateForSchool(student.getUserAccount());
                    });
                    classroomRepository.findAllBySchoolId(id).forEach(classroom -> {
                        if (classroom.isActive()) {
                            classroom.setActive(false);
                            classroom.setArchivedBySchool(true);
                        }
                    });
                    teachingAssignmentRepository.findAllByClassroomSchoolId(id).forEach(assignment -> {
                        if (assignment.isActive()) {
                            assignment.setActive(false);
                            assignment.setArchivedBySchool(true);
                        }
                    });
                    var registrations = parentRegistrationRepository.findAllBySchoolId(id);
                    registrations.forEach(registration -> {
                        if (registration.isActive()) {
                            registration.setActive(false);
                            registration.setArchivedBySchool(true);
                        }
                    });
                    announcementRepository.findAllBySchoolId(id).forEach(announcement -> {
                        if (announcement.isActive()) {
                            announcement.setActive(false);
                            announcement.setArchivedBySchool(true);
                        }
                    });
                    conversationRepository.findAllBySchoolId(id).forEach(conversation -> {
                        if (conversation.isActive()) {
                            conversation.setActive(false);
                            conversation.setArchivedBySchool(true);
                        }
                    });
                    return schoolMapper.toResponse(schoolRepository.save(school));
                });
    }

    @Transactional
    public Optional<SchoolResponse> restoreSchool(Long id) {
        return schoolRepository.findById(id)
                .map(school -> {
                    if (school.isActive()) return schoolMapper.toResponse(school);
                    school.setActive(true);
                    membershipRepository.findAllBySchoolId(id).forEach(membership -> {
                        if (membership.isArchivedBySchool()) {
                            membership.setActive(true);
                            membership.setArchivedBySchool(false);
                        }
                        restoreForSchool(membership.getUserAccount());
                    });
                    studentRepository.findAllBySchoolId(id).forEach(student -> {
                        if (student.isArchivedBySchool()) {
                            student.setActive(true);
                            student.setArchivedBySchool(false);
                        }
                        if (student.getUserAccount() != null) restoreForSchool(student.getUserAccount());
                    });
                    classroomRepository.findAllBySchoolId(id).forEach(classroom -> {
                        if (classroom.isArchivedBySchool()) {
                            classroom.setActive(true);
                            classroom.setArchivedBySchool(false);
                        }
                    });
                    teachingAssignmentRepository.findAllByClassroomSchoolId(id).forEach(assignment -> {
                        if (assignment.isArchivedBySchool()) {
                            assignment.setActive(true);
                            assignment.setArchivedBySchool(false);
                        }
                    });
                    parentRegistrationRepository.findAllBySchoolId(id).forEach(registration -> {
                        if (registration.isArchivedBySchool()) {
                            registration.setActive(true);
                            registration.setArchivedBySchool(false);
                        }
                    });
                    announcementRepository.findAllBySchoolId(id).forEach(announcement -> {
                        if (announcement.isArchivedBySchool()) {
                            announcement.setActive(true);
                            announcement.setArchivedBySchool(false);
                        }
                    });
                    conversationRepository.findAllBySchoolId(id).forEach(conversation -> {
                        if (conversation.isArchivedBySchool()) {
                            conversation.setActive(true);
                            conversation.setArchivedBySchool(false);
                        }
                    });
                    return schoolMapper.toResponse(schoolRepository.save(school));
                });
    }

    private void deactivateForSchool(UserAccount account) {
        if (account == null || account.getRole() == UserRole.SUPERADMIN || !account.isActive()) return;
        account.setActive(false);
        account.setArchivedBySchool(true);
        account.setCredentialVersion(account.getCredentialVersion() + 1);
        userAccountRepository.save(account);
    }

    private void restoreForSchool(UserAccount account) {
        if (account == null || !account.isArchivedBySchool()) return;
        account.setActive(true);
        account.setArchivedBySchool(false);
        account.setCredentialVersion(account.getCredentialVersion() + 1);
        userAccountRepository.save(account);
    }
}
