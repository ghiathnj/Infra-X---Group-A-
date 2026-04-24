import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    FormArray,
    FormBuilder,
    FormControl,
    ReactiveFormsModule,
    Validators
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import {
    PatientFormService,
    PatientFormRequest,
    Symptom,
    Allergy,
    Medication,
    PreExistingCondition
} from '../../core/patient-form.service';

interface OptionDef<T extends string> {
    value: T;
    label: string;
}

@Component({
    selector: 'app-patient-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    templateUrl: './patient-form.component.html',
    styleUrl: './patient-form.component.css'
})
export class PatientFormComponent {
    private readonly fb = inject(FormBuilder);
    private readonly api = inject(PatientFormService);

    readonly submitting = signal(false);
    readonly submittedId = signal<number | null>(null);
    readonly errorMessage = signal<string | null>(null);

    // Backend-driven enum lists — labels are display-only; values must match the enum on the server.
    readonly symptomOptions: OptionDef<Symptom>[] = [
        { value: 'FEVER', label: 'Fever' },
        { value: 'COUGH', label: 'Cough' },
        { value: 'SHORTNESS_OF_BREATH', label: 'Shortness of breath' },
        { value: 'HEADACHE', label: 'Headache' },
        { value: 'DIZZINESS', label: 'Dizziness' },
        { value: 'NAUSEA', label: 'Nausea' },
        { value: 'CHEST_PAIN', label: 'Chest pain' },
        { value: 'BACK_PAIN', label: 'Back pain' },
        { value: 'RASH', label: 'Rash' }
    ];
    readonly allergyOptions: OptionDef<Allergy>[] = [
        { value: 'POLLEN', label: 'Pollen' },
        { value: 'HOUSE_DUST', label: 'House dust' },
        { value: 'ANIMAL_HAIR', label: 'Animal hair' },
        { value: 'PENICILLIN', label: 'Penicillin' },
        { value: 'NUTS', label: 'Nuts' },
        { value: 'LATEX', label: 'Latex' }
    ];
    readonly medicationOptions: OptionDef<Medication>[] = [
        { value: 'IBUPROFEN', label: 'Ibuprofen' },
        { value: 'ASPIRIN', label: 'Aspirin' },
        { value: 'INSULIN', label: 'Insulin' },
        { value: 'PARACETAMOL', label: 'Paracetamol' },
        { value: 'METFORMIN', label: 'Metformin' }
    ];
    readonly conditionOptions: OptionDef<PreExistingCondition>[] = [
        { value: 'DIABETES', label: 'Diabetes' },
        { value: 'ASTHMA', label: 'Asthma' },
        { value: 'HIGH_BLOOD_PRESSURE', label: 'High blood pressure' },
        { value: 'HEART_DISEASE', label: 'Heart disease' },
        { value: 'THYROID', label: 'Thyroid disorder' }
    ];

    // Regexes match the backend Bean Validation rules in PatientFormRequest.
    private readonly upper = /^[A-Z]+$/;
    private readonly numeric = /^\d+$/;
    private readonly phone = /^\+?[0-9\- ]+$/;

    readonly form = this.fb.nonNullable.group({
        firstName: ['', [Validators.required, Validators.pattern(this.upper)]],
        lastName: ['', [Validators.required, Validators.pattern(this.upper)]],
        dateOfBirth: ['', [Validators.required]],
        streetName: ['', [Validators.required, Validators.pattern(this.upper)]],
        streetNumber: ['', [Validators.required, Validators.pattern(this.numeric)]],
        city: ['', [Validators.required, Validators.pattern(this.upper)]],
        postalCode: ['', [Validators.required, Validators.pattern(this.numeric)]],
        phoneNumber: ['', [Validators.required, Validators.pattern(this.phone)]],
        emailAddress: ['', [Validators.email]],

        symptoms: this.fb.array<FormControl<boolean>>(
            this.symptomOptions.map(() => this.fb.nonNullable.control(false))
        ),
        otherSymptoms: [''],

        allergies: this.fb.array<FormControl<boolean>>(
            this.allergyOptions.map(() => this.fb.nonNullable.control(false))
        ),
        otherAllergies: [''],

        medications: this.fb.array<FormControl<boolean>>(
            this.medicationOptions.map(() => this.fb.nonNullable.control(false))
        ),
        otherMedications: [''],

        preExistingConditions: this.fb.array<FormControl<boolean>>(
            this.conditionOptions.map(() => this.fb.nonNullable.control(false))
        ),
        otherPreExistingConditions: ['']
    });

