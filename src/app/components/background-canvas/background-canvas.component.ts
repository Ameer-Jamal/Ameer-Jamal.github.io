import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CosmicCanvasEngine, TOOLS_LIST } from './engine/cosmic-canvas-engine';
import { MousePower, SandboxTool } from './models/cosmic.types';
import { startAyaDance } from './engine/aya-easter-egg';
import { CosmicContextMenuComponent } from './cosmic-context-menu/cosmic-context-menu.component';
import {
  findSandboxContextTarget,
  SandboxContextTarget,
  vaporizeSandboxContextTarget
} from './engine/sandbox-context-target';

@Component({
  selector: 'app-background-canvas',
  standalone: true,
  imports: [CommonModule, CosmicContextMenuComponent],
  templateUrl: './background-canvas.component.html'
})
export class BackgroundCanvasComponent implements OnInit, OnDestroy {
  @ViewChild('canvasRef', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly toolsList = TOOLS_LIST;
  private engine!: CosmicCanvasEngine;
  private explicitTouchInputEnabled = false;
  private activeTouchId: number | null = null;
  private removeTouchListeners: Array<() => void> = [];
  isSandboxOpen = false;

  showContextMenu = false;
  contextMenuX = 0;
  contextMenuY = 0;
  contextTarget: SandboxContextTarget | null = null;

  private readonly recentlyUsedTools: MousePower[] = ['DEFAULT', 'BLACK_HOLE', 'PLANET', 'METEOR', 'QUANTUM_SPLITTER'];
  quickTools: SandboxTool[] = [];

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
    this.syncSandboxOpenState();

    this.setupTouchInput();
    this.updateQuickTools();

    (window as any).__triggerAyaEasterEgg = () => {
      if (this.engine) {
        this.ngZone.runOutsideAngular(() => {
          startAyaDance(this.engine);
        });
      }
    };
  }

  ngOnDestroy(): void {
    this.engine?.destroy();
    this.removeTouchListeners.forEach((remove) => remove());
    this.removeTouchListeners = [];
    if (typeof window !== 'undefined') {
      delete (window as any).__triggerAyaEasterEgg;
    }
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

  @HostListener('window:pointerenter', ['$event'])
  onPointerEnter(event: PointerEvent): void {
    if (this.shouldIgnorePointerEvent(event)) return;
    this.engine?.onPointerEnter(event);
  }

  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (this.shouldIgnorePointerEvent(event)) return;
    this.engine?.onPointerMove(event);
  }

  @HostListener('window:pointerleave', ['$event'])
  onPointerLeave(event: PointerEvent): void {
    if (this.shouldIgnorePointerEvent(event)) return;
    this.engine?.onPointerLeave(event);
  }

  @HostListener('window:pointercancel', ['$event'])
  onPointerCancel(event: PointerEvent): void {
    if (this.shouldIgnorePointerEvent(event)) return;
    this.engine?.onPointerCancel(event);
  }

  @HostListener('window:pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    if (this.shouldIgnorePointerEvent(event)) return;
    if (event.button === 2 || this.isContextMenuTarget(event.target)) {
      return;
    }

    if (this.showContextMenu) {
      this.closeContextMenu();
      return;
    }

    this.engine?.onPointerDown(event);
    this.syncSandboxOpenState();
  }

  @HostListener('window:pointerup', ['$event'])
  onPointerUp(event: PointerEvent): void {
    if (this.shouldIgnorePointerEvent(event)) return;
    if (event.button === 2 || this.isContextMenuTarget(event.target)) {
      return;
    }

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
    if (!this.engine) {
      return;
    }
    this.engine.toggleSandboxBar();
    this.syncSandboxOpenState();
  }

  toggleSandboxPin(): void {
    this.engine?.toggleSandboxPin();
  }

  selectPower(power: MousePower): void {
    this.engine?.selectPower(power);

    const existingIndex = this.recentlyUsedTools.indexOf(power);
    if (existingIndex !== -1) {
      this.recentlyUsedTools.splice(existingIndex, 1);
    }
    this.recentlyUsedTools.unshift(power);
    this.recentlyUsedTools.splice(5);
    this.updateQuickTools();
  }

  clearSandboxElements(): void {
    this.engine?.clearSandboxElements();
  }

  get isGameMode(): boolean {
    if (typeof document !== 'undefined') {
      return document.body.classList.contains('is-game-mode');
    }
    return false;
  }

  toggleGameMode(event: Event): void {
    if (typeof document !== 'undefined') {
      const checkbox = event.target as HTMLInputElement;
      if (checkbox.checked) {
        document.body.classList.add('is-game-mode');
      } else {
        document.body.classList.remove('is-game-mode');
      }
    }
  }

  /** Test-only access to engine internals */
  getEngineForTests(): CosmicCanvasEngine {
    return this.engine;
  }

