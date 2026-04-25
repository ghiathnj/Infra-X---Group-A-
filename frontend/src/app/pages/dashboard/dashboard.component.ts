import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../core/auth.service';
import { SubmissionsService } from '../../core/submissions.service';
import { PatientFormResponse } from '../../core/patient-form.service';
import { SubmissionDetailModalComponent } from './submission-detail-modal.component';

type UrgencyLevel = 'red' | 'yellow' | 'green';

// Tunable thresholds — see the urgencyLevel helper.
const URGENCY_RED_THRESHOLD = 5;
const URGENCY_YELLOW_THRESHOLD = 2;

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, SubmissionDetailModalComponent],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);
    private readonly api = inject(SubmissionsService);

    readonly username = computed(() => this.auth.payload()?.sub ?? 'doctor');
    readonly roles = computed(() => (this.auth.payload()?.roles ?? []).join(', '));
    readonly expiresAt = computed(() => {
        const exp = this.auth.payload()?.exp;
        return exp ? new Date(exp * 1000).toLocaleString() : '—';
    });

    readonly submissions = signal<PatientFormResponse[]>([]);
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly selected = signal<PatientFormResponse | null>(null);

    // Triage-sorted view: red → yellow → green, newest id first for ties.
    readonly sorted = computed<PatientFormResponse[]>(() =>
        [...this.submissions()].sort((a, b) => {
            const diff = this.urgencyScore(b) - this.urgencyScore(a);
            return diff !== 0 ? diff : b.id - a.id;
        })
    );

    ngOnInit(): void {
        this.loadSubmissions();
    }

    loadSubmissions(): void {
        this.loading.set(true);
        this.error.set(null);
        this.api.listAll().subscribe({
            next: (list) => {
                this.submissions.set(list);
                this.loading.set(false);
            },
            error: (err) => {
                this.loading.set(false);
                this.error.set(this.resolveError(err));
            }
        });
    }

    openDetail(s: PatientFormResponse): void {
        this.selected.set(s);
    }

    closeDetail(): void {
        this.selected.set(null);
    }

    onSaved(updated: PatientFormResponse): void {
        this.submissions.update((list) =>
            list.map((s) => (s.id === updated.id ? updated : s))
        );
        this.closeDetail();
    }

    urgencyScore(s: PatientFormResponse): number {
        const count = s.symptoms?.length ?? 0;
        const other = s.otherSymptoms && s.otherSymptoms.trim().length > 0 ? 1 : 0;
        return count + other;
    }

    formatSubmittedAt(s: PatientFormResponse): string {
        if (!s.submittedAt) return '—';
        return new Date(s.submittedAt).toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    urgencyLevel(s: PatientFormResponse): UrgencyLevel {
        const score = this.urgencyScore(s);
        if (score >= URGENCY_RED_THRESHOLD) return 'red';
        if (score >= URGENCY_YELLOW_THRESHOLD) return 'yellow';
        return 'green';
    }

    urgencyLabel(level: UrgencyLevel): string {
        switch (level) {
            case 'red': return 'High';
            case 'yellow': return 'Medium';
            case 'green': return 'Low';
        }
    }

    hasDiagnosis(s: PatientFormResponse): boolean {
        return !!(s.diagnosis && s.diagnosis.trim().length > 0);
    }

    logout(): void {
        this.auth.logout();
        this.router.navigate(['/login']);
    }

    private resolveError(err: unknown): string {
        if (err instanceof HttpErrorResponse) {
            if (err.status === 0) return 'Could not reach the clinical service.';
            if (err.status === 401 || err.status === 403) return 'Your session expired. Please log in again.';
            return `Could not load submissions (HTTP ${err.status}).`;
        }
        return 'Could not load submissions. Please try again.';
    }
}
