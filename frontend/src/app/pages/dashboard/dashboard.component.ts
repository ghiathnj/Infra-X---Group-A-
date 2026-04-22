import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);

    readonly username = computed(() => this.auth.payload()?.sub ?? 'doctor');
    readonly roles = computed(() => (this.auth.payload()?.roles ?? []).join(', '));
    readonly expiresAt = computed(() => {
        const exp = this.auth.payload()?.exp;
        return exp ? new Date(exp * 1000).toLocaleString() : '—';
    });

    logout(): void {
        this.auth.logout();
        this.router.navigate(['/login']);
    }
}
