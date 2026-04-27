package infrax.teama.clinical_service.controller;

import infrax.teama.clinical_service.dto.AdminUpdateRequest;
import infrax.teama.clinical_service.dto.PatientFormRequest;
import infrax.teama.clinical_service.model.PatientForm;
import infrax.teama.clinical_service.service.PatientFormService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clinical/forms")
@RequiredArgsConstructor
public class PatientFormController {
    private final PatientFormService service;

    @PostMapping
    public ResponseEntity<PatientForm> submitForm(@Valid @RequestBody PatientFormRequest request) {
        PatientForm saved = service.submitForm(request);
        return ResponseEntity.ok(saved);
    }

    // Admin: get all forms
    @GetMapping
    public ResponseEntity<List<PatientForm>> getAllForms() {
        return ResponseEntity.ok(service.getAllForms());
    }

    // Admin: get a specific form by id
    @GetMapping("/{id}")
    public ResponseEntity<PatientForm> getForm(@PathVariable Long id) {
        return service.getForm(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Admin: update diagnosis and notes
    @PatchMapping("/{id}/admin")
    public ResponseEntity<PatientForm> updateAdminFields(@PathVariable Long id,
                                                         @RequestBody AdminUpdateRequest req) {
        return service.updateAdminFields(id, req)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
