package infrax.teama.clinical_service.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PatientForm {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Personal Information
    @Column(nullable = false)
    private String firstName;
    @Column(nullable = false)
    private String lastName;
    @Column(nullable = false)
    private LocalDate dateOfBirth;
    @Column(nullable = false)
    private String streetName;
    @Column(nullable = false)
    private String streetNumber;
    @Column(nullable = false)
    private String city;
    @Column(nullable = false)
    private String postalCode;
    @Column(nullable = false)
    private String phoneNumber;
    private String emailAddress;

    // Medical Information
    @ElementCollection
    private List<Symptom> symptoms;
    private String otherSymptoms;

    @ElementCollection
    private List<Allergy> allergies;
    private String otherAllergies;

    @ElementCollection
    private List<Medication> medications;
    private String otherMedications;

    @ElementCollection
    private List<PreExistingCondition> preExistingConditions;
    private String otherPreExistingConditions;

    // Admin fields
    private String diagnosis;
    private String notes;

    // Timestamp set automatically by Hibernate on first persist; never updated.
    @CreationTimestamp
    @Column(name = "submitted_at", updatable = false)
    private LocalDateTime submittedAt;

    public enum Symptom {
        FEVER, COUGH, SHORTNESS_OF_BREATH, HEADACHE, DIZZINESS, NAUSEA, CHEST_PAIN, BACK_PAIN, RASH
    }
    public enum Allergy {
        POLLEN, HOUSE_DUST, ANIMAL_HAIR, PENICILLIN, NUTS, LATEX
    }
    public enum Medication {
        IBUPROFEN, ASPIRIN, INSULIN, PARACETAMOL, METFORMIN
    }
    public enum PreExistingCondition {
        DIABETES, ASTHMA, HIGH_BLOOD_PRESSURE, HEART_DISEASE, THYROID
    }
}
