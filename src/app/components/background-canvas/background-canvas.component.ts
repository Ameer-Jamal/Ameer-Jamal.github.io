import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CosmicCanvasEngine, TOOLS_LIST } from './engine/cosmic-canvas-engine';
import { MousePower } from './models/cosmic.types';

@Component({
  selector: 'app-background-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './background-canvas.component.html'
})
export class BackgroundCanvasComponent implements OnInit, OnDestroy {
  @ViewChild('canvasRef', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly toolsList = TOOLS_LIST;
  private engine!: CosmicCanvasEngine;

  get isSandboxOpen(): boolean {
    return this.engine?.world.isSandboxOpen ?? false;
  }

  set isSandboxOpen(value: boolean) {
    if (this.engine) {
      this.engine.world.isSandboxOpen = value;
    }
  }

  get isSandboxPinned(): boolean {
    return this.engine?.world.isSandboxPinned ?? false;
  }

  set isSandboxPinned(value: boolean) {
    if (this.engine) {
      this.engine.world.isSandboxPinned = value;
    }
  }

  get activePower(): MousePower {
    return this.engine?.world.activePower ?? 'DEFAULT';
  }

  get nurseryStarsLabel(): string {
    const count = this.engine?.world.nurseryStarCount ?? 0;
    const max = this.engine?.world.performanceProfile?.maxNurseryStars ?? 0;
    return `${count} / ${max}`;
  }

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const canvas = this.canvasRef.nativeElement;
    const context = canvas.getContext('2d');
    if (!context) {
      console.warn('[ParticleCanvas] Canvas 2d context not supported.');
      return;
    }

    this.engine = new CosmicCanvasEngine(canvas, context);
    this.ngZone.runOutsideAngular(() => {
      this.engine.init();
    });
  }

  ngOnDestroy(): void {
    this.engine?.destroy();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (typeof document === 'undefined' || !this.engine) {
      return;
    }
    if (document.hidden) {
      this.engine.pauseAnimation();
      return;
    }
    this.ngZone.runOutsideAngular(() => {
      this.engine.startAnimation();
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.engine?.handleResize();
  }

  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    this.engine?.onPointerMove(event);
  }

  @HostListener('window:pointerleave', ['$event'])
  onPointerLeave(event: PointerEvent): void {
    this.engine?.onPointerLeave(event);
  }

  @HostListener('window:pointercancel', ['$event'])
  onPointerCancel(event: PointerEvent): void {
    this.engine?.onPointerCancel(event);
  }

  @HostListener('window:pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    this.engine?.onPointerDown(event);
  }

  @HostListener('window:pointerup', ['$event'])
  onPointerUp(event: PointerEvent): void {
    this.engine?.onPointerUp(event);
  }

  @HostListener('window:logo-blackhole-trigger')
  onLogoBlackholeTrigger(): void {
    this.engine?.onLogoBlackholeTrigger();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    this.engine?.onAyaKeyDown(event);
  }

  /** @deprecated Use onPointerMove — kept for unit tests */
  onMouseMove(event: MouseEvent): void {
    this.onPointerMove(event as PointerEvent);
  }

  /** @deprecated Use onPointerLeave — kept for unit tests */
  onMouseLeave(): void {
    this.engine?.onPointerLeave({ pointerType: 'mouse' } as PointerEvent);
  }

  /** @deprecated Use onPointerDown — kept for unit tests */
  onMouseDown(event: MouseEvent): void {
    this.onPointerDown(event as PointerEvent);
  }

  /** @deprecated Use onPointerUp — kept for unit tests */
  onMouseUp(event: MouseEvent): void {
    this.onPointerUp(event as PointerEvent);
  }

  toggleSandboxBar(): void {
    this.engine?.toggleSandboxBar();
  }

  toggleSandboxPin(): void {
    this.engine?.toggleSandboxPin();
  }

  selectPower(power: MousePower): void {
    this.engine?.selectPower(power);
  }

  clearSandboxElements(): void {
    this.engine?.clearSandboxElements();
  }

  /** Test-only access to engine internals */
  getEngineForTests(): CosmicCanvasEngine {
    return this.engine;
  }
}
