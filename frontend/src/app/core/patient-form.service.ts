import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export type Symptom =
    | 'FEVER' | 'COUGH' | 'SHORTNESS_OF_BREATH' | 'HEADACHE' | 'DIZZINESS'
    | 'NAUSEA' | 'CHEST_PAIN' | 'BACK_PAIN' | 'RASH';

export type Allergy =
    | 'POLLEN' | 'HOUSE_DUST' | 'ANIMAL_HAIR' | 'PENICILLIN' | 'NUTS' | 'LATEX';

export type Medication =
    | 'IBUPROFEN' | 'ASPIRIN' | 'INSULIN' | 'PARACETAMOL' | 'METFORMIN';

export type PreExistingCondition =
    | 'DIABETES' | 'ASTHMA' | 'HIGH_BLOOD_PRESSURE' | 'HEART_DISEASE' | 'THYROID';

export interface PatientFormRequest {
    firstName: string;
    lastName: string;
    dateOfBirth: string; // ISO yyyy-MM-dd
    streetName: string;
    streetNumber: string;
    city: string;
    postalCode: string;
    phoneNumber: string;
    emailAddress?: string | null;
    symptoms?: Symptom[];
    otherSymptoms?: string | null;
    allergies?: Allergy[];
    otherAllergies?: string | null;
    medications?: Medication[];
    otherMedications?: string | null;
    preExistingConditions?: PreExistingCondition[];
    otherPreExistingConditions?: string | null;
    signature: string;
    privacyAccepted: boolean;
}

export interface PatientFormResponse extends PatientFormRequest {
    id: number;
    diagnosis?: string | null;
    notes?: string | null;
    /** ISO-8601 timestamp set by clinical-service on first persist. */
    submittedAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PatientFormService {
    private readonly http = inject(HttpClient);

    submit(payload: PatientFormRequest): Observable<PatientFormResponse> {
        return this.http.post<PatientFormResponse>(
            `${environment.apiClinicalUrl}/api/clinical/forms`,
            payload
        );
    }
}
