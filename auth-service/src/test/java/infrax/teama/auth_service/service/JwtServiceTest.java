package infrax.teama.auth_service.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import javax.crypto.SecretKey;
import java.util.Base64;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    // Base64-encoded 32-byte HMAC-SHA256 secret (matches the format auth-service expects in jwt.secret).
    private static final String SECRET =
            "VGhpcyBpcyBhIHNhbXBsZSBzZWNyZXQga2V5IGZvciBKV1Qgc2lnbmluZyE=";
    private static final long EXPIRATION_MS = 60_000L;

    private JwtService jwtService;
    private UserDetails admin;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(SECRET, EXPIRATION_MS);
        admin = User.withUsername("admin")
                .password("irrelevant")
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))
                .build();
    }

    @Test
    void generateToken_includesUsernameAndRolesClaim() {
        String token = jwtService.generateToken(admin);

        assertThat(token).isNotBlank();

        Claims claims = parseClaims(token);
        assertThat(claims.getSubject()).isEqualTo("admin");
        assertThat(claims.get("roles", List.class)).containsExactly("ROLE_ADMIN");
        assertThat(claims.getExpiration()).isAfter(new Date());
    }

    @Test
    void extractUsername_returnsSubject() {
        String token = jwtService.generateToken(admin);

        assertThat(jwtService.extractUsername(token)).isEqualTo("admin");
    }

    @Test
    void isTokenValid_returnsTrue_forFreshTokenAndMatchingUser() {
        String token = jwtService.generateToken(admin);

        assertThat(jwtService.isTokenValid(token, admin)).isTrue();
    }

    @Test
    void isTokenValid_returnsFalse_whenUsernameDoesNotMatch() {
        String token = jwtService.generateToken(admin);
        UserDetails other = User.withUsername("doctor")
                .password("x")
                .authorities("ROLE_DOCTOR")
                .build();

        assertThat(jwtService.isTokenValid(token, other)).isFalse();
    }

    @Test
    void isTokenValid_throws_whenTokenIsExpired() {
        // Build a token that expired one second ago, signed with the same key.
        SecretKey key = Keys.hmacShaKeyFor(Base64.getDecoder().decode(SECRET));
        long now = System.currentTimeMillis();
        String expired = Jwts.builder()
                .subject("admin")
                .claim("roles", List.of("ROLE_ADMIN"))
                .issuedAt(new Date(now - 10_000))
                .expiration(new Date(now - 1_000))
                .signWith(key)
                .compact();

        // Parsing an expired token throws ExpiredJwtException — that matches how
        // the production filter behaves: an expired token is rejected, not silently false.
        assertThatThrownByParsing(expired);
    }

    private Claims parseClaims(String token) {
        SecretKey key = Keys.hmacShaKeyFor(Base64.getDecoder().decode(SECRET));
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private void assertThatThrownByParsing(String expired) {
        org.assertj.core.api.Assertions
                .assertThatThrownBy(() -> jwtService.isTokenValid(expired, admin))
                .isInstanceOf(io.jsonwebtoken.ExpiredJwtException.class);
    }
}
