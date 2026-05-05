package infrax.teama.clinical_service.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import infrax.teama.clinical_service.dto.AdminUpdateRequest;
import infrax.teama.clinical_service.model.PatientForm;
import infrax.teama.clinical_service.security.JwtAuthenticationFilter;
import infrax.teama.clinical_service.security.JwtProvider;
import infrax.teama.clinical_service.service.PatientFormService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PatientFormController.class)
@AutoConfigureMockMvc(addFilters = false)
class PatientFormControllerTest {

    @Autowired
    private MockMvc mvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @MockitoBean
    private PatientFormService service;

    // SecurityConfig wires the filter even though we run with addFilters=false.
    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockitoBean
    private JwtProvider jwtProvider;

    private Map<String, Object> validBody;

    @BeforeEach
    void setUp() {
        validBody = new HashMap<>();
        validBody.put("firstName", "Max");
        validBody.put("lastName", "Muster");
        validBody.put("dateOfBirth", "1990-01-01");
        validBody.put("streetName", "Hauptstrasse");
        validBody.put("streetNumber", "42");
        validBody.put("city", "Berlin");
        validBody.put("postalCode", "10115");
        validBody.put("phoneNumber", "+49 30 1234567");
        validBody.put("emailAddress", "max@example.com");
        validBody.put("symptoms", List.of());
        validBody.put("allergies", List.of());
        validBody.put("medications", List.of());
        validBody.put("preExistingConditions", List.of());
        validBody.put("privacyAccepted", true);
        validBody.put("signature", "data:image/png;base64,iVBORw0KGgo=");
    }

    @Test
    void postForm_returns200_andId_forValidBody() throws Exception {
        PatientForm saved = PatientForm.builder()
                .id(42L)
                .firstName("Max")
                .lastName("Muster")
                .dateOfBirth(LocalDate.of(1990, 1, 1))
                .privacyAccepted(true)
                .signature("data:image/png;base64,iVBORw0KGgo=")
                .build();
        when(service.submitForm(any())).thenReturn(saved);

        mvc.perform(post("/api/clinical/forms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.privacyAccepted").value(true))
                .andExpect(jsonPath("$.signature").value("data:image/png;base64,iVBORw0KGgo="));
    }

    @Test
    void postForm_returns400_whenPrivacyNotAccepted() throws Exception {
        validBody.put("privacyAccepted", false);

        mvc.perform(post("/api/clinical/forms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validBody)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void postForm_returns400_whenSignatureIsBlank() throws Exception {
        validBody.put("signature", "");

        mvc.perform(post("/api/clinical/forms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validBody)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void postForm_returns400_whenFirstNameViolatesPattern() throws Exception {
        validBody.put("firstName", "Max123"); // digits not allowed by the name pattern

        mvc.perform(post("/api/clinical/forms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validBody)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getAllForms_returnsList() throws Exception {
        PatientForm one = PatientForm.builder().id(1L).firstName("Anna").build();
        PatientForm two = PatientForm.builder().id(2L).firstName("Bob").build();
        when(service.getAllForms()).thenReturn(List.of(one, two));

        mvc.perform(get("/api/clinical/forms"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[1].id").value(2));
    }

    @Test
    void getForm_returns404_whenNotFound() throws Exception {
        when(service.getForm(999L)).thenReturn(Optional.empty());

        mvc.perform(get("/api/clinical/forms/{id}", 999L))
                .andExpect(status().isNotFound());
    }

    @Test
    void getForm_returns200_whenFound() throws Exception {
        PatientForm found = PatientForm.builder().id(5L).firstName("Anna").build();
        when(service.getForm(5L)).thenReturn(Optional.of(found));

        mvc.perform(get("/api/clinical/forms/{id}", 5L))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.firstName").value("Anna"));
    }

    @Test
    void patchAdminFields_returns200_andUpdatesDiagnosis() throws Exception {
        PatientForm updated = PatientForm.builder()
                .id(3L)
                .firstName("Anna")
                .diagnosis("Bronchitis")
                .notes("Follow up in 1 week")
                .build();
        when(service.updateAdminFields(any(Long.class), any(AdminUpdateRequest.class)))
                .thenReturn(Optional.of(updated));

        Map<String, String> patchBody = Map.of(
                "diagnosis", "Bronchitis",
                "notes", "Follow up in 1 week"
        );

        mvc.perform(patch("/api/clinical/forms/{id}/admin", 3L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(patchBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.diagnosis").value("Bronchitis"))
                .andExpect(jsonPath("$.notes").value("Follow up in 1 week"));
    }

    @Test
    void patchAdminFields_returns404_whenIdUnknown() throws Exception {
        when(service.updateAdminFields(any(Long.class), any(AdminUpdateRequest.class)))
                .thenReturn(Optional.empty());

        mvc.perform(patch("/api/clinical/forms/{id}/admin", 404L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"diagnosis\":\"anything\"}"))
                .andExpect(status().isNotFound());
    }
}
