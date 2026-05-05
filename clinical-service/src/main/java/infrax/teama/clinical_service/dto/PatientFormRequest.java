package infrax.teama.clinical_service.dto;

import infrax.teama.clinical_service.model.PatientForm;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.time.LocalDate;
import java.util.List;

@Data
public class PatientFormRequest {
    @NotBlank
    @Pattern(regexp = "[A-Za-zÄÖÜäöüß]+(?:[ '-][A-Za-zÄÖÜäöüß]+)*", message = "First name contains invalid characters")
    private String firstName;
    @NotBlank
    @Pattern(regexp = "[A-Za-zÄÖÜäöüß]+(?:[ '-][A-Za-zÄÖÜäöüß]+)*", message = "Last name contains invalid characters")
    private String lastName;
    @NotNull
    private LocalDate dateOfBirth;
    @NotBlank
    @Pattern(regexp = "[A-Za-zÄÖÜäöüß]+(?:[ '-][A-Za-zÄÖÜäöüß]+)*", message = "Street name contains invalid characters")
    private String streetName;
    @NotBlank
    @Pattern(regexp = "\\d+", message = "Street number must be numeric")
    private String streetNumber;
    @NotBlank
    @Pattern(regexp = "[A-Za-zÄÖÜäöüß]+(?:[ '-][A-Za-zÄÖÜäöüß]+)*", message = "City contains invalid characters")
    private String city;
    @NotBlank
    @Pattern(regexp = "\\d+", message = "Postal code must be numeric")
    private String postalCode;
    @NotBlank
    @Pattern(regexp = "[\\+]?([0-9\\- ]+)", message = "Invalid phone number format")
    private String phoneNumber;
    @Email
    private String emailAddress;

    // Medical Information
    private List<PatientForm.Symptom> symptoms;
    private String otherSymptoms;
    private List<PatientForm.Allergy> allergies;
    private String otherAllergies;
    private List<PatientForm.Medication> medications;
    private String otherMedications;
    private List<PatientForm.PreExistingCondition> preExistingConditions;
    private String otherPreExistingConditions;
}
