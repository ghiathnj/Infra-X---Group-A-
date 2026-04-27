import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../core/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    templateUrl: './login.component.html',
    styleUrl: './login.component.css'
})
export class LoginComponent {
    private readonly fb = inject(FormBuilder);
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);

    readonly loading = signal(false);
    readonly errorMessage = signal<string | null>(null);

    readonly form = this.fb.nonNullable.group({
        username: ['', [Validators.required, Validators.minLength(2)]],
        password: ['', [Validators.required, Validators.minLength(3)]]
    });

    onSubmit(): void {
        this.errorMessage.set(null);
        this.form.markAllAsTouched();
        if (this.form.invalid || this.loading()) return;

        this.loading.set(true);
        this.auth.login(this.form.getRawValue()).subscribe({
            next: () => {
                this.loading.set(false);
                this.router.navigate(['/dashboard']);
            },
            error: (err) => {
                this.loading.set(false);
                this.errorMessage.set(this.resolveError(err));
            }
        });
    }

    private resolveError(err: unknown): string {
        if (err instanceof HttpErrorResponse) {
            if (err.status === 0) {
                return 'Could not reach the authentication service. Please try again later.';
            }
            if (err.status === 401) return 'Invalid username or password.';
            if (err.status === 403) return 'This account is not authorized.';
            const body = typeof err.error === 'string' ? err.error : err.error?.message;
            return body || `Login failed (HTTP ${err.status}).`;
        }
        if (err instanceof Error && err.message) return err.message;
        return 'Login failed. Please try again.';
    }

    isInvalid(field: 'username' | 'password'): boolean {
        const c = this.form.controls[field];
        return c.invalid && (c.dirty || c.touched);
    }

    errorFor(field: 'username' | 'password'): string | null {
        const c = this.form.controls[field];
        if (!this.isInvalid(field)) return null;
        if (c.errors?.['required']) return `${field === 'username' ? 'Username' : 'Password'} is required.`;
        if (c.errors?.['minlength']) return `${field === 'username' ? 'Username' : 'Password'} is too short.`;
        return 'Invalid value.';
    }
}
