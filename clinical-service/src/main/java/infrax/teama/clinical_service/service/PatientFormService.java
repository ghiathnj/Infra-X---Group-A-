package infrax.teama.clinical_service.service;

import infrax.teama.clinical_service.dto.AdminUpdateRequest;
import infrax.teama.clinical_service.dto.PatientFormRequest;
import infrax.teama.clinical_service.model.PatientForm;
import infrax.teama.clinical_service.repository.PatientFormRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PatientFormService {
    private final PatientFormRepository repository;

    @Transactional
    public PatientForm submitForm(PatientFormRequest request) {
        PatientForm form = PatientForm.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .dateOfBirth(request.getDateOfBirth())
                .streetName(request.getStreetName())
                .streetNumber(request.getStreetNumber())
                .city(request.getCity())
                .postalCode(request.getPostalCode())
                .phoneNumber(request.getPhoneNumber())
                .emailAddress(request.getEmailAddress())
                .symptoms(request.getSymptoms())
                .otherSymptoms(request.getOtherSymptoms())
                .allergies(request.getAllergies())
                .otherAllergies(request.getOtherAllergies())
                .medications(request.getMedications())
                .otherMedications(request.getOtherMedications())
                .preExistingConditions(request.getPreExistingConditions())
                .otherPreExistingConditions(request.getOtherPreExistingConditions())
                .build();
        return repository.save(form);
    }

    public List<PatientForm> getAllForms() {
        return repository.findAll();
    }

    public Optional<PatientForm> getForm(Long id) {
        return repository.findById(id);
    }

    @Transactional
    public Optional<PatientForm> updateAdminFields(Long id, AdminUpdateRequest req) {
        return repository.findById(id).map(form -> {
            form.setDiagnosis(req.getDiagnosis());
            form.setNotes(req.getNotes());
            return repository.save(form);
        });
    }
}
