import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap, throwError, catchError } from 'rxjs';

import { environment } from '../../environments/environment';
import { decodeJwt, isExpired, JwtPayload } from './jwt.util';

const TOKEN_KEY = 'auth_token';
const ALLOWED_ROLES = ['ROLE_ADMIN', 'ROLE_DOCTOR'] as const;

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly http = inject(HttpClient);

    private readonly tokenSignal = signal<string | null>(this.readToken());
    readonly token = this.tokenSignal.asReadonly();
    readonly payload = computed<JwtPayload | null>(() => decodeJwt(this.tokenSignal()));
    readonly isAuthenticated = computed(() => this.hasValidSession());

    login(credentials: LoginRequest): Observable<JwtPayload> {
        return this.http
            .post<LoginResponse>(`${environment.apiBaseUrl}/api/auth/login`, credentials)
            .pipe(
                map((res) => {
                    if (!res?.token) throw new Error('Malformed login response from server.');
                    const payload = decodeJwt(res.token);
                    if (!payload) throw new Error('Received an invalid token.');
                    if (isExpired(payload)) throw new Error('Received an expired token.');
                    if (!this.hasAllowedRole(payload)) {
                        throw new Error('This account is not authorized to access the admin area.');
                    }
                    this.saveToken(res.token);
                    return payload;
                }),
                catchError((err) => throwError(() => err))
            );
    }

    logout(): void {
        this.clearToken();
    }

    hasValidSession(): boolean {
        const token = this.tokenSignal();
        const payload = decodeJwt(token);
        return !!token && !!payload && !isExpired(payload) && this.hasAllowedRole(payload);
    }

    private hasAllowedRole(payload: JwtPayload | null): boolean {
        const roles = payload?.roles ?? [];
        return roles.some((r) => (ALLOWED_ROLES as readonly string[]).includes(r));
    }

    private readToken(): string | null {
        try {
            return localStorage.getItem(TOKEN_KEY);
        } catch {
            return null;
        }
    }

    private saveToken(token: string): void {
        localStorage.setItem(TOKEN_KEY, token);
        this.tokenSignal.set(token);
    }

    private clearToken(): void {
        localStorage.removeItem(TOKEN_KEY);
        this.tokenSignal.set(null);
    }
}
