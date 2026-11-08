package com.classbridge.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class ForcedPasswordChangeFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getRequestURI().startsWith("/api/") && !"OPTIONS".equalsIgnoreCase(request.getMethod())) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication instanceof JwtAuthenticationToken jwtAuthentication
                    && Boolean.TRUE.equals(jwtAuthentication.getToken().getClaimAsBoolean("must_change_password"))
                    && !isAllowedDuringPasswordChange(request)) {
                response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                response.setContentType("application/json");
                response.setCharacterEncoding("UTF-8");
                response.getWriter().write("{\"message\":\"Change your temporary password before continuing.\"}");
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private boolean isAllowedDuringPasswordChange(HttpServletRequest request) {
        String path = request.getServletPath();
        return ("GET".equalsIgnoreCase(request.getMethod()) && "/api/auth/user".equals(path))
                || ("POST".equalsIgnoreCase(request.getMethod()) && "/api/auth/change-password".equals(path));
    }
}
