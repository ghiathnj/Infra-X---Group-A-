import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const token = auth.token();
    const isLoginCall = req.url.endsWith('/api/auth/login');

    const authedReq =
        token && !isLoginCall
            ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
            : req;

    return next(authedReq).pipe(
        catchError((err) => {
            if (err.status === 401 && !isLoginCall) {
                auth.logout();
                router.navigate(['/login']);
            }
            return throwError(() => err);
        })
    );
};
