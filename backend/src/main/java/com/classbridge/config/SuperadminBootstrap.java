package com.classbridge.config;

import com.classbridge.domain.UserAccount;
import com.classbridge.domain.UserRole;
import com.classbridge.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class SuperadminBootstrap implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(SuperadminBootstrap.class);

    private final UserAccountRepository userAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final String bootstrapUsername;
    private final String bootstrapPassword;

    public SuperadminBootstrap(
            UserAccountRepository userAccountRepository,
            PasswordEncoder passwordEncoder,
            @Value("${BOOTSTRAP_SUPERADMIN_USERNAME:#{null}}") String bootstrapUsername,
            @Value("${BOOTSTRAP_SUPERADMIN_PASSWORD:#{null}}") String bootstrapPassword) {
        this.userAccountRepository = userAccountRepository;
        this.passwordEncoder = passwordEncoder;
        this.bootstrapUsername = bootstrapUsername;
        this.bootstrapPassword = bootstrapPassword;
    }

    @Override
    public void run(String... args) {
        if (userAccountRepository.existsByRole(UserRole.SUPERADMIN)) {
            logger.info("Superadmin account already exists. Skipping bootstrap process.");
            return;
        }

        if (bootstrapUsername == null || bootstrapUsername.trim().isEmpty() ||
            bootstrapPassword == null || bootstrapPassword.trim().isEmpty()) {
            logger.info("Superadmin bootstrap credentials are not configured or are blank. Skipping creation.");
            return;
        }

        
        UserAccount superadmin = new UserAccount();
        superadmin.setUsername(bootstrapUsername.trim());
        superadmin.setPasswordHash(passwordEncoder.encode(bootstrapPassword));
        superadmin.setRole(UserRole.SUPERADMIN);
        superadmin.setActive(true);
        
        userAccountRepository.save(superadmin);
        logger.info("Superadmin account successfully bootstrapped.");
    }
}
