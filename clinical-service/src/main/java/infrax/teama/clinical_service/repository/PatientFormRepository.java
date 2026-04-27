package infrax.teama.clinical_service.repository;

import infrax.teama.clinical_service.model.PatientForm;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatientFormRepository extends JpaRepository<PatientForm, Long> {
}
