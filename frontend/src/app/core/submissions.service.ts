import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { PatientFormResponse } from './patient-form.service';

export interface AdminUpdateRequest {
    diagnosis: string | null;
    notes: string | null;
}

@Injectable({ providedIn: 'root' })
export class SubmissionsService {
    private readonly http = inject(HttpClient);
    private readonly base = `${environment.apiClinicalUrl}/api/clinical/forms`;

    listAll(): Observable<PatientFormResponse[]> {
        return this.http.get<PatientFormResponse[]>(this.base);
    }

    getOne(id: number): Observable<PatientFormResponse> {
        return this.http.get<PatientFormResponse>(`${this.base}/${id}`);
    }

    updateAdminFields(
        id: number,
        body: AdminUpdateRequest
    ): Observable<PatientFormResponse> {
        return this.http.patch<PatientFormResponse>(`${this.base}/${id}/admin`, body);
    }
}
