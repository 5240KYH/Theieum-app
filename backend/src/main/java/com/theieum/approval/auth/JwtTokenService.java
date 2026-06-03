package com.theieum.approval.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.theieum.approval.user.User;

@Service
public class JwtTokenService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String DEVELOPMENT_SECRET = "local-development-secret-change-me";
    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder URL_DECODER = Base64.getUrlDecoder();

    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final Duration accessTokenTtl;
    private final byte[] secret;

    @Autowired
    public JwtTokenService(
            ObjectMapper objectMapper,
            @Value("${app.security.jwt-secret}") String jwtSecret) {
        this(objectMapper, jwtSecret, Clock.systemUTC(), Duration.ofHours(1));
    }

    JwtTokenService(
            ObjectMapper objectMapper,
            String jwtSecret,
            Clock clock,
            Duration accessTokenTtl) {
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.accessTokenTtl = accessTokenTtl;
        this.secret = validateSecret(jwtSecret).getBytes(StandardCharsets.UTF_8);
    }

    public String createAccessToken(User user) {
        long expiresAt = Instant.now(clock).plus(accessTokenTtl).getEpochSecond();
        Map<String, Object> header = Map.of("alg", "HS256", "typ", "JWT");
        Map<String, Object> payload = Map.of(
                "sub", user.getLoginId(),
                "userId", user.getId(),
                "roles", user.getRoleList(),
                "exp", expiresAt);

        String headerPart = encodeJson(header);
        String payloadPart = encodeJson(payload);
        String signaturePart = sign(headerPart + "." + payloadPart);
        return headerPart + "." + payloadPart + "." + signaturePart;
    }

    public Optional<JwtTokenPayload> verify(String token) {
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            return Optional.empty();
        }

        String signedContent = parts[0] + "." + parts[1];
        if (!signatureMatches(signedContent, parts[2])) {
            return Optional.empty();
        }

        try {
            Map<String, Object> payload = objectMapper.readValue(
                    URL_DECODER.decode(parts[1]),
                    new TypeReference<>() {
                    });
            long expiresAt = ((Number) payload.get("exp")).longValue();
            if (Instant.now(clock).getEpochSecond() >= expiresAt) {
                return Optional.empty();
            }

            List<String> roles = ((List<?>) payload.get("roles")).stream()
                    .map(String::valueOf)
                    .toList();
            return Optional.of(new JwtTokenPayload(
                    String.valueOf(payload.get("sub")),
                    ((Number) payload.get("userId")).longValue(),
                    roles,
                    expiresAt));
        } catch (RuntimeException | java.io.IOException ex) {
            return Optional.empty();
        }
    }

    private String encodeJson(Map<String, Object> values) {
        try {
            return URL_ENCODER.encodeToString(objectMapper.writeValueAsBytes(values));
        } catch (java.io.IOException ex) {
            throw new IllegalStateException("JWT JSON serialization failed", ex);
        }
    }

    private String sign(String content) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret, HMAC_ALGORITHM));
            return URL_ENCODER.encodeToString(mac.doFinal(content.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException ex) {
            throw new IllegalStateException("JWT signing failed", ex);
        }
    }

    private boolean signatureMatches(String signedContent, String signature) {
        try {
            return MessageDigest.isEqual(
                    URL_DECODER.decode(sign(signedContent)),
                    URL_DECODER.decode(signature));
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private String validateSecret(String jwtSecret) {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalArgumentException("JWT secret must not be blank");
        }
        if (DEVELOPMENT_SECRET.equals(jwtSecret)) {
            throw new IllegalArgumentException("JWT secret must be supplied outside the shared development default");
        }
        return jwtSecret;
    }
}
