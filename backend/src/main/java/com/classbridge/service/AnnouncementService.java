package com.classbridge.service;

import com.classbridge.domain.Announcement;
import com.classbridge.domain.AnnouncementAttachment;
import com.classbridge.domain.Classroom;
import com.classbridge.domain.ParentProfile;
import com.classbridge.domain.School;
import com.classbridge.domain.SchoolMembership;
import com.classbridge.domain.StaffProfile;
import com.classbridge.domain.StudentProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.dto.AnnouncementAttachmentResponse;
import com.classbridge.dto.AnnouncementResponse;
import com.classbridge.dto.AttachmentDownload;
import com.classbridge.dto.CreateAnnouncementRequest;
import com.classbridge.exception.ForbiddenOperationException;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.mapper.AnnouncementMapper;
import com.classbridge.repository.AnnouncementAttachmentRepository;
import com.classbridge.repository.AnnouncementRepository;
import com.classbridge.repository.ClassroomRepository;
import com.classbridge.repository.ParentProfileRepository;
import com.classbridge.repository.SchoolMembershipRepository;
import com.classbridge.repository.StaffProfileRepository;
import com.classbridge.repository.StudentProfileRepository;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AnnouncementService {

    private final AnnouncementRepository announcementRepository;
    private final AnnouncementAttachmentRepository announcementAttachmentRepository;
    private final ClassroomRepository classroomRepository;
    private final SchoolMembershipRepository schoolMembershipRepository;
    private final StaffProfileRepository staffProfileRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final ParentProfileRepository parentProfileRepository;
    private final AnnouncementMapper announcementMapper;
    private final AttachmentStorageService attachmentStorageService;
    private final AttachmentValidator attachmentValidator;

    public AnnouncementService(AnnouncementRepository announcementRepository,
                               AnnouncementAttachmentRepository announcementAttachmentRepository,
                               ClassroomRepository classroomRepository,
                               SchoolMembershipRepository schoolMembershipRepository,
                               StaffProfileRepository staffProfileRepository,
                               StudentProfileRepository studentProfileRepository,
                               ParentProfileRepository parentProfileRepository,
                               AnnouncementMapper announcementMapper,
                               AttachmentStorageService attachmentStorageService,
                               AttachmentValidator attachmentValidator) {
        this.announcementRepository = announcementRepository;
        this.announcementAttachmentRepository = announcementAttachmentRepository;
        this.classroomRepository = classroomRepository;
        this.schoolMembershipRepository = schoolMembershipRepository;
        this.staffProfileRepository = staffProfileRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.parentProfileRepository = parentProfileRepository;
        this.announcementMapper = announcementMapper;
        this.attachmentStorageService = attachmentStorageService;
        this.attachmentValidator = attachmentValidator;
    }

    @Transactional
    public AnnouncementResponse createAnnouncement(Long authorAccountId, CreateAnnouncementRequest request) {
        SchoolMembership membership = schoolMembershipRepository.findByUserAccountId(authorAccountId)
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated user is not associated with any school."));

        School school = membership.getSchool();
        UserAccount authorAccount = membership.getUserAccount();

        if (authorAccount.getRole() != UserRole.SCHOOL_ADMIN
                && authorAccount.getRole() != UserRole.SCHOOL_VICE_ADMIN
                && authorAccount.getRole() != UserRole.TEACHER) {
            throw new ForbiddenOperationException("User is not authorized to create announcements.");
        }

        List<Classroom> classrooms = validateAndGetPermittedClassrooms(authorAccount, school, request.getTargetClassroomIds());

        Announcement announcement = announcementMapper.toEntity(request, school, authorAccount, classrooms);
        Announcement saved = announcementRepository.save(announcement);

        String authorDisplayName = getAuthorDisplayName(authorAccount);
        return announcementMapper.toResponse(saved, authorDisplayName, Collections.emptyList());
    }

    @Transactional
    public AnnouncementAttachmentResponse addAttachment(Long actorAccountId, Long announcementId, MultipartFile file) {
        SchoolMembership membership = schoolMembershipRepository.findByUserAccountId(actorAccountId)
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated user is not associated with any school."));

        School school = membership.getSchool();
        UserAccount actorAccount = membership.getUserAccount();

        if (actorAccount.getRole() != UserRole.SCHOOL_ADMIN
                && actorAccount.getRole() != UserRole.SCHOOL_VICE_ADMIN
                && actorAccount.getRole() != UserRole.TEACHER) {
            throw new ForbiddenOperationException("User is not authorized to attach files to announcements.");
        }

        Announcement announcement = announcementRepository.findByIdAndSchoolId(announcementId, school.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Announcement not found with id: " + announcementId));

        if (actorAccount.getRole() == UserRole.TEACHER) {
            if (!announcement.getAuthorAccount().getId().equals(actorAccountId)) {
                throw new ForbiddenOperationException("Teachers may only attach files to their own announcements.");
            }
        }

        AttachmentValidator.ValidatedAttachment validated = attachmentValidator.validate(file);

        String storageKey;
        try (InputStream is = file.getInputStream()) {
            storageKey = attachmentStorageService.store(is);
        } catch (IOException e) {
            throw new RuntimeException("Failed to read attachment stream.", e);
        }

        try {
            AnnouncementAttachment attachment = new AnnouncementAttachment(
                    announcement,
                    storageKey,
                    validated.getDisplayFilename(),
                    validated.getCanonicalContentType(),
                    validated.getFileSize()
            );
            AnnouncementAttachment saved = announcementAttachmentRepository.save(attachment);

            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCompletion(int status) {
                        if (status != TransactionSynchronization.STATUS_COMMITTED) {
                            attachmentStorageService.deleteFile(storageKey);
                        }
                    }
                });
            }

            return announcementMapper.toAttachmentResponse(saved);
        } catch (Exception ex) {
            attachmentStorageService.deleteFile(storageKey);
            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public List<AnnouncementResponse> getSchoolAnnouncements(Long staffAccountId, Long classroomId) {
        SchoolMembership membership = schoolMembershipRepository.findByUserAccountId(staffAccountId)
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated staff member is not associated with any school."));

        Long schoolId = membership.getSchool().getId();

        List<Announcement> announcements;
        if (classroomId != null) {
            classroomRepository.findByIdAndSchoolId(classroomId, schoolId)
                    .orElseThrow(() -> new ResourceNotFoundException("Classroom not found with id: " + classroomId));
            announcements = announcementRepository.findBySchoolIdAndClassroomIdOrderByCreatedAtDesc(schoolId, classroomId);
        } else {
            announcements = announcementRepository.findBySchoolIdOrderByCreatedAtDesc(schoolId);
        }

        return mapAnnouncementsToResponses(announcements);
    }

    @Transactional(readOnly = true)
    public AnnouncementResponse getSchoolAnnouncement(Long staffAccountId, Long announcementId) {
        SchoolMembership membership = schoolMembershipRepository.findByUserAccountId(staffAccountId)
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated staff member is not associated with any school."));

        Long schoolId = membership.getSchool().getId();
        Announcement announcement = announcementRepository.findByIdAndSchoolId(announcementId, schoolId)
                .orElseThrow(() -> new ResourceNotFoundException("Announcement not found with id: " + announcementId));

        String authorDisplayName = getAuthorDisplayName(announcement.getAuthorAccount());
        List<AnnouncementAttachment> attachments = announcementAttachmentRepository.findByAnnouncementIdOrderByCreatedAtAscIdAsc(announcement.getId());
        return announcementMapper.toResponse(announcement, authorDisplayName, attachments);
    }

    @Transactional(readOnly = true)
    public AttachmentDownload downloadSchoolAttachment(Long staffAccountId, Long announcementId, Long attachmentId) {
        SchoolMembership membership = schoolMembershipRepository.findByUserAccountId(staffAccountId)
                .orElseThrow(() -> new ForbiddenOperationException("Authenticated staff member is not associated with any school."));

        Long schoolId = membership.getSchool().getId();
        Announcement announcement = announcementRepository.findByIdAndSchoolId(announcementId, schoolId)
                .orElseThrow(() -> new ResourceNotFoundException("Announcement not found with id: " + announcementId));

        AnnouncementAttachment attachment = announcementAttachmentRepository.findByIdAndAnnouncementId(attachmentId, announcement.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found with id: " + attachmentId));

        Resource resource = attachmentStorageService.loadAsResource(attachment.getStorageKey());
        return new AttachmentDownload(resource, attachment.getDisplayFilename(), attachment.getContentType(), attachment.getFileSize());
    }

    @Transactional(readOnly = true)
    public List<AnnouncementResponse> getStudentAnnouncements(Long studentAccountId) {
        StudentProfile studentProfile = studentProfileRepository.findByUserAccountId(studentAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found for authenticated account."));

        if (!studentProfile.isActive()) {
            throw new ForbiddenOperationException("Archived student profiles cannot access announcements.");
        }

        Long classroomId = studentProfile.getClassroom().getId();
        Long schoolId = studentProfile.getSchool().getId();

        List<Announcement> announcements = announcementRepository.findBySchoolIdAndClassroomIdOrderByCreatedAtDesc(schoolId, classroomId);
        return mapAnnouncementsToResponses(announcements);
    }

    @Transactional(readOnly = true)
    public AnnouncementResponse getStudentAnnouncement(Long studentAccountId, Long announcementId) {
        StudentProfile studentProfile = studentProfileRepository.findByUserAccountId(studentAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found for authenticated account."));

        if (!studentProfile.isActive()) {
            throw new ForbiddenOperationException("Archived student profiles cannot access announcements.");
        }

        Long classroomId = studentProfile.getClassroom().getId();
        Long schoolId = studentProfile.getSchool().getId();

        Announcement announcement = announcementRepository.findByIdAndSchoolId(announcementId, schoolId)
                .orElseThrow(() -> new ResourceNotFoundException("Announcement not found with id: " + announcementId));

        boolean targetsClassroom = announcement.getTargetClassrooms().stream()
                .anyMatch(tc -> tc.getClassroom().getId().equals(classroomId));
        if (!targetsClassroom) {
            throw new ResourceNotFoundException("Announcement not found with id: " + announcementId);
        }

        String authorDisplayName = getAuthorDisplayName(announcement.getAuthorAccount());
        List<AnnouncementAttachment> attachments = announcementAttachmentRepository.findByAnnouncementIdOrderByCreatedAtAscIdAsc(announcement.getId());
        return announcementMapper.toResponse(announcement, authorDisplayName, attachments);
    }

    @Transactional(readOnly = true)
    public AttachmentDownload downloadStudentAttachment(Long studentAccountId, Long announcementId, Long attachmentId) {
        StudentProfile studentProfile = studentProfileRepository.findByUserAccountId(studentAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found for authenticated account."));

        if (!studentProfile.isActive()) {
            throw new ForbiddenOperationException("Archived student profiles cannot access announcements.");
        }

        Long classroomId = studentProfile.getClassroom().getId();
        Long schoolId = studentProfile.getSchool().getId();

        Announcement announcement = announcementRepository.findByIdAndSchoolId(announcementId, schoolId)
                .orElseThrow(() -> new ResourceNotFoundException("Announcement not found with id: " + announcementId));

        boolean targetsClassroom = announcement.getTargetClassrooms().stream()
                .anyMatch(tc -> tc.getClassroom().getId().equals(classroomId));
        if (!targetsClassroom) {
            throw new ResourceNotFoundException("Announcement not found with id: " + announcementId);
        }

        AnnouncementAttachment attachment = announcementAttachmentRepository.findByIdAndAnnouncementId(attachmentId, announcement.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found with id: " + attachmentId));

        Resource resource = attachmentStorageService.loadAsResource(attachment.getStorageKey());
        return new AttachmentDownload(resource, attachment.getDisplayFilename(), attachment.getContentType(), attachment.getFileSize());
    }

    @Transactional(readOnly = true)
    public List<AnnouncementResponse> getParentAnnouncements(Long parentAccountId, Long studentProfileId) {
        ParentProfile parentProfile = parentProfileRepository.findByUserAccountId(parentAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Parent profile not found for authenticated account."));

        StudentProfile studentProfile = studentProfileRepository.findActiveByIdAndParentProfileId(studentProfileId, parentProfile.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Active linked student profile not found with id: " + studentProfileId));

        Long classroomId = studentProfile.getClassroom().getId();
        Long schoolId = studentProfile.getSchool().getId();

        List<Announcement> announcements = announcementRepository.findBySchoolIdAndClassroomIdOrderByCreatedAtDesc(schoolId, classroomId);
        return mapAnnouncementsToResponses(announcements);
    }

    @Transactional(readOnly = true)
    public AnnouncementResponse getParentAnnouncement(Long parentAccountId, Long studentProfileId, Long announcementId) {
        ParentProfile parentProfile = parentProfileRepository.findByUserAccountId(parentAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Parent profile not found for authenticated account."));

        StudentProfile studentProfile = studentProfileRepository.findActiveByIdAndParentProfileId(studentProfileId, parentProfile.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Active linked student profile not found with id: " + studentProfileId));

        Long classroomId = studentProfile.getClassroom().getId();
        Long schoolId = studentProfile.getSchool().getId();

        Announcement announcement = announcementRepository.findByIdAndSchoolId(announcementId, schoolId)
                .orElseThrow(() -> new ResourceNotFoundException("Announcement not found with id: " + announcementId));

        boolean targetsClassroom = announcement.getTargetClassrooms().stream()
                .anyMatch(tc -> tc.getClassroom().getId().equals(classroomId));
        if (!targetsClassroom) {
            throw new ResourceNotFoundException("Announcement not found with id: " + announcementId);
        }

        String authorDisplayName = getAuthorDisplayName(announcement.getAuthorAccount());
        List<AnnouncementAttachment> attachments = announcementAttachmentRepository.findByAnnouncementIdOrderByCreatedAtAscIdAsc(announcement.getId());
        return announcementMapper.toResponse(announcement, authorDisplayName, attachments);
    }

    @Transactional(readOnly = true)
    public AttachmentDownload downloadParentAttachment(Long parentAccountId, Long studentProfileId, Long announcementId, Long attachmentId) {
        ParentProfile parentProfile = parentProfileRepository.findByUserAccountId(parentAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Parent profile not found for authenticated account."));

        StudentProfile studentProfile = studentProfileRepository.findActiveByIdAndParentProfileId(studentProfileId, parentProfile.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Active linked student profile not found with id: " + studentProfileId));

        Long classroomId = studentProfile.getClassroom().getId();
        Long schoolId = studentProfile.getSchool().getId();

        Announcement announcement = announcementRepository.findByIdAndSchoolId(announcementId, schoolId)
                .orElseThrow(() -> new ResourceNotFoundException("Announcement not found with id: " + announcementId));

        boolean targetsClassroom = announcement.getTargetClassrooms().stream()
                .anyMatch(tc -> tc.getClassroom().getId().equals(classroomId));
        if (!targetsClassroom) {
            throw new ResourceNotFoundException("Announcement not found with id: " + announcementId);
        }

        AnnouncementAttachment attachment = announcementAttachmentRepository.findByIdAndAnnouncementId(attachmentId, announcement.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Attachment not found with id: " + attachmentId));

        Resource resource = attachmentStorageService.loadAsResource(attachment.getStorageKey());
        return new AttachmentDownload(resource, attachment.getDisplayFilename(), attachment.getContentType(), attachment.getFileSize());
    }

    private List<Classroom> validateAndGetPermittedClassrooms(UserAccount author, School school, List<Long> targetClassroomIds) {
        if (targetClassroomIds == null || targetClassroomIds.isEmpty()) {
            throw new IllegalArgumentException("At least one target classroom is required.");
        }

        List<Long> distinctIds = targetClassroomIds.stream().distinct().toList();
        List<Classroom> classrooms = new ArrayList<>();

        for (Long classroomId : distinctIds) {
            if (classroomId == null) {
                throw new IllegalArgumentException("Target classroom ID must not be null.");
            }
            Classroom classroom = classroomRepository.findByIdAndSchoolId(classroomId, school.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Target classroom not found in school with id: " + classroomId));

            // The caller's school is derived from their SchoolMembership above.
            // Every requested classroom is resolved by both ID and that school ID,
            // so teachers may target any classroom in their own school but cannot
            // target classrooms belonging to another school.
            classrooms.add(classroom);
        }
        return classrooms;
    }

    private String getAuthorDisplayName(UserAccount authorAccount) {
        return staffProfileRepository.findByUserAccountId(authorAccount.getId())
                .map(sp -> sp.getFirstName() + " " + sp.getLastName())
                .orElse(authorAccount.getUsername());
    }

    private List<AnnouncementResponse> mapAnnouncementsToResponses(List<Announcement> announcements) {
        if (announcements.isEmpty()) {
            return Collections.emptyList();
        }

        Set<Long> authorIds = announcements.stream()
                .map(a -> a.getAuthorAccount().getId())
                .collect(Collectors.toSet());

        Map<Long, String> authorDisplayNames = staffProfileRepository.findByUserAccountIdIn(authorIds).stream()
                .collect(Collectors.toMap(
                        sp -> sp.getUserAccount().getId(),
                        sp -> sp.getFirstName() + " " + sp.getLastName(),
                        (existing, replacement) -> existing
                ));

        List<Long> announcementIds = announcements.stream().map(Announcement::getId).toList();
        List<AnnouncementAttachment> allAttachments = announcementAttachmentRepository.findByAnnouncementIdInOrderByCreatedAtAscIdAsc(announcementIds);
        Map<Long, List<AnnouncementAttachment>> attachmentsByAnnouncementId = allAttachments.stream()
                .collect(Collectors.groupingBy(a -> a.getAnnouncement().getId()));

        return announcements.stream()
                .map(a -> {
                    String displayName = authorDisplayNames.getOrDefault(
                            a.getAuthorAccount().getId(),
                            a.getAuthorAccount().getUsername()
                    );
                    List<AnnouncementAttachment> attachments = attachmentsByAnnouncementId.getOrDefault(a.getId(), Collections.emptyList());
                    return announcementMapper.toResponse(a, displayName, attachments);
                })
                .collect(Collectors.toList());
    }
}
