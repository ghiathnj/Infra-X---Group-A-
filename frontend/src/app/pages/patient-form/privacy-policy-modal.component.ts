import { Component, HostListener, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-privacy-policy-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './privacy-policy-modal.component.html',
    styleUrl: './privacy-policy-modal.component.css'
})
export class PrivacyPolicyModalComponent {
    readonly closed = output<void>();
    readonly accepted = output<void>();

    @HostListener('document:keydown.escape')
    onEsc(): void {
        this.closed.emit();
    }

    onOverlayClick(event: MouseEvent): void {
        if (event.target === event.currentTarget) {
            this.closed.emit();
        }
    }
}
