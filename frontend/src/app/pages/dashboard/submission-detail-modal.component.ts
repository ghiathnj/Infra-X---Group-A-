import {
    Component,
    HostListener,
    inject,
    input,
    output,
    signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { PatientFormResponse } from '../../core/patient-form.service';
import { SubmissionsService } from '../../core/submissions.service';

@Component({
    selector: 'app-submission-detail-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './submission-detail-modal.component.html',
    styleUrl: './submission-detail-modal.component.css'
})
export class SubmissionDetailModalComponent {
    private readonly api = inject(SubmissionsService);

    readonly submission = input.required<PatientFormResponse>();
    readonly closed = output<void>();
    readonly saved = output<PatientFormResponse>();

    readonly diagnosis = signal('');
    readonly notes = signal('');
    readonly saving = signal(false);
    readonly error = signal<string | null>(null);

    ngOnInit(): void {
        const s = this.submission();
        this.diagnosis.set(s.diagnosis ?? '');
        this.notes.set(s.notes ?? '');
    }

    @HostListener('document:keydown.escape')
    onEsc(): void {
        if (!this.saving()) this.closed.emit();
    }

    onOverlayClick(event: MouseEvent): void {
        // Only close when the click hits the overlay itself, not the modal content.
        if (event.target === event.currentTarget && !this.saving()) {
            this.closed.emit();
        }
    }

    save(): void {
        if (this.saving()) return;
        this.error.set(null);
        this.saving.set(true);
        this.api
            .updateAdminFields(this.submission().id, {
                diagnosis: this.diagnosis().trim() || null,
                notes: this.notes().trim() || null
            })
            .subscribe({
                next: (updated) => {
                    this.saving.set(false);
                    this.saved.emit(updated);
                },
                error: (err) => {
                    this.saving.set(false);
                    this.error.set(this.resolveError(err));
                }
            });
    }

    private resolveError(err: unknown): string {
        if (err instanceof HttpErrorResponse) {
            if (err.status === 0) return 'Could not reach the clinical service.';
            if (err.status === 401 || err.status === 403) return 'Your session expired. Please log in again.';
            if (err.status === 404) return 'This submission no longer exists.';
            return `Save failed (HTTP ${err.status}).`;
        }
        return 'Save failed. Please try again.';
    }
}
