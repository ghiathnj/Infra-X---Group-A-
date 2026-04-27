import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    Allergy,
    Medication,
    PreExistingCondition,
    Symptom
} from '../../core/patient-form.service';

export interface MonthlyStat {
    /** YYYY-MM, e.g. '2026-04' */
    key: string;
    /** Locale label, e.g. 'April 2026' */
    label: string;
    count: number;
    diagnosed: number;
    symptomCounts: Record<Symptom, number>;
}

export interface CountedItem<T extends string> {
    value: T;
    count: number;
}

export interface GlobalStat {
    topAllergies: CountedItem<Allergy>[];
    topMedications: CountedItem<Medication>[];
    topConditions: CountedItem<PreExistingCondition>[];
}

const SYMPTOM_LABELS: Record<Symptom, string> = {
    FEVER: 'Fever',
    COUGH: 'Cough',
    SHORTNESS_OF_BREATH: 'Shortness of breath',
    HEADACHE: 'Headache',
    DIZZINESS: 'Dizziness',
    NAUSEA: 'Nausea',
    CHEST_PAIN: 'Chest pain',
    BACK_PAIN: 'Back pain',
    RASH: 'Rash'
};

const ENUM_LABELS = {
    POLLEN: 'Pollen', HOUSE_DUST: 'House dust', ANIMAL_HAIR: 'Animal hair',
    PENICILLIN: 'Penicillin', NUTS: 'Nuts', LATEX: 'Latex',
    IBUPROFEN: 'Ibuprofen', ASPIRIN: 'Aspirin', INSULIN: 'Insulin',
    PARACETAMOL: 'Paracetamol', METFORMIN: 'Metformin',
    DIABETES: 'Diabetes', ASTHMA: 'Asthma',
    HIGH_BLOOD_PRESSURE: 'High blood pressure',
    HEART_DISEASE: 'Heart disease', THYROID: 'Thyroid disorder'
} as const;

const SYMPTOM_ORDER: readonly Symptom[] = [
    'FEVER', 'COUGH', 'SHORTNESS_OF_BREATH', 'HEADACHE', 'DIZZINESS',
    'NAUSEA', 'CHEST_PAIN', 'BACK_PAIN', 'RASH'
];

@Component({
    selector: 'app-statistics-panel',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './statistics-panel.component.html',
    styleUrl: './statistics-panel.component.css'
})
export class StatisticsPanelComponent {
    readonly monthlyStats = input.required<MonthlyStat[]>();
    readonly globalStats = input.required<GlobalStat>();

    /** True when there is literally nothing to show. */
    readonly isEmpty = computed(() => {
        const months = this.monthlyStats();
        const totalSubs = months.reduce((sum, m) => sum + m.count, 0);
        const g = this.globalStats();
        const totalGlobals =
            g.topAllergies.length + g.topMedications.length + g.topConditions.length;
        return totalSubs === 0 && totalGlobals === 0;
    });

    /** Max count across all months — for sizing the volume bars consistently. */
    readonly maxMonthlyCount = computed(() =>
        Math.max(1, ...this.monthlyStats().map((m) => m.count))
    );

    /** Per-month max symptom count, for normalising the symptom bars. */
    maxSymptomCountIn(month: MonthlyStat): number {
        return Math.max(1, ...Object.values(month.symptomCounts));
    }

    /** Symptom rows for a given month, sorted by frequency descending. */
    sortedSymptoms(month: MonthlyStat): { value: Symptom; label: string; count: number }[] {
        return SYMPTOM_ORDER
            .map((s) => ({ value: s, label: SYMPTOM_LABELS[s], count: month.symptomCounts[s] ?? 0 }))
            .sort((a, b) => b.count - a.count);
    }

    label(value: string): string {
        return (ENUM_LABELS as Record<string, string>)[value] ?? value;
    }

    diagnosedPercent(month: MonthlyStat): number {
        if (month.count === 0) return 0;
        return Math.round((month.diagnosed / month.count) * 100);
    }
}
