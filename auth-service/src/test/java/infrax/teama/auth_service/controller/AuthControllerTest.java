package infrax.teama.auth_service.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import infrax.teama.auth_service.config.JwtAuthenticationFilter;
import infrax.teama.auth_service.dto.LoginRequest;
import infrax.teama.auth_service.service.CustomUserDetailsService;
import infrax.teama.auth_service.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTest {

    @Autowired
    private MockMvc mvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @MockitoBean
    private org.springframework.security.authentication.AuthenticationManager authenticationManager;

    @MockitoBean
    private JwtService jwtService;

    // SecurityConfig wires these — must be present in the context even if the
    // filter chain is disabled for these slice tests.
    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockitoBean
    private CustomUserDetailsService customUserDetailsService;

    @Test
    void login_returnsToken_forValidCredentials() throws Exception {
        UserDetails admin = User.withUsername("admin")
                .password("ignored")
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))
                .build();
        Authentication authResult = new UsernamePasswordAuthenticationToken(admin, "password",
                admin.getAuthorities());
        when(authenticationManager.authenticate(any())).thenReturn(authResult);
        when(jwtService.generateToken(admin)).thenReturn("signed.jwt.token");

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest("admin", "password"))))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.token").value("signed.jwt.token"));

        verify(jwtService).generateToken(admin);
    }

    @Test
    void login_returns401_forBadCredentials() throws Exception {
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest("admin", "wrong"))))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string("Invalid username or password"));
    }
}
