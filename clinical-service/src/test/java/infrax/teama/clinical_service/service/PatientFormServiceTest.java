package infrax.teama.clinical_service.service;

import infrax.teama.clinical_service.dto.AdminUpdateRequest;
import infrax.teama.clinical_service.dto.PatientFormRequest;
import infrax.teama.clinical_service.model.PatientForm;
import infrax.teama.clinical_service.repository.PatientFormRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PatientFormServiceTest {

    @Mock
    private PatientFormRepository repository;

    @InjectMocks
    private PatientFormService service;

    private PatientFormRequest validRequest;

    @BeforeEach
    void setUp() {
        validRequest = new PatientFormRequest();
        validRequest.setFirstName("Max");
        validRequest.setLastName("Muster");
        validRequest.setDateOfBirth(LocalDate.of(1990, 1, 1));
        validRequest.setStreetName("Hauptstrasse");
        validRequest.setStreetNumber("42");
        validRequest.setCity("Berlin");
        validRequest.setPostalCode("10115");
        validRequest.setPhoneNumber("+49 30 1234567");
        validRequest.setEmailAddress("max@example.com");
        validRequest.setSymptoms(List.of(PatientForm.Symptom.FEVER, PatientForm.Symptom.COUGH));
        validRequest.setOtherSymptoms("sore throat");
        validRequest.setAllergies(List.of(PatientForm.Allergy.POLLEN));
        validRequest.setMedications(List.of());
        validRequest.setPreExistingConditions(List.of(PatientForm.PreExistingCondition.ASTHMA));
        validRequest.setPrivacyAccepted(true);
        validRequest.setSignature("data:image/png;base64,iVBORw0KGgo=");
    }

    @Test
    void submitForm_mapsAllFieldsToEntity_andSaves() {
        when(repository.save(any(PatientForm.class))).thenAnswer(inv -> {
            PatientForm saved = inv.getArgument(0);
            saved.setId(7L);
            return saved;
        });

        PatientForm result = service.submitForm(validRequest);

        ArgumentCaptor<PatientForm> captor = ArgumentCaptor.forClass(PatientForm.class);
        verify(repository).save(captor.capture());
        PatientForm persisted = captor.getValue();

        assertThat(persisted.getFirstName()).isEqualTo("Max");
        assertThat(persisted.getLastName()).isEqualTo("Muster");
        assertThat(persisted.getDateOfBirth()).isEqualTo(LocalDate.of(1990, 1, 1));
        assertThat(persisted.getStreetName()).isEqualTo("Hauptstrasse");
        assertThat(persisted.getStreetNumber()).isEqualTo("42");
        assertThat(persisted.getCity()).isEqualTo("Berlin");
        assertThat(persisted.getPostalCode()).isEqualTo("10115");
        assertThat(persisted.getPhoneNumber()).isEqualTo("+49 30 1234567");
        assertThat(persisted.getEmailAddress()).isEqualTo("max@example.com");
        assertThat(persisted.getSymptoms())
                .containsExactly(PatientForm.Symptom.FEVER, PatientForm.Symptom.COUGH);
        assertThat(persisted.getOtherSymptoms()).isEqualTo("sore throat");
        assertThat(persisted.getAllergies()).containsExactly(PatientForm.Allergy.POLLEN);
        assertThat(persisted.getPreExistingConditions())
                .containsExactly(PatientForm.PreExistingCondition.ASTHMA);
        // Critical: the new privacy + signature fields must be propagated.
        assertThat(persisted.getPrivacyAccepted()).isTrue();
        assertThat(persisted.getSignature()).isEqualTo("data:image/png;base64,iVBORw0KGgo=");

        assertThat(result.getId()).isEqualTo(7L);
    }

    @Test
    void getAllForms_delegatesToRepository() {
        PatientForm a = PatientForm.builder().id(1L).firstName("A").build();
        PatientForm b = PatientForm.builder().id(2L).firstName("B").build();
        when(repository.findAll()).thenReturn(List.of(a, b));

        List<PatientForm> result = service.getAllForms();

        assertThat(result).containsExactly(a, b);
    }

    @Test
    void getForm_returnsOptional_fromRepository() {
        PatientForm found = PatientForm.builder().id(5L).firstName("Anna").build();
        when(repository.findById(5L)).thenReturn(Optional.of(found));
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThat(service.getForm(5L)).contains(found);
        assertThat(service.getForm(99L)).isEmpty();
    }

    @Test
    void updateAdminFields_setsDiagnosisAndNotes_onExistingForm() {
        PatientForm existing = PatientForm.builder().id(3L).firstName("Anna").build();
        when(repository.findById(3L)).thenReturn(Optional.of(existing));
        when(repository.save(any(PatientForm.class))).thenAnswer(inv -> inv.getArgument(0));

        AdminUpdateRequest req = new AdminUpdateRequest();
        req.setDiagnosis("Bronchitis");
        req.setNotes("Antibiotics prescribed.");

        Optional<PatientForm> result = service.updateAdminFields(3L, req);

        assertThat(result).isPresent();
        assertThat(result.get().getDiagnosis()).isEqualTo("Bronchitis");
        assertThat(result.get().getNotes()).isEqualTo("Antibiotics prescribed.");
        verify(repository).save(existing);
    }

    @Test
    void updateAdminFields_returnsEmpty_whenIdUnknown() {
        when(repository.findById(404L)).thenReturn(Optional.empty());

        AdminUpdateRequest req = new AdminUpdateRequest();
        req.setDiagnosis("anything");

        Optional<PatientForm> result = service.updateAdminFields(404L, req);

        assertThat(result).isEmpty();
        verify(repository, never()).save(any());
    }
}
