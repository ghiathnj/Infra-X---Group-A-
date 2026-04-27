export interface JwtPayload {
    sub?: string;
    roles?: string[];
    iat?: number;
    exp?: number;
}

function base64UrlDecode(input: string): string {
    const pad = input.length % 4;
    const padded = pad ? input + '='.repeat(4 - pad) : input;
    const normalized = padded.replace(/-/g, '+').replace(/_/g, '/');
    return atob(normalized);
}

export function decodeJwt(token: string | null | undefined): JwtPayload | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        return JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
    } catch {
        return null;
    }
}

export function isExpired(payload: JwtPayload | null): boolean {
    if (!payload || typeof payload.exp !== 'number') return true;
    return payload.exp * 1000 <= Date.now();
}
