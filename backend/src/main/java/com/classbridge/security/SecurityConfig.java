package com.classbridge.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.util.StringUtils;

import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${JWT_SECRET:#{null}}")
    private String jwtSecret;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, ForcedPasswordChangeFilter forcedPasswordChangeFilter) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.POST,
                    "/api/auth/password-reset/request",
                    "/api/auth/password-reset/confirm").permitAll()
                .requestMatchers("/api/superadmin/**").hasRole("SUPERADMIN")
                .requestMatchers("/api/school-admin/**").hasAnyRole("SCHOOL_ADMIN", "SCHOOL_VICE_ADMIN")
                .requestMatchers("/api/announcements", "/api/announcements/**").hasAnyRole("SCHOOL_ADMIN", "SCHOOL_VICE_ADMIN", "TEACHER")
                .requestMatchers("/api/teacher/**").hasRole("TEACHER")
                .requestMatchers("/api/parent/**").hasRole("PARENT")
                .requestMatchers("/api/student/**").hasRole("STUDENT")
                .requestMatchers("/api/messages/**").authenticated()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
            )
            .addFilterAfter(forcedPasswordChangeFilter, BearerTokenAuthenticationFilter.class);

        return http.build();
    }

    private byte[] getSecretKeyBytes() {
        if (!StringUtils.hasText(jwtSecret)) {
            throw new IllegalStateException("JWT_SECRET environment variable is missing or blank.");
        }
        byte[] keyBytes;
        try {
            keyBytes = Base64.getDecoder().decode(jwtSecret);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("JWT_SECRET is not a valid Base64 string.", e);
        }
        if (keyBytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 bytes long after Base64 decoding.");
        }
        return keyBytes;
    }

    @Bean
    public JwtDecoder jwtDecoder(ActiveUserAccountTokenValidator activeUserAccountTokenValidator) {
        byte[] keyBytes = getSecretKeyBytes();
        SecretKeySpec secretKey = new SecretKeySpec(keyBytes, "HmacSHA256");
        NimbusJwtDecoder jwtDecoder = NimbusJwtDecoder.withSecretKey(secretKey).macAlgorithm(MacAlgorithm.HS256).build();

        OAuth2TokenValidator<Jwt> withIssuer = JwtValidators.createDefaultWithIssuer("classbridge-api");
        OAuth2TokenValidator<Jwt> delegatingValidator = new DelegatingOAuth2TokenValidator<>(withIssuer, activeUserAccountTokenValidator);
        jwtDecoder.setJwtValidator(delegatingValidator);

        return jwtDecoder;
    }

    @Bean
    public JwtEncoder jwtEncoder() {
        byte[] keyBytes = getSecretKeyBytes();
        JWKSource<SecurityContext> immutableSecret = new ImmutableSecret<>(keyBytes);
        return new NimbusJwtEncoder(immutableSecret);
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter grantedAuthoritiesConverter = new JwtGrantedAuthoritiesConverter();
        grantedAuthoritiesConverter.setAuthorityPrefix("ROLE_");
        grantedAuthoritiesConverter.setAuthoritiesClaimName("role");

        JwtAuthenticationConverter jwtAuthenticationConverter = new JwtAuthenticationConverter();
        jwtAuthenticationConverter.setJwtGrantedAuthoritiesConverter(grantedAuthoritiesConverter);
        return jwtAuthenticationConverter;
    }
}
