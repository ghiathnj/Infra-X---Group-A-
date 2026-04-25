import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

// Karlsruhe coordinates (the clinic's location).
const LAT = 49.0069;
const LON = 8.4037;

const OPEN_METEO_URL =
    `https://api.open-meteo.com/v1/forecast?` +
    `latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,weather_code,wind_speed_10m` +
    `&timezone=Europe%2FBerlin`;

interface OpenMeteoResponse {
    current: {
        time: string;
        temperature_2m: number;
        weather_code: number;
        wind_speed_10m: number;
    };
    current_units?: {
        temperature_2m: string;
        wind_speed_10m: string;
    };
}

export interface CurrentWeather {
    tempC: number;
    description: string;
    icon: string;       // emoji
    windKmh: number;
    observedAt: string; // local ISO time
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
    private readonly http = inject(HttpClient);

    /** Fetches current weather for Karlsruhe from Open-Meteo (no API key required). */
    getKarlsruhe(): Observable<CurrentWeather> {
        return this.http.get<OpenMeteoResponse>(OPEN_METEO_URL).pipe(
            map((r) => ({
                tempC: r.current.temperature_2m,
                description: this.codeToText(r.current.weather_code),
                icon: this.codeToIcon(r.current.weather_code),
                windKmh: r.current.wind_speed_10m,
                observedAt: r.current.time
            }))
        );
    }

    // WMO weather code mapping — coarse but readable.
    private codeToText(code: number): string {
        if (code === 0) return 'Clear sky';
        if (code <= 3) return 'Partly cloudy';
        if (code <= 48) return 'Foggy';
        if (code <= 57) return 'Light drizzle';
        if (code <= 67) return 'Rain';
        if (code <= 77) return 'Snow';
        if (code <= 86) return 'Showers';
        return 'Thunderstorm';
    }

    private codeToIcon(code: number): string {
        if (code === 0) return '☀️';
        if (code <= 3) return '⛅';
        if (code <= 48) return '🌫️';
        if (code <= 57) return '🌦️';
        if (code <= 67) return '🌧️';
        if (code <= 77) return '❄️';
        if (code <= 86) return '🌧️';
        return '⛈️';
    }
}
