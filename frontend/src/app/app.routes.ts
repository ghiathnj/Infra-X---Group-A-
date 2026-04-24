import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { publicGuard } from './core/public.guard';

export const routes: Routes = [
    {
        // Public landing page: choose between patient intake and doctor login.
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
            import('./pages/landing/landing.component').then((m) => m.LandingComponent)
    },
    {
        path: 'login',
        canActivate: [publicGuard],
        loadComponent: () =>
            import('./pages/login/login.component').then((m) => m.LoginComponent)
    },
    {
        path: 'dashboard',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent)
    },
    {
        // Public patient intake form — no guard, no auth required.
        path: 'patient-form',
        loadComponent: () =>
            import('./pages/patient-form/patient-form.component').then((m) => m.PatientFormComponent)
    },
    { path: '**', redirectTo: '' }
];
