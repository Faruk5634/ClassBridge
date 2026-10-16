package com.classbridge.security;

import com.classbridge.domain.UserRole;
import com.classbridge.repository.UserAccountRepository;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
public class ActiveUserAccountTokenValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2Error INVALID_TOKEN_ERROR = new OAuth2Error(
            OAuth2ErrorCodes.INVALID_TOKEN,
            "The token is invalid, expired, or belongs to an inactive account.",
            null
    );

    private final UserAccountRepository userAccountRepository;

    public ActiveUserAccountTokenValidator(UserAccountRepository userAccountRepository) {
        this.userAccountRepository = userAccountRepository;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        String subject = jwt.getSubject();
        if (subject == null) {
            return OAuth2TokenValidatorResult.failure(INVALID_TOKEN_ERROR);
        }

        Long accountId;
        try {
            accountId = Long.parseLong(subject);
        } catch (NumberFormatException e) {
            return OAuth2TokenValidatorResult.failure(INVALID_TOKEN_ERROR);
        }

        String roleClaim = jwt.getClaimAsString("role");
        if (roleClaim == null) {
            return OAuth2TokenValidatorResult.failure(INVALID_TOKEN_ERROR);
        }

        UserRole role;
        try {
            role = UserRole.valueOf(roleClaim);
        } catch (IllegalArgumentException e) {
            return OAuth2TokenValidatorResult.failure(INVALID_TOKEN_ERROR);
        }

        Long credentialVersionClaim = jwt.getClaim("credential_version");
        long credentialVersion = credentialVersionClaim == null ? 0L : credentialVersionClaim;

        boolean exists = userAccountRepository.existsByIdAndIsActiveAndRoleAndCredentialVersion(
                accountId, true, role, credentialVersion);
        if (!exists) {
            return OAuth2TokenValidatorResult.failure(INVALID_TOKEN_ERROR);
        }

        return OAuth2TokenValidatorResult.success();
    }
}
