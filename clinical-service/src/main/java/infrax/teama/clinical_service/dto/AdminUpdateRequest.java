package infrax.teama.clinical_service.dto;

import lombok.Data;

@Data
public class AdminUpdateRequest {
    private String diagnosis;
    private String notes;
}
