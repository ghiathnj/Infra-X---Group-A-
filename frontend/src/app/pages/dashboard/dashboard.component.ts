import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../core/auth.service';
import { SubmissionsService } from '../../core/submissions.service';
import {
    Allergy,
    Medication,
    PatientFormResponse,
    PreExistingCondition,
    Symptom
} from '../../core/patient-form.service';
import { SubmissionDetailModalComponent } from './submission-detail-modal.component';
import {
    StatisticsPanelComponent,
    MonthlyStat,
    GlobalStat,
    CountedItem
} from './statistics-panel.component';

type UrgencyLevel = 'red' | 'yellow' | 'green';
type Tab = 'submissions' | 'statistics';

// Tunable thresholds — see the urgencyLevel helper.
const URGENCY_RED_THRESHOLD = 5;
const URGENCY_YELLOW_THRESHOLD = 2;

const MONTHS_WINDOW = 6;

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, SubmissionDetailModalComponent, StatisticsPanelComponent],
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

    readonly activeTab = signal<Tab>('submissions');

    // Triage-sorted view: red → yellow → green, newest id first for ties.
    readonly sorted = computed<PatientFormResponse[]>(() =>
        [...this.submissions()].sort((a, b) => {
            const diff = this.urgencyScore(b) - this.urgencyScore(a);
            return diff !== 0 ? diff : b.id - a.id;
        })
    );

    // Statistics — recompute automatically whenever the submissions list changes.
    readonly monthlyStats = computed<MonthlyStat[]>(() =>
        this.groupByMonth(this.submissions())
    );

    readonly globalStats = computed<GlobalStat>(() =>
        this.aggregateGlobals(this.submissions())
    );

    setTab(tab: Tab): void {
        this.activeTab.set(tab);
    }

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

    private groupByMonth(list: PatientFormResponse[]): MonthlyStat[] {
        const months: MonthlyStat[] = [];
        const now = new Date();

        // Build the last MONTHS_WINDOW months, oldest first.
        for (let i = MONTHS_WINDOW - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleString('de-DE', { month: 'long', year: 'numeric' });
            months.push({
                key,
                label,
                count: 0,
                diagnosed: 0,
                symptomCounts: this.emptySymptomCounts()
            });
        }

        const byKey = new Map(months.map((m) => [m.key, m]));

        for (const s of list) {
            if (!s.submittedAt) continue;
            const d = new Date(s.submittedAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const m = byKey.get(key);
            if (!m) continue; // outside the window

            m.count++;
            if (s.diagnosis && s.diagnosis.trim().length > 0) m.diagnosed++;
            for (const sym of s.symptoms ?? []) {
                m.symptomCounts[sym] = (m.symptomCounts[sym] ?? 0) + 1;
            }
        }

        return months;
    }

    private emptySymptomCounts(): Record<Symptom, number> {
        return {
            FEVER: 0,
            COUGH: 0,
            SHORTNESS_OF_BREATH: 0,
            HEADACHE: 0,
            DIZZINESS: 0,
            NAUSEA: 0,
            CHEST_PAIN: 0,
            BACK_PAIN: 0,
            RASH: 0
        };
    }

    private aggregateGlobals(list: PatientFormResponse[]): GlobalStat {
        return {
            topAllergies: this.tally<Allergy>(list, (s) => s.allergies),
            topMedications: this.tally<Medication>(list, (s) => s.medications),
            topConditions: this.tally<PreExistingCondition>(list, (s) => s.preExistingConditions)
        };
    }

    private tally<T extends string>(
        list: PatientFormResponse[],
        getter: (s: PatientFormResponse) => readonly T[] | undefined | null
    ): CountedItem<T>[] {
        const counts = new Map<T, number>();
        for (const s of list) {
            for (const v of getter(s) ?? []) {
                counts.set(v, (counts.get(v) ?? 0) + 1);
            }
        }
        return [...counts.entries()]
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => b.count - a.count);
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
