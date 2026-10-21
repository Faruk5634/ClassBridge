package com.classbridge.service;

import com.classbridge.domain.ParentProfile;
import com.classbridge.domain.AccountAppearance;
import com.classbridge.domain.StaffProfile;
import com.classbridge.domain.StudentProfile;
import com.classbridge.domain.UserAccount;
import com.classbridge.dto.MyProfileResponse;
import com.classbridge.dto.AccountAppearanceResponse;
import com.classbridge.dto.UpdateAccountAppearanceRequest;
import com.classbridge.dto.UpdatePhoneNumberRequest;
import com.classbridge.exception.ResourceNotFoundException;
import com.classbridge.mapper.AccountProfileMapper;
import com.classbridge.repository.ParentProfileRepository;
import com.classbridge.repository.StaffProfileRepository;
import com.classbridge.repository.StudentProfileRepository;
import com.classbridge.repository.UserAccountRepository;
import com.classbridge.repository.AccountAppearanceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Base64;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AccountProfileService {

    private static final int MAX_AVATAR_BYTES = 2 * 1024 * 1024;
    private static final Set<String> ALLOWED_ANIMALS = Set.of(
            "LION_ADULT", "BEAR_ADULT", "KOALA_ADULT", "TURTLE_ADULT", "OWL_ADULT", "HIPPO_ADULT",
            "SNAKE_ADULT", "FOX_ADULT", "RABBIT_ADULT", "OTTER_ADULT", "CHEETAH_ADULT",
            "LION_STUDENT", "BEAR_STUDENT", "KOALA_STUDENT", "TURTLE_STUDENT", "OWL_STUDENT", "HIPPO_STUDENT",
            "SNAKE_STUDENT", "FOX_STUDENT", "RABBIT_STUDENT", "OTTER_STUDENT", "CHEETAH_STUDENT"
    );
    private static final Pattern IMAGE_DATA_URL = Pattern.compile("^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$");

    private final UserAccountRepository userAccountRepository;
    private final StaffProfileRepository staffProfileRepository;
    private final ParentProfileRepository parentProfileRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final AccountProfileMapper accountProfileMapper;
    private final AccountAppearanceRepository accountAppearanceRepository;

    public AccountProfileService(UserAccountRepository userAccountRepository,
                                 StaffProfileRepository staffProfileRepository,
                                 ParentProfileRepository parentProfileRepository,
                                 StudentProfileRepository studentProfileRepository,
                                 AccountProfileMapper accountProfileMapper,
                                 AccountAppearanceRepository accountAppearanceRepository) {
        this.userAccountRepository = userAccountRepository;
        this.staffProfileRepository = staffProfileRepository;
        this.parentProfileRepository = parentProfileRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.accountProfileMapper = accountProfileMapper;
        this.accountAppearanceRepository = accountAppearanceRepository;
    }

    @Transactional(readOnly = true)
    public MyProfileResponse getMyProfile(Long accountId) {
        UserAccount account = getActiveAccount(accountId);
        String firstName = null;
        String lastName = null;

        switch (account.getRole()) {
            case SCHOOL_ADMIN, SCHOOL_VICE_ADMIN, TEACHER -> {
                StaffProfile profile = staffProfileRepository.findByUserAccountId(accountId)
                        .orElseThrow(() -> new ResourceNotFoundException("Profile not found for the authenticated account."));
                firstName = profile.getFirstName();
                lastName = profile.getLastName();
            }
            case PARENT -> {
                ParentProfile profile = parentProfileRepository.findByUserAccountId(accountId)
                        .orElseThrow(() -> new ResourceNotFoundException("Profile not found for the authenticated account."));
                firstName = profile.getFirstName();
                lastName = profile.getLastName();
            }
            case STUDENT -> {
                StudentProfile profile = studentProfileRepository.findByUserAccountId(accountId)
                        .filter(StudentProfile::isActive)
                        .orElseThrow(() -> new ResourceNotFoundException("Profile not found for the authenticated account."));
                firstName = profile.getFirstName();
                lastName = profile.getLastName();
            }
            case SUPERADMIN -> { }
        }

        return accountProfileMapper.toResponse(account, firstName, lastName);
    }

    @Transactional
    public MyProfileResponse updatePhoneNumber(Long accountId, UpdatePhoneNumberRequest request) {
        UserAccount account = getActiveAccount(accountId);
        account.setPhoneNumber(request.getPhoneNumber().trim());
        UserAccount savedAccount = userAccountRepository.save(account);
        return getMyProfile(savedAccount.getId());
    }

    @Transactional(readOnly = true)
    public AccountAppearanceResponse getAppearance(Long accountId) {
        getActiveAccount(accountId);
        return accountAppearanceRepository.findById(accountId)
                .map(this::toAppearanceResponse)
                .orElseGet(() -> new AccountAppearanceResponse("INITIALS", null, null));
    }

    @Transactional
    public AccountAppearanceResponse updateAppearance(Long accountId, UpdateAccountAppearanceRequest request) {
        getActiveAccount(accountId);
        String avatarType = request.getAvatarType().toUpperCase();
        AccountAppearance appearance = accountAppearanceRepository.findById(accountId).orElseGet(() -> {
            AccountAppearance created = new AccountAppearance();
            created.setUserAccountId(accountId);
            return created;
        });

        switch (avatarType) {
            case "INITIALS" -> {
                appearance.setAvatarType("INITIALS");
                appearance.setAnimal(null);
                appearance.setImageDataUrl(null);
            }
            case "ANIMAL" -> {
                String animal = request.getAnimal() == null ? "" : request.getAnimal().toUpperCase();
                if (!ALLOWED_ANIMALS.contains(animal)) {
                    throw new IllegalArgumentException("Choose an available profile portrait.");
                }
                appearance.setAvatarType("ANIMAL");
                appearance.setAnimal(animal);
                appearance.setImageDataUrl(null);
            }
            case "PHOTO" -> {
                String imageDataUrl = request.getImageDataUrl();
                Matcher matcher = imageDataUrl == null ? null : IMAGE_DATA_URL.matcher(imageDataUrl);
                if (matcher == null || !matcher.matches()) {
                    throw new IllegalArgumentException("Choose a JPG, PNG or WebP profile photo.");
                }
                try {
                    byte[] imageBytes = Base64.getDecoder().decode(matcher.group(2));
                    if (imageBytes.length == 0 || imageBytes.length > MAX_AVATAR_BYTES) {
                        throw new IllegalArgumentException("Profile photos must be 2 MB or smaller.");
                    }
                    if (!matchesImageSignature(matcher.group(1), imageBytes)) {
                        throw new IllegalArgumentException("Choose a valid JPG, PNG or WebP profile photo.");
                    }
                } catch (IllegalArgumentException exception) {
                    if (exception.getMessage() != null && exception.getMessage().startsWith("Profile photos")) throw exception;
                    throw new IllegalArgumentException("Choose a valid JPG, PNG or WebP profile photo.");
                }
                appearance.setAvatarType("PHOTO");
                appearance.setAnimal(null);
                appearance.setImageDataUrl(imageDataUrl);
            }
            default -> throw new IllegalArgumentException("Choose a valid profile avatar.");
        }

        return toAppearanceResponse(accountAppearanceRepository.save(appearance));
    }

    private AccountAppearanceResponse toAppearanceResponse(AccountAppearance appearance) {
        return new AccountAppearanceResponse(appearance.getAvatarType(), appearance.getAnimal(), appearance.getImageDataUrl());
    }

    private boolean matchesImageSignature(String contentType, byte[] imageBytes) {
        return switch (contentType) {
            case "png" -> imageBytes.length >= 8
                    && (imageBytes[0] & 0xff) == 0x89 && imageBytes[1] == 0x50 && imageBytes[2] == 0x4e
                    && imageBytes[3] == 0x47 && imageBytes[4] == 0x0d && imageBytes[5] == 0x0a
                    && imageBytes[6] == 0x1a && imageBytes[7] == 0x0a;
            case "jpeg" -> imageBytes.length >= 3 && (imageBytes[0] & 0xff) == 0xff
                    && (imageBytes[1] & 0xff) == 0xd8 && (imageBytes[2] & 0xff) == 0xff;
            case "webp" -> imageBytes.length >= 12 && imageBytes[0] == 'R' && imageBytes[1] == 'I'
                    && imageBytes[2] == 'F' && imageBytes[3] == 'F' && imageBytes[8] == 'W'
                    && imageBytes[9] == 'E' && imageBytes[10] == 'B' && imageBytes[11] == 'P';
            default -> false;
        };
    }

    private UserAccount getActiveAccount(Long accountId) {
        return userAccountRepository.findById(accountId)
                .filter(UserAccount::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found with id: " + accountId));
    }
}
