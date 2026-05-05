package infrax.teama.clinical_service.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.SecretKey;
import java.util.Base64;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JwtProviderTest {

    // The shared HMAC secret — must be the same Base64 string the auth-service
    // signs with, otherwise tokens minted there would not validate here.
    private static final String SHARED_SECRET =
            "VGhpcyBpcyBhIHNhbXBsZSBzZWNyZXQga2V5IGZvciBKV1Qgc2lnbmluZyE=";
    private static final String OTHER_SECRET =
            "QW5vdGhlciBzZWNyZXQga2V5IHRoYXQgaXMgY29tcGxldGVseSBkaWZmZXI=";

    private JwtProvider provider;

    @BeforeEach
    void setUp() {
        provider = new JwtProvider();
        ReflectionTestUtils.setField(provider, "jwtSecret", SHARED_SECRET);
    }

    @Test
    void validateToken_returnsTrue_forTokenSignedWithSharedSecret() {
        String token = signToken("admin", List.of("ROLE_ADMIN"), SHARED_SECRET, 60_000);

        assertThat(provider.validateToken(token)).isTrue();
    }

    @Test
    void validateToken_returnsFalse_forTokenSignedWithDifferentSecret() {
        String token = signToken("admin", List.of("ROLE_ADMIN"), OTHER_SECRET, 60_000);

        assertThat(provider.validateToken(token)).isFalse();
    }

    @Test
    void validateToken_returnsFalse_forExpiredToken() {
        String token = signToken("admin", List.of("ROLE_ADMIN"), SHARED_SECRET, -1_000);

        assertThat(provider.validateToken(token)).isFalse();
    }

    @Test
    void validateToken_returnsFalse_forMalformedToken() {
        assertThat(provider.validateToken("not-a-real-token")).isFalse();
    }

    @Test
    void getUsernameFromToken_returnsSubject() {
        String token = signToken("dr.house", List.of("ROLE_DOCTOR"), SHARED_SECRET, 60_000);

        assertThat(provider.getUsernameFromToken(token)).isEqualTo("dr.house");
    }

    private static String signToken(String subject, List<String> roles, String base64Secret, long ttlMs) {
        SecretKey key = Keys.hmacShaKeyFor(Base64.getDecoder().decode(base64Secret));
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(subject)
                .claim("roles", roles)
                .issuedAt(new Date(now - 1_000))
                .expiration(new Date(now + ttlMs))
                .signWith(key)
                .compact();
    }
}
