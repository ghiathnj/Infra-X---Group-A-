import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CurrentWeather, WeatherService } from '../../core/weather.service';
import { DOCTOR_TIPS } from '../../core/doctor-tips';

const TIP_ROTATION_MS = 5000;

@Component({
    selector: 'app-landing',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './landing.component.html',
    styleUrl: './landing.component.css'
})
export class LandingComponent implements OnInit {
    private readonly weather = inject(WeatherService);
    private readonly destroyRef = inject(DestroyRef);

    readonly weatherData = signal<CurrentWeather | null>(null);
    readonly weatherError = signal(false);

    private readonly tipIndex = signal(0);
    readonly currentTip = computed(() => DOCTOR_TIPS[this.tipIndex() % DOCTOR_TIPS.length]);
    readonly tipNumber = computed(() => (this.tipIndex() % DOCTOR_TIPS.length) + 1);
    readonly totalTips = DOCTOR_TIPS.length;

    ngOnInit(): void {
        // 1. Fire one weather request on load.
        this.weather.getKarlsruhe().subscribe({
            next: (w) => this.weatherData.set(w),
            error: () => this.weatherError.set(true)
        });

        // 2. Rotate doctor tips every 5 seconds.
        // takeUntilDestroyed ensures the timer is cancelled when the user
        // navigates away — no leak.
        interval(TIP_ROTATION_MS)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.tipIndex.update((i) => i + 1));
    }
}