  private setupTouchInput(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.explicitTouchInputEnabled = (
      navigator.maxTouchPoints > 0 ||
      window.matchMedia?.('(pointer: coarse)').matches
    );

    if (!this.explicitTouchInputEnabled) {
      return;
    }

    const addTouchListener = <K extends keyof WindowEventMap>(
      type: K,
      listener: (event: WindowEventMap[K]) => void
    ): void => {
      window.addEventListener(type, listener as EventListener, { passive: false });
      this.removeTouchListeners.push(() => window.removeEventListener(type, listener as EventListener));
    };

    addTouchListener('touchstart', (event) => this.handleTouchStart(event));
    addTouchListener('touchmove', (event) => this.handleTouchMove(event));
    addTouchListener('touchend', (event) => this.handleTouchEnd(event));
    addTouchListener('touchcancel', (event) => this.handleTouchCancel(event));
  }

  private shouldIgnorePointerEvent(event: PointerEvent): boolean {
    return this.explicitTouchInputEnabled && event.pointerType === 'touch' && this.activeTouchId !== null;
  }

  private shouldCaptureTouch(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return true;
    }

    return !target.closest('#main article, .sandbox-panel, .sandbox-trigger, .sandbox-trigger-hint, input, textarea, select, button, a, label');
  }


  private buildSyntheticPointer(type: string, touch: Touch, target: EventTarget | null): PointerEvent {
    return {
      type,
      clientX: touch.clientX,
      clientY: touch.clientY,
      pointerType: 'touch',
      target
    } as PointerEvent;
  }

  private handleTouchStart(event: TouchEvent): void {
    if (!this.engine || !event.changedTouches.length || !this.shouldCaptureTouch(event.target)) {
      return;
    }

    const touch = event.changedTouches[0];
    this.activeTouchId = touch.identifier;
    event.preventDefault();
    const synthetic = this.buildSyntheticPointer('pointerdown', touch, event.target);
    this.engine.onPointerEnter(synthetic);
    this.engine.onPointerDown(synthetic);
    this.syncSandboxOpenState();
  }

  private handleTouchMove(event: TouchEvent): void {
    if (!this.engine || this.activeTouchId === null) {
      return;
    }

    const touch = Array.from(event.changedTouches).find((item) => item.identifier === this.activeTouchId);
    if (!touch) {
      return;
    }

    event.preventDefault();
    this.engine.onPointerMove(this.buildSyntheticPointer('pointermove', touch, event.target));
  }

  private handleTouchEnd(event: TouchEvent): void {
    if (!this.engine || this.activeTouchId === null) {
      return;
    }

    const touch = Array.from(event.changedTouches).find((item) => item.identifier === this.activeTouchId);
    if (!touch) {
      return;
    }

    event.preventDefault();
    this.engine.onPointerUp(this.buildSyntheticPointer('pointerup', touch, event.target));
    this.activeTouchId = null;
  }

  private handleTouchCancel(event: TouchEvent): void {
    if (!this.engine || this.activeTouchId === null) {
      return;
    }

    const touch = Array.from(event.changedTouches).find((item) => item.identifier === this.activeTouchId);
    if (!touch) {
      return;
    }

    event.preventDefault();
    this.engine.onPointerCancel(this.buildSyntheticPointer('pointercancel', touch, event.target));
    this.activeTouchId = null;
  }

  private syncSandboxOpenState(): void {
    this.isSandboxOpen = this.engine?.world.isSandboxOpen ?? false;
  }

  findTargetAt(x: number, y: number): SandboxContextTarget | null {
    return this.engine ? findSandboxContextTarget(this.engine, x, y) : null;
  }

  deleteTargetObject(): void {
    if (this.engine && this.contextTarget) {
      vaporizeSandboxContextTarget(this.engine, this.contextTarget);
    }
    this.closeContextMenu();
  }

  toggleGameModeFromMenu(): void {
    if (typeof document !== 'undefined') {
      if (this.isGameMode) {
        document.body.classList.remove('is-game-mode');
      } else {
        document.body.classList.add('is-game-mode');
      }
    }
  }

  updateQuickTools(): void {
    this.quickTools = this.recentlyUsedTools
      .map(id => this.toolsList.find(tool => tool.id === id))
      .filter((tool): tool is SandboxTool => tool !== undefined);
  }

  selectPowerFromMenu(power: MousePower): void {
    this.selectPower(power);
    this.closeContextMenu();
  }

  resetFromContextMenu(): void {
    this.clearSandboxElements();
    this.closeContextMenu();
  }

  triggerBigBangFromContextMenu(): void {
    this.onLogoBlackholeTrigger();
    this.closeContextMenu();
  }

  toggleGameModeFromContextMenu(): void {
    this.toggleGameModeFromMenu();
    this.closeContextMenu();
  }

  @HostListener('window:contextmenu', ['$event'])
  onContextMenu(event: MouseEvent): void {
    if (!this.engine) return;

    const target = event.target;
    if (target instanceof Element && target.closest('#main article, .sandbox-panel, .sandbox-trigger, .sandbox-trigger-hint, input, textarea, select, button, a, label')) {
      return;
    }

    event.preventDefault();
    this.contextTarget = this.findTargetAt(event.clientX, event.clientY);
    this.contextMenuX = event.clientX;
    this.contextMenuY = event.clientY;
    this.showContextMenu = true;
  }

  @HostListener('window:click', ['$event'])
  onWindowClick(): void {
    this.closeContextMenu();
  }

  private closeContextMenu(): void {
    this.showContextMenu = false;
    this.contextTarget = null;
  }

  private isContextMenuTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest('app-cosmic-context-menu') !== null;
  }
}
