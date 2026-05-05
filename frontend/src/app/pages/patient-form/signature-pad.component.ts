import {
    AfterViewInit,
    Component,
    ElementRef,
    forwardRef,
    HostListener,
    ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
    selector: 'app-signature-pad',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './signature-pad.component.html',
    styleUrl: './signature-pad.component.css',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => SignaturePadComponent),
            multi: true
        }
    ]
})
export class SignaturePadComponent implements ControlValueAccessor, AfterViewInit {
    @ViewChild('canvas', { static: true })
    private readonly canvasRef!: ElementRef<HTMLCanvasElement>;

    private ctx!: CanvasRenderingContext2D;
    private drawing = false;
    private hasInk = false;
    private lastX = 0;
    private lastY = 0;

    private onChange: (value: string) => void = () => {};
    private onTouched: () => void = () => {};
    private disabled = false;

    ngAfterViewInit(): void {
        const canvas = this.canvasRef.nativeElement;
        // The bitmap (canvas.width / canvas.height) is set on the element directly
        // for a crisp backing store; CSS scales the visual size responsively.
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        this.ctx = ctx;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#0f172a';
    }

    @HostListener('window:resize')
    onWindowResize(): void {
        // Bitmap dimensions are fixed; getBoundingClientRect handles CSS resizing
        // at event time, so no redraw is necessary here.
    }

    onPointerDown(event: PointerEvent): void {
        if (this.disabled) return;
        event.preventDefault();
        const canvas = this.canvasRef.nativeElement;
        canvas.setPointerCapture(event.pointerId);
        this.drawing = true;
        const { x, y } = this.toCanvasCoords(event);
        this.lastX = x;
        this.lastY = y;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        // A dot on click without movement.
        this.ctx.lineTo(x + 0.01, y + 0.01);
        this.ctx.stroke();
        this.hasInk = true;
    }

    onPointerMove(event: PointerEvent): void {
        if (!this.drawing || this.disabled) return;
        event.preventDefault();
        const { x, y } = this.toCanvasCoords(event);
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        this.lastX = x;
        this.lastY = y;
    }

    onPointerUp(event: PointerEvent): void {
        if (!this.drawing) return;
        this.drawing = false;
        const canvas = this.canvasRef.nativeElement;
        if (canvas.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }
        this.emitValue();
        this.onTouched();
    }

    clear(): void {
        if (this.disabled) return;
        const canvas = this.canvasRef.nativeElement;
        this.ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.hasInk = false;
        this.onChange('');
        this.onTouched();
    }

    private toCanvasCoords(event: PointerEvent): { x: number; y: number } {
        const canvas = this.canvasRef.nativeElement;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        };
    }

    private emitValue(): void {
        if (!this.hasInk) {
            this.onChange('');
            return;
        }
        this.onChange(this.canvasRef.nativeElement.toDataURL('image/png'));
    }

    // ControlValueAccessor

    writeValue(value: string | null): void {
        if (!value) {
            // Skip clearing before the canvas is ready (initial form value).
            if (this.ctx) {
                const canvas = this.canvasRef.nativeElement;
                this.ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            this.hasInk = false;
        }
        // Non-empty values aren't restored visually — the form never seeds
        // a previous signature back into the pad in this app.
    }

    registerOnChange(fn: (value: string) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.disabled = isDisabled;
    }
}
