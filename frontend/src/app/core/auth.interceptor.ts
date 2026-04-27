import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const token = auth.token();
    const isLoginCall = req.url.endsWith('/api/auth/login');

    // Only attach the JWT to our own backends. Third-party calls
    // (e.g. Open-Meteo on the landing page) must not receive the token —
    // both for privacy and because foreign servers may reject unexpected
    // Authorization headers.
    const isInternalCall =
        req.url.startsWith(environment.apiBaseUrl) ||
        req.url.startsWith(environment.apiClinicalUrl);

    const authedReq =
        token && isInternalCall && !isLoginCall
            ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
            : req;

    return next(authedReq).pipe(
        catchError((err) => {
            // Only treat 401 from our own backends as a session timeout.
            if (err.status === 401 && isInternalCall && !isLoginCall) {
                auth.logout();
                router.navigate(['/login']);
            }
            return throwError(() => err);
        })
    );
};
