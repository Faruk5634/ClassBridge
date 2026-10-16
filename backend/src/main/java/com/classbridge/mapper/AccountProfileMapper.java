package com.classbridge.mapper;

import com.classbridge.domain.UserAccount;
import com.classbridge.dto.MyProfileResponse;
import org.springframework.stereotype.Component;

@Component
public class AccountProfileMapper {

    public MyProfileResponse toResponse(UserAccount account, String firstName, String lastName) {
        return new MyProfileResponse(
                account.getId(),
                account.getUsername(),
                account.getRole(),
                firstName,
                lastName,
                account.getEmail(),
                account.isEmailVerified(),
                account.getPhoneNumber());
    }
}
