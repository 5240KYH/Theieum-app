package com.theieum.approval.auth;

import java.io.IOException;

import com.theieum.approval.user.User;
import com.theieum.approval.user.UserRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class BearerTokenAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenService jwtTokenService;
    private final UserRepository userRepository;

    public BearerTokenAuthenticationFilter(JwtTokenService jwtTokenService, UserRepository userRepository) {
        this.jwtTokenService = jwtTokenService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
            filterChain.doFilter(request, response);
            return;
        }

        jwtTokenService.verify(authorization.substring(BEARER_PREFIX.length()))
                .flatMap(payload -> userRepository.findByIdAndActiveTrue(payload.userId()))
                .ifPresentOrElse(
                        user -> authenticate(user),
                        () -> response.setStatus(HttpServletResponse.SC_UNAUTHORIZED));

        if (response.getStatus() == HttpServletResponse.SC_UNAUTHORIZED) {
            return;
        }
        filterChain.doFilter(request, response);
    }

    private void authenticate(User user) {
        AuthenticatedUser principal = AuthenticatedUser.from(user);
        var authorities = principal.roles().stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .toList();
        var authentication = new UsernamePasswordAuthenticationToken(principal, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