    get symptomsArray(): FormArray<FormControl<boolean>> {
        return this.form.controls.symptoms;
    }
    get allergiesArray(): FormArray<FormControl<boolean>> {
        return this.form.controls.allergies;
    }
    get medicationsArray(): FormArray<FormControl<boolean>> {
        return this.form.controls.medications;
    }
    get conditionsArray(): FormArray<FormControl<boolean>> {
        return this.form.controls.preExistingConditions;
    }

    isInvalid(path: string): boolean {
        const c = this.form.get(path);
        return !!c && c.invalid && (c.dirty || c.touched);
    }

    errorFor(path: string, fieldLabel: string): string | null {
        const c = this.form.get(path);
        if (!c || !this.isInvalid(path)) return null;
        if (c.errors?.['required']) return `${fieldLabel} is required.`;
        if (c.errors?.['pattern']) {
            const p = c.errors['pattern']?.requiredPattern;
            if (p?.includes('A-Z')) return `${fieldLabel} must contain only uppercase letters (A–Z).`;
            if (p?.includes('\\d') || p?.includes('[0-9')) return `${fieldLabel} must contain only digits.`;
            if (p?.includes('0-9') && p?.includes('+')) return `${fieldLabel} must be a valid phone number.`;
            return `${fieldLabel} has an invalid format.`;
        }
        if (c.errors?.['email']) return 'Email address must be a valid email.';
        return 'Invalid value.';
    }

    onSubmit(): void {
        this.errorMessage.set(null);
        this.form.markAllAsTouched();
        if (this.form.invalid || this.submitting()) return;

        const v = this.form.getRawValue();
        const payload: PatientFormRequest = {
            firstName: v.firstName,
            lastName: v.lastName,
            dateOfBirth: v.dateOfBirth,
            streetName: v.streetName,
            streetNumber: v.streetNumber,
            city: v.city,
            postalCode: v.postalCode,
            phoneNumber: v.phoneNumber,
            emailAddress: v.emailAddress ? v.emailAddress : null,
            symptoms: this.pick(v.symptoms, this.symptomOptions),
            otherSymptoms: v.otherSymptoms || null,
            allergies: this.pick(v.allergies, this.allergyOptions),
            otherAllergies: v.otherAllergies || null,
            medications: this.pick(v.medications, this.medicationOptions),
            otherMedications: v.otherMedications || null,
            preExistingConditions: this.pick(v.preExistingConditions, this.conditionOptions),
            otherPreExistingConditions: v.otherPreExistingConditions || null
        };

        this.submitting.set(true);
        this.api.submit(payload).subscribe({
            next: (res) => {
                this.submitting.set(false);
                this.submittedId.set(res.id);
                this.form.reset();
                this.symptomsArray.controls.forEach((c) => c.setValue(false));
                this.allergiesArray.controls.forEach((c) => c.setValue(false));
                this.medicationsArray.controls.forEach((c) => c.setValue(false));
                this.conditionsArray.controls.forEach((c) => c.setValue(false));
            },
            error: (err) => {
                this.submitting.set(false);
                this.errorMessage.set(this.resolveError(err));
            }
        });
    }

    submitAnother(): void {
        this.submittedId.set(null);
    }

    private pick<T extends string>(flags: boolean[], opts: OptionDef<T>[]): T[] {
        return opts.filter((_, i) => flags[i]).map((o) => o.value);
    }

    private resolveError(err: unknown): string {
        if (err instanceof HttpErrorResponse) {
            if (err.status === 0) return 'Could not reach the clinical service. Please try again later.';
            if (err.status === 400) return 'Some fields are invalid. Please review the form and try again.';
            return `Submission failed (HTTP ${err.status}).`;
        }
        return 'Submission failed. Please try again.';
    }
}
