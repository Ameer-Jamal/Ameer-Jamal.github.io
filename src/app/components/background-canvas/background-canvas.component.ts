import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
  downgradeTier,
  getProfileForTier,
  PerformanceProfile,
  PerformanceTier,
  resolvePerformanceProfile,
  upgradeTier
} from '../../utils/performance-profile';
import { SpatialHash } from '../../utils/spatial-hash';

type GameState = 'DRIFT' | 'SWARM' | 'CHARGING' | 'SINGULARITY' | 'EXPLODING' | 'MOON_DANCE';

type MousePower = 'DEFAULT' | 'BLACK_HOLE' | 'PAINT_BRUSH' | 'REPELLER' | 'TESLA_DISCHARGE' | 'WORMHOLE' | 'NEBULAR_WIND' | 'TIME_DILATION';
type SandboxChargeTier = 'tap' | 'charged' | 'super';

interface SandboxBlackhole {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  timer: number;
  maxTimer: number;
  pullRadius: number;
  gravityStrength: number;
}

interface Wormhole {
  x: number;
  y: number;
  radius: number;
  type: 'ENTRY' | 'EXIT';
  pulsePhase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVx: number;
  baseVy: number;
  radius: number;
  baseRadius: number;
  colorBlend: number;   // 1.0 = neon flash, decays to 0.0
  wobbleTimer: number;  // countdown for wave ripple oscillation wobble
  colorPrefix: string;  // Particle's unique cosmic color tint
  flockable: boolean;   // Whether the star groups up or drifts independently
  
  // Star Life Cycle
  life: number;         // 1.0 down to 0.0 (depletes over time)
  birthProgress: number;// 0.0 to 1.0 (growing size at birth)
  deathProgress: number;// 0.0 to 1.0 (shrinking/fading at death)
  isDying: boolean;

  // Grouping dynamics
  behaviorState: 'CRUISE' | 'DECELERATE' | 'BURST';
  behaviorTimer: number;
  speedFactor: number;
  isNursery?: boolean;
}

interface TwinkleStar {
  x: number;
  y: number;
  radius: number;
  phase: number;
  twinkleSpeed: number;
  color: string; // soft color tint (white, yellow, cyan, purple)
  isPulsar: boolean;
  pulsarPhase: number;
}

interface SpaceDust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  alpha: number;
  color: string; // e.g. "0, 240, 255"
}

interface Lightning {
  segments: { x: number; y: number }[];
  alpha: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  alpha: number;
  colorPrefix: string;
}

interface NebulaCloud {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  colorBase: string;
  maxOpacity: number;
  phase: number;
  scalePhase: number;
}

interface SpaceComet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  active: boolean;
  speed: number;
  color: string;
}

interface BackgroundBlackhole {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  timer: number;
  maxTimer: number;
}

interface BackgroundGalaxy {
  x: number;
  y: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  arms: number;
  starCount: number;
  seed: number;
}

interface CosmicEasterEgg {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  points: { x: number; y: number }[];
  connections: [number, number][];
}


@Component({
  selector: 'app-background-canvas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sandbox-container">
      <!-- Trigger Button (Curious glowing blue dot easter egg) -->
      <div class="sandbox-trigger-wrapper">
        <span *ngIf="!isSandboxOpen" class="sandbox-trigger-hint">? ➔</span>
        <button class="sandbox-trigger" (click)="toggleSandboxBar()" aria-label="Toggle Sandbox Mode">
          <div class="pulsar-icon">
            <span class="pulsar-icon__core"></span>
            <span class="pulsar-icon__ring"></span>
          </div>
        </button>
      </div>

      <!-- Sandbox Control Panel -->
      <div class="sandbox-panel" [class.sandbox-panel--open]="isSandboxOpen">
        <button
          class="sandbox-panel__close"
          type="button"
          (click)="toggleSandboxBar()"
          aria-label="Close sandbox panel">
          <span class="sandbox-panel__close-icon" aria-hidden="true"></span>
        </button>
        <div class="sandbox-panel__header">
          <div class="sandbox-panel__header-row">
            <span class="sandbox-panel__title">SANDBOX UNIVERSE CREATOR</span>
            <button
              class="sandbox-pin"
              type="button"
              [class.sandbox-pin--active]="isSandboxPinned"
              (click)="toggleSandboxPin()"
              [attr.aria-pressed]="isSandboxPinned"
              [attr.aria-label]="isSandboxPinned ? 'Unpin sandbox panel' : 'Pin sandbox panel'">
              <i class="fas fa-thumbtack sandbox-pin__icon" aria-hidden="true"></i>
            </button>
          </div>
          <span class="sandbox-panel__subtitle">Place objects, switch tools, combine powers — CLEAR resets the world</span>
          <span *ngIf="activePower === 'PAINT_BRUSH'" class="sandbox-panel__nursery-count">{{ nurseryStarsLabel }} nursery stars</span>
        </div>
        <div class="sandbox-panel__body">
          <div class="sandbox-panel__tools">
            <button 
              *ngFor="let tool of toolsList" 
              class="sandbox-tool" 
              [class.sandbox-tool--active]="activePower === tool.id"
              (click)="selectPower(tool.id)">
              <span class="sandbox-tool__icon">{{ tool.icon }}</span>
              <div class="sandbox-tool__info">
                <span class="sandbox-tool__name">{{ tool.name }}</span>
                <span class="sandbox-tool__desc">{{ tool.desc }}</span>
              </div>
            </button>
          </div>
          <div class="sandbox-panel__actions">
            <span class="sandbox-panel__hint">💡 Psst... try clicking the logo!</span>
            <button class="sandbox-action-btn" (click)="clearSandboxElements()">CLEAR SIMULATION</button>
          </div>
        </div>
      </div>
      
      <canvas #canvasRef id="bg-canvas"></canvas>
    </div>
  `
})
export class BackgroundCanvasComponent implements OnInit, OnDestroy {
  @ViewChild('canvasRef', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  
  // Game state engine
  private state: GameState = 'DRIFT';
  private stateTimer = 0; // multi-purpose timer for state transitions

  // Cosmic Arrays
  private particles: Particle[] = [];
  private backgroundStars: TwinkleStar[] = [];
  private spaceDust: SpaceDust[] = [];
  private nebulas: NebulaCloud[] = [];
  private sparks: Spark[] = [];
  private shockwaves: Shockwave[] = [];
  private lightnings: Lightning[] = [];
  private shootingStars: ShootingStar[] = [];
  private comets: SpaceComet[] = [];
  private backgroundGalaxies: BackgroundGalaxy[] = [];
  private easterEggs: CosmicEasterEgg[] = [];
  private uiAnchors: { x: number; y: number }[] = [];
  private lastAnchorUpdate = 0;

  // Logo Easter Egg dynamics
  private isLogoBlackholeActive = false;
  private logoBlackholeTimer = 0;
  private logoElements: HTMLElement[] = [];
  private logoOrigPositions: { dx: number; dy: number }[] = [];
  private pageExplodeActive = false;
  private pageExplodeTimer = 0;
  private screenFlash = 0;
  private blackoutAlpha = 0.0;

  // Sandbox Simulator dynamics
  public isSandboxOpen = false;
  public isSandboxPinned = false;
  public activePower: MousePower = 'DEFAULT';
  private sandboxBlackholes: SandboxBlackhole[] = [];
  private wormholes: Wormhole[] = [];
  private nurseryStarCount = 0;
  private paintHoldFrame = 0;

  public get nurseryStarsLabel(): string {
    return `${this.nurseryStarCount} / ${this.maxNurseryStars}`;
  }

  private get maxNurseryStars(): number {
    return this.performanceProfile.maxNurseryStars;
  }

  public toolsList: { id: MousePower; name: string; desc: string; icon: string }[] = [
    { id: 'DEFAULT', name: 'Nova Strike', desc: 'Hold to charge, release shockwave or Super Move — blasts stars into wormholes', icon: '⚡' },
    { id: 'BLACK_HOLE', name: 'Event Horizon', desc: 'Place gravity wells that persist — sling stars into wormholes', icon: '🕳️' },
    { id: 'PAINT_BRUSH', name: 'Stellar Nursery', desc: 'Hold to spray stars until cap, release for a starburst', icon: '🎨' },
    { id: 'REPELLER', name: 'Anti-Gravity', desc: 'Hold to repel and spin stars, release for inversion nova', icon: '🧲' },
    { id: 'TESLA_DISCHARGE', name: 'Tesla Discharge', desc: 'Hold to charge, release a Tesla Storm', icon: '⚡' },
    { id: 'WORMHOLE', name: 'Wormhole Gate', desc: 'Tap to place portals — they stay until CLEAR', icon: '🌀' },
    { id: 'NEBULAR_WIND', name: 'Nebular Wind', desc: 'Hold to blow stars, release a cosmic jet', icon: '🌬️' },
    { id: 'TIME_DILATION', name: 'Chrono Well', desc: 'Hold to slow time, release a time freeze ripple', icon: '⏳' }
  ];

  // Constellation Easter Egg templates
  private readonly constellationTemplates = [
    {
      // Orion (Hourglass hunt)
      points: [
        { x: -0.4, y: -0.6 }, // Bellatrix
        { x: 0.4, y: -0.5 },  // Betelgeuse
        { x: -0.3, y: 0.6 },  // Rigel
        { x: 0.3, y: 0.5 },   // Saiph
        { x: -0.15, y: 0.0 }, // Belt 1
        { x: 0.0, y: 0.0 },   // Belt 2
        { x: 0.15, y: 0.0 },  // Belt 3
        { x: -0.45, y: -0.1 }, // Bow top
        { x: -0.48, y: 0.1 }   // Bow bottom
      ],
      connections: [
        [0, 1] as [number, number], [0, 4] as [number, number], [1, 6] as [number, number],
        [2, 4] as [number, number], [3, 6] as [number, number], [2, 3] as [number, number],
        [4, 5] as [number, number], [5, 6] as [number, number],
        [7, 8] as [number, number], [0, 7] as [number, number]
      ]
    },
    {
      // Ursa Major (Big Dipper)
      points: [
        { x: -0.8, y: -0.5 },
        { x: -0.5, y: -0.35 },
        { x: -0.2, y: -0.25 },
        { x: 0.15, y: -0.05 }, // Bowl top left
        { x: 0.12, y: 0.4 },   // Bowl bottom left
        { x: 0.65, y: 0.4 },   // Bowl bottom right
        { x: 0.7, y: -0.05 }   // Bowl top right
      ],
      connections: [
        [0, 1] as [number, number], [1, 2] as [number, number], [2, 3] as [number, number],
        [3, 4] as [number, number], [4, 5] as [number, number], [5, 6] as [number, number], [6, 3] as [number, number]
      ]
    },
    {
      // Cassiopeia (W shape)
      points: [
        { x: -0.7, y: -0.4 },
        { x: -0.35, y: 0.3 },
        { x: 0.0, y: -0.1 },
        { x: 0.35, y: 0.3 },
        { x: 0.7, y: -0.4 }
      ],
      connections: [
        [0, 1] as [number, number], [1, 2] as [number, number], [2, 3] as [number, number], [3, 4] as [number, number]
      ]
    }
  ];

  // Mouse dynamics
  private mouse = { x: -1000, y: -1000, active: false };
  private mouseMoving = false;
  private lastMoveTime = 0;
  private isMouseDown = false;
  private chargeTime = 0; // frame count of press-and-hold
  private shakeTimer = 0; // screen-shake frames countdown
  private mouseVelocity = { x: 0, y: 0 };
  private teslaHoldZapTimer = 0;
  private inversionNovaTimer = 0;
  private wormholeHypergateTimer = 0;
  private mouseGravityPauseTimer = 0;
  private readonly mouseGravityPauseFrames = 120; // ~2s at 60fps

  // Singularity (Implosion/Black-Hole) state
  private singularity = { x: 0, y: 0, active: false, timer: 0 };
  private backgroundBlackholes: BackgroundBlackhole[] = [];
  private flockEasingFactor = 0.0;

  // Meteor shower queue state
  private meteorShowerCount = 0;
  private meteorShowerDelay = 0;

  private animationFrameId: number | null = null;
  private animationPaused = false;
  private canvasWidth = 0;
  private canvasHeight = 0;
  private galaxyFrameTick = 0;
  private readonly particleSpatialHash = new SpatialHash(200);
  private readonly spatialQueryBuffer: number[] = [];
  private static readonly MAX_LINKS_INTENSE = 6;

  // Adaptive performance profile (static device tier + runtime FPS governor)
  private performanceProfile!: PerformanceProfile;
  private fpsFrameDeltas: number[] = [];
  private fpsLowStreak = 0;
  private fpsHighStreak = 0;
  private fpsGovernorCooldown = 0;
  private lastFrameTime = 0;
  private static readonly FPS_SAMPLE_SIZE = 30;
  private static readonly FPS_DOWNGRADE_THRESHOLD = 45;
  private static readonly FPS_UPGRADE_THRESHOLD = 58;
  private static readonly FPS_DOWNGRADE_FRAMES = 60;
  private static readonly FPS_UPGRADE_FRAMES = 180;

  // Custom configuration constants (Clean, performant constellations)
  private readonly particleDensity = 8000;
  private readonly connectionDistance = 145; // cleaner web connections
  private readonly mouseAttractDistance = 370;
  private readonly explosionRadius = 330;

  private get maxParticles(): number {
    return this.performanceProfile.maxParticles;
  }

  private get scaledConnectionDistance(): number {
    return this.connectionDistance * this.performanceProfile.connectionDistanceScale;
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
    this.ctx = context;

    this.performanceProfile = resolvePerformanceProfile();
    this.applyPerformanceTier(this.performanceProfile.tier, false);
    this.initNebulas();
    this.initParticles();

    // Run animation loop outside Angular Zone to prevent triggering change detection 60 times/sec
    this.ngZone.runOutsideAngular(() => {
      this.animate();
    });
  }

  ngOnDestroy(): void {
    this.stopAnimationLoop();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (typeof document === 'undefined') {
      return;
    }
    if (document.hidden) {
      this.stopAnimationLoop();
      this.animationPaused = true;
      return;
    }
    if (this.animationPaused) {
      this.animationPaused = false;
      this.resetFpsGovernorStreaks();
      this.ngZone.runOutsideAngular(() => {
        this.animate();
      });
    }
  }

  private stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private resetFpsGovernorStreaks(): void {
    this.fpsLowStreak = 0;
    this.fpsHighStreak = 0;
    this.fpsFrameDeltas = [];
    this.lastFrameTime = 0;
    this.fpsGovernorCooldown = 0;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.resizeCanvas();
    this.initNebulas();
    this.initStars();
    this.initGalaxies();
    this.initParticles();
  }

  private applyPerformanceTier(tier: PerformanceTier, reinitParticles = true): void {
    this.performanceProfile = getProfileForTier(tier);
    this.resizeCanvas();
    this.initStars();
    this.initGalaxies();
    if (reinitParticles) {
      this.nurseryStarCount = 0;
      this.initParticles();
    }
  }

  private tickFpsGovernor(now: number): void {
    if (this.lastFrameTime > 0) {
      const delta = now - this.lastFrameTime;
      this.fpsFrameDeltas.push(delta);
      if (this.fpsFrameDeltas.length > BackgroundCanvasComponent.FPS_SAMPLE_SIZE) {
        this.fpsFrameDeltas.shift();
      }
    }
    this.lastFrameTime = now;

    if (this.fpsGovernorCooldown > 0) {
      this.fpsGovernorCooldown--;
      return;
    }

    if (this.fpsFrameDeltas.length < BackgroundCanvasComponent.FPS_SAMPLE_SIZE) {
      return;
    }

    const avgDelta = this.fpsFrameDeltas.reduce((sum, value) => sum + value, 0) / this.fpsFrameDeltas.length;
    const fps = 1000 / avgDelta;

    if (fps < BackgroundCanvasComponent.FPS_DOWNGRADE_THRESHOLD) {
      this.fpsLowStreak++;
      this.fpsHighStreak = 0;
      if (this.fpsLowStreak >= BackgroundCanvasComponent.FPS_DOWNGRADE_FRAMES) {
        const nextTier = downgradeTier(this.performanceProfile.tier);
        if (nextTier) {
          this.applyPerformanceTier(nextTier);
        }
        this.fpsLowStreak = 0;
        this.fpsHighStreak = 0;
        this.fpsFrameDeltas = [];
        this.fpsGovernorCooldown = 60;
      }
      return;
    }

    if (fps > BackgroundCanvasComponent.FPS_UPGRADE_THRESHOLD) {
      this.fpsHighStreak++;
      this.fpsLowStreak = 0;
      if (this.fpsHighStreak >= BackgroundCanvasComponent.FPS_UPGRADE_FRAMES) {
        const nextTier = upgradeTier(this.performanceProfile.tier);
        if (nextTier) {
          this.applyPerformanceTier(nextTier);
        }
        this.fpsLowStreak = 0;
        this.fpsHighStreak = 0;
        this.fpsFrameDeltas = [];
        this.fpsGovernorCooldown = 60;
      }
      return;
    }

    this.fpsLowStreak = 0;
    this.fpsHighStreak = 0;
  }

  private updatePointerCoords(clientX: number, clientY: number): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = clientX - rect.left;
    this.mouse.y = clientY - rect.top;
  }

  private clearPointerState(): void {
    if (this.activePower === 'DEFAULT' && !this.isMouseDown && (this.state === 'SWARM' || this.state === 'CHARGING')) {
      this.triggerRandomStopAction();
    }
    this.mouse.active = false;
    this.mouse.x = -1000;
    this.mouse.y = -1000;
    this.mouseVelocity.x = 0;
    this.mouseVelocity.y = 0;
    this.mouseMoving = false;
    this.isMouseDown = false;
  }

  private clearTouchPointerStateIfNeeded(event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      this.clearPointerState();
    }
  }

  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    const prevX = this.mouse.x;
    const prevY = this.mouse.y;

    this.updatePointerCoords(event.clientX, event.clientY);

    if (prevX !== -1000) {
      this.mouseVelocity.x = this.mouse.x - prevX;
      this.mouseVelocity.y = this.mouse.y - prevY;
    } else {
      this.mouseVelocity.x = 0;
      this.mouseVelocity.y = 0;
    }

    this.mouse.active = true;
    this.lastMoveTime = Date.now();

    // Stars follow the cursor when it moves (paused during sandbox hold)
    if (this.isMouseGravityActive() && (this.state === 'DRIFT' || (this.state === 'EXPLODING' && this.stateTimer < 15))) {
      this.transitionTo('SWARM');
    }

    // Keep sandbox hold active while dragging — do not let SWARM idle events hijack the interaction
    if (this.isSandboxPowerEngaged()) {
      this.mouseMoving = true;
      return;
    }

    this.mouseMoving = true;
  }

  @HostListener('window:pointerleave', ['$event'])
  onPointerLeave(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') {
      return;
    }
    this.clearPointerState();
  }

  @HostListener('window:pointercancel', ['$event'])
  onPointerCancel(event: PointerEvent): void {
    if (!this.isMouseDown) {
      this.clearTouchPointerStateIfNeeded(event);
      return;
    }
    this.onPointerUp(event);
  }

  @HostListener('window:pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    if (this.state === 'SINGULARITY' || this.state === 'MOON_DANCE') {
      return;
    }

    // Ignore clicks on sandbox mode UI controls
    if (typeof document !== 'undefined') {
      const panel = document.querySelector('.sandbox-panel');
      const trigger = document.querySelector('.sandbox-trigger');
      const hint = document.querySelector('.sandbox-trigger-hint');
      if (
        panel?.contains(event.target as Node) ||
        trigger?.contains(event.target as Node) ||
        hint?.contains(event.target as Node)
      ) {
        return;
      }
    }

    // Close sandbox panel if clicked outside — unless pinned
    if (this.isSandboxOpen && !this.isSandboxPinned) {
      this.isSandboxOpen = false;
      return;
    }

    this.updatePointerCoords(event.clientX, event.clientY);
    this.mouse.active = true;
    this.isMouseDown = true;
    this.chargeTime = 0;
    this.teslaHoldZapTimer = 0;

    if (this.activePower === 'DEFAULT') {
      this.transitionTo('CHARGING');
    } else {
      this.pauseMouseGravity();
    }
  }

  @HostListener('window:pointerup', ['$event'])
  onPointerUp(event: PointerEvent): void {
    if (!this.isMouseDown) {
      return;
    }
    this.isMouseDown = false;

    if (this.state === 'SINGULARITY' || this.state === 'MOON_DANCE') {
      this.clearTouchPointerStateIfNeeded(event);
      return;
    }

    // Ignore releases on sandbox mode UI controls
    if (typeof document !== 'undefined') {
      const panel = document.querySelector('.sandbox-panel');
      const trigger = document.querySelector('.sandbox-trigger');
      if (panel?.contains(event.target as Node) || trigger?.contains(event.target as Node)) {
        this.clearTouchPointerStateIfNeeded(event);
        return;
      }
    }

    this.updatePointerCoords(event.clientX, event.clientY);

    if (this.activePower !== 'DEFAULT') {
      this.handleSandboxPowerRelease();
      this.pauseMouseGravity(90);
      this.clearTouchPointerStateIfNeeded(event);
      return;
    }

    if (this.chargeTime >= 20) {
      this.triggerSuperMoveExplosion();
    } else {
      this.transitionTo('EXPLODING');
      this.triggerNormalClickShockwave();
    }

    this.clearTouchPointerStateIfNeeded(event);
  }

  /** @deprecated Use onPointerMove — kept for unit tests */
  onMouseMove(event: MouseEvent): void {
    this.onPointerMove(event as PointerEvent);
  }

  /** @deprecated Use onPointerLeave — kept for unit tests */
  onMouseLeave(): void {
    this.clearPointerState();
  }

  /** @deprecated Use onPointerDown — kept for unit tests */
  onMouseDown(event: MouseEvent): void {
    this.onPointerDown(event as PointerEvent);
  }

  /** @deprecated Use onPointerUp — kept for unit tests */
  onMouseUp(event: MouseEvent): void {
    this.onPointerUp(event as PointerEvent);
  }

  @HostListener('window:logo-blackhole-trigger')
  onLogoBlackholeTrigger(): void {
    if (this.state === 'SINGULARITY' || this.isLogoBlackholeActive) return;
    
    // Find logo coordinates relative to canvas layout
    const logoImg = document.querySelector('.logoImg') || document.querySelector('.logo');
    let logoX = window.innerWidth / 2;
    let logoY = 120;
    
    if (logoImg) {
      const rect = logoImg.getBoundingClientRect();
      const canvas = this.canvasRef.nativeElement;
      const canvasRect = canvas.getBoundingClientRect();
      
      logoX = rect.left + rect.width / 2 - canvasRect.left;
      logoY = rect.top + rect.height / 2 - canvasRect.top;
    }
    
    this.startLogoBlackhole(logoX, logoY);
  }

  // --- STATE MACHINE ROUTING ---
  /** Cursor gravity (SWARM pull) — active for all powers unless briefly paused on click. */
  /** Sandbox click/hold owns the cursor until mouseup. */
  private isSandboxPowerEngaged(): boolean {
    return this.activePower !== 'DEFAULT' && this.isMouseDown;
  }

  /** True while a sandbox power may apply its field physics (hold or brief post-release buffer). */
  private isSandboxPowerChannelActive(): boolean {
    return this.activePower !== 'DEFAULT' && (this.isMouseDown || this.mouseGravityPauseTimer > 0);
  }

  private isMouseGravityPaused(): boolean {
    return this.isSandboxPowerEngaged() || this.mouseGravityPauseTimer > 0;
  }

  private isMouseGravityActive(): boolean {
    return !this.isMouseGravityPaused();
  }

  private pauseMouseGravity(frames = this.mouseGravityPauseFrames): void {
    this.mouseGravityPauseTimer = Math.max(this.mouseGravityPauseTimer, frames);
  }

  /** Nova Strike-only CHARGING / shockwave mode. */
  private usesDefaultMouseGravity(): boolean {
    return this.activePower === 'DEFAULT';
  }

  private transitionTo(newState: GameState): void {
    this.state = newState;
    
    if (newState === 'EXPLODING') {
      this.stateTimer = 40; // Cooldown frames
    } else if (newState === 'SINGULARITY') {
      this.stateTimer = 25; // Vortex Implosion timer
    } else if (newState === 'MOON_DANCE') {
      this.stateTimer = 390; // Moon dance build-up (300f / 5s) + hyper-collapse (90f / 1.5s)
    } else if (newState === 'DRIFT') {
      this.flockEasingFactor = 0.0;
    }
  }

  private triggerRandomStopAction(): void {
    if (this.activePower !== 'DEFAULT' || this.isMouseDown) {
      return;
    }

    if (this.mouse.x === -1000) {
      this.transitionTo('DRIFT');
      return;
    }

    const eventTypes: ('supernova' | 'blackhole' | 'lightning' | 'nebula')[] = [
      'supernova',
      'blackhole',
      'lightning',
      'nebula'
    ];
    const chosen = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    if (chosen === 'blackhole') {
      this.singularity.x = this.mouse.x !== -1000 ? this.mouse.x : window.innerWidth / 2;
      this.singularity.y = this.mouse.y !== -1000 ? this.mouse.y : window.innerHeight / 2;
      this.singularity.active = true;
      this.transitionTo('SINGULARITY');
    } else {
      this.transitionTo('EXPLODING');
      
      if (chosen === 'supernova') {
        this.triggerSupernovaBurst();
      } else if (chosen === 'lightning') {
        this.triggerTeslaDischarge();
      } else if (chosen === 'nebula') {
        this.triggerNebulaWave();
      }
    }
  }

  // --- CLICK SHOCKWAVE ---
  private triggerNormalClickShockwave(): void {
    if (this.shockwaves.length > 2) {
      this.shockwaves.shift();
    }
    this.shockwaves.push({
      x: this.mouse.x,
      y: this.mouse.y,
      radius: 0,
      maxRadius: 280,
      speed: 7.5,
      alpha: 1.0,
      color: '0, 240, 255'
    });

    this.spawnStellarBirth(this.mouse.x, this.mouse.y);
  }

  // --- SUPER MOVE EXPLOSION ---
  private triggerSuperMoveExplosion(): void {
    this.transitionTo('EXPLODING');
    this.stateTimer = 75;
    this.shakeTimer = 30; // 30 frames screen shake

    // Blast all particles away with massive kinetic power and scatter angles
    this.blastParticlesAway(this.mouse.x, this.mouse.y, 25.0);

    // Cyan, Magenta, Space Blue Rings
    this.shockwaves.push({ x: this.mouse.x, y: this.mouse.y, radius: 0, maxRadius: 380, speed: 9.0, alpha: 1.0, color: '0, 240, 255' });
    this.shockwaves.push({ x: this.mouse.x, y: this.mouse.y, radius: 0, maxRadius: 350, speed: 7.5, alpha: 0.95, color: '255, 100, 230' });
    this.shockwaves.push({ x: this.mouse.x, y: this.mouse.y, radius: 0, maxRadius: 320, speed: 6.0, alpha: 0.85, color: '100, 180, 255' });

    for (let k = 0; k < 55; k++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 7.5 + 3.0;
      this.sparks.push({
        x: this.mouse.x,
        y: this.mouse.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 2.4 + 1.4,
        alpha: 1.0,
        color: k % 3 === 0 ? 'rgba(0, 240, 255,' : k % 3 === 1 ? 'rgba(255, 100, 230,' : 'rgba(100, 180, 255,'
      });
    }

    // Stellar genesis: Super Move births 3 young stars shooting off
    for (let i = 0; i < 3; i++) {
      this.spawnStellarBirth(this.mouse.x, this.mouse.y);
    }

    // Spawn a beautiful constellation easter egg at the mouse position!
    this.spawnEasterEggConstellation(this.mouse.x, this.mouse.y);
  }

  // --- STOP EVENTS ---
  private triggerSupernovaBurst(): void {
    this.blastParticlesAway(this.mouse.x, this.mouse.y, 14.0);

    this.shockwaves.push({ x: this.mouse.x, y: this.mouse.y, radius: 0, maxRadius: 280, speed: 8.0, alpha: 1.0, color: '0, 230, 255' });

    for (let k = 0; k < 35; k++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5.0 + 2.0;
      this.sparks.push({
        x: this.mouse.x,
        y: this.mouse.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 2.0 + 1.2,
        alpha: 1.0,
        color: Math.random() > 0.5 ? 'rgba(0, 240, 255,' : 'rgba(230, 100, 255,'
      });
    }
  }

  private triggerTeslaDischarge(): void {
    const sorted = [...this.particles]
      .map(p => {
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        return { particle: p, dist: Math.sqrt(dx * dx + dy * dy) };
      })
      .sort((a, b) => a.dist - b.dist);

    const targetCount = Math.min(5, sorted.length);
    for (let i = 0; i < targetCount; i++) {
      const p = sorted[i].particle;
      const dx = p.x - this.mouse.x;
      const dy = p.y - this.mouse.y;
      const dist = sorted[i].dist || 1;
      
      // Electric kick with chaotic deflection angle and speed
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.8;
      const speed = 12.0 * (Math.random() * 0.4 + 0.8);
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.colorBlend = 1.0;

      const segments: { x: number; y: number }[] = [];
      const steps = 4;
      const cx = this.mouse.x;
      const cy = this.mouse.y;
      
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const baseOffset = 18;
        const ox = (s === 0 || s === steps) ? 0 : (Math.random() - 0.5) * baseOffset;
        const oy = (s === 0 || s === steps) ? 0 : (Math.random() - 0.5) * baseOffset;
        segments.push({ x: cx + (p.x - cx) * t + ox, y: cy + (p.y - cy) * t + oy });
      }
      this.lightnings.push({ segments, alpha: 1.0 });
    }
  }

  private triggerNebulaWave(): void {
    this.shockwaves.push({ x: this.mouse.x, y: this.mouse.y, radius: 0, maxRadius: 300, speed: 7.0, alpha: 1.0, color: '0, 240, 255' });
    this.shockwaves.push({ x: this.mouse.x, y: this.mouse.y, radius: 0, maxRadius: 280, speed: 6.0, alpha: 0.9, color: '255, 100, 230' });

    for (const p of this.particles) {
      const dx = p.x - this.mouse.x;
      const dy = p.y - this.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 260) {
        p.wobbleTimer = 45;
      }
    }
  }

  private blastParticlesAway(x: number, y: number, multiplier: number): void {
    for (const p of this.particles) {
      const dx = p.x - x;
      const dy = p.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      if (dist < this.explosionRadius) {
        const force = (this.explosionRadius - dist) / this.explosionRadius;
        
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 3.6; 
        const speed = force * multiplier * (Math.random() * 1.5 + 0.3);
        
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.colorBlend = 1.0;

        if (Math.random() < 0.50) {
          p.wobbleTimer = Math.floor(Math.random() * 45) + 20;
        }

        this.tryWormholeCapture(p, { forceCapture: true });
      }
    }
  }

  // --- STELLAR NURSERY & LIFE CYCLE SYSTEM ---
  private spawnStellarBirth(x: number, y: number, options?: { nursery?: boolean; sprayAngle?: number }): boolean {
    const isNursery = options?.nursery === true;

    if (isNursery) {
      if (this.nurseryStarCount >= this.maxNurseryStars) {
        return false;
      }
    } else if (this.particles.length >= this.maxParticles + 15) {
      return false;
    }

    const angle = options?.sprayAngle ?? Math.random() * Math.PI * 2;
    const speed = isNursery
      ? Math.random() * 3.5 + 1.5
      : Math.random() * 2.5 + 1.0;
    const baseRadius = Math.random() * 2.0 + 1.6;

    const colors = [
      'rgba(0, 240, 255,',
      'rgba(0, 240, 255,',
      'rgba(0, 240, 255,',
      'rgba(230, 100, 255,',
      'rgba(100, 180, 255,'
    ];
    const colorPrefix = isNursery || Math.random() < 0.12
      ? colors[Math.floor(Math.random() * colors.length)]
      : 'rgba(255, 255, 255,';
    const flockable = Math.random() < (isNursery ? 0.35 : 0.22);

    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      baseVx: Math.cos(angle) * 0.4,
      baseVy: Math.sin(angle) * 0.4,
      radius: baseRadius,
      baseRadius,
      colorBlend: isNursery ? 0.35 : 0.0,
      wobbleTimer: 0,
      colorPrefix,
      flockable,
      life: 1.0,
      birthProgress: isNursery ? 0.65 : 0.0,
      deathProgress: 0.0,
      isDying: false,
      behaviorState: 'CRUISE',
      behaviorTimer: Math.floor(Math.random() * 120) + 120,
      speedFactor: 1.0,
      isNursery
    });

    if (isNursery) {
      this.nurseryStarCount++;
      this.spawnStardustPuff(x, y, colorPrefix);
    }

    return true;
  }

  private spawnNurseryStar(x: number, y: number): void {
    const sprayAngle = Math.random() * Math.PI * 2;
    const offset = Math.random() * 14;
    this.spawnStellarBirth(
      x + Math.cos(sprayAngle) * offset,
      y + Math.sin(sprayAngle) * offset,
      { nursery: true, sprayAngle }
    );
  }

  private spawnStardustPuff(x: number, y: number, colorPrefix: string): void {
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 0.8 + 0.3;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 1.5 + 0.8,
        alpha: 1.0,
        color: colorPrefix
      });
    }
  }

  private spawnMiniSupernova(x: number, y: number, colorPrefix: string): void {
    const parts = colorPrefix.replace('rgba(', '').replace(')', '').split(',');
    const rgbStr = `${parts[0].trim()}, ${parts[1].trim()}, ${parts[2].trim()}`;

    this.shockwaves.push({
      x,
      y,
      radius: 0,
      maxRadius: 75,
      speed: 2.2,
      alpha: 1.0,
      color: rgbStr
    });

    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2.0 + 0.8;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 2.2 + 0.8,
        alpha: 1.0,
        color: colorPrefix
      });
    }
  }

  private drawMiniChargeArc(x1: number, y1: number, x2: number, y2: number): void {
    const segments = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const baseOffset = 8;
      const ox = (Math.random() - 0.5) * baseOffset;
      const oy = (Math.random() - 0.5) * baseOffset;
      this.ctx.lineTo(x1 + (x2 - x1) * t + ox, y1 + (y2 - y1) * t + oy);
    }
    this.ctx.lineTo(x2, y2);
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    this.ctx.lineWidth = 0.9;
    this.ctx.stroke();
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const dprCap = this.performanceProfile?.dprCap ?? 2;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    
    // Size physical resolution to match canvas layout bounds precisely
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  private initNebulas(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // Generate 5 colorful drifting nebulas in the background with detailed base colors and opacities
    this.nebulas = [
      { x: width * 0.25, y: height * 0.35, baseX: width * 0.25, baseY: height * 0.35, radius: Math.min(width, height) * 0.60, colorBase: '0, 80, 255', maxOpacity: 0.05, phase: Math.random() * 100, scalePhase: Math.random() * 100 },
      { x: width * 0.75, y: height * 0.65, baseX: width * 0.75, baseY: height * 0.65, radius: Math.min(width, height) * 0.65, colorBase: '160, 40, 240', maxOpacity: 0.04, phase: Math.random() * 100, scalePhase: Math.random() * 100 },
      { x: width * 0.50, y: height * 0.15, baseX: width * 0.50, baseY: height * 0.15, radius: Math.min(width, height) * 0.50, colorBase: '0, 150, 200', maxOpacity: 0.03, phase: Math.random() * 100, scalePhase: Math.random() * 100 },
      { x: width * 0.85, y: height * 0.25, baseX: width * 0.85, baseY: height * 0.25, radius: Math.min(width, height) * 0.55, colorBase: '255, 80, 0', maxOpacity: 0.015, phase: Math.random() * 100, scalePhase: Math.random() * 100 },
      { x: width * 0.15, y: height * 0.80, baseX: width * 0.15, baseY: height * 0.80, radius: Math.min(width, height) * 0.45, colorBase: '255, 50, 150', maxOpacity: 0.02, phase: Math.random() * 100, scalePhase: Math.random() * 100 }
    ];
  }

  private initStars(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const area = width * height;
    const starCount = Math.floor(area / this.performanceProfile.backgroundStarDivisor); 

    const colorTints = [
      'rgba(255, 255, 255,',
      'rgba(220, 240, 255,',
      'rgba(255, 250, 210,',
      'rgba(240, 210, 255,'
    ];

    this.backgroundStars = [];
    for (let i = 0; i < starCount; i++) {
      const isPulsar = Math.random() < 0.07; // 7% of stars are deep supergiants/pulsars
      let pulsarColor = 'rgba(0, 240, 255,';
      if (isPulsar) {
        const rand = Math.random();
        if (rand < 0.4) {
          pulsarColor = 'rgba(0, 240, 255,'; // cyan supergiant
        } else if (rand < 0.7) {
          pulsarColor = 'rgba(255, 80, 80,'; // red giant
        } else {
          pulsarColor = 'rgba(230, 100, 255,'; // magenta supergiant
        }
      }

      this.backgroundStars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: isPulsar ? Math.random() * 1.5 + 1.2 : Math.random() * 1.0 + 0.3,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.016 + 0.005,
        color: isPulsar ? pulsarColor : colorTints[Math.floor(Math.random() * colorTints.length)],
        isPulsar,
        pulsarPhase: Math.random() * Math.PI * 2
      });
    }

    // Initialize parallax space dust (sweeping cosmic breeze)
    const dustCount = Math.floor(area / this.performanceProfile.dustDivisor);
    this.spaceDust = [];
    for (let i = 0; i < dustCount; i++) {
      this.spaceDust.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: -0.06 - Math.random() * 0.08,
        vy: 0.02 + Math.random() * 0.04,
        radius: Math.random() * 1.6 + 0.7,
        opacity: Math.random() * 0.16 + 0.04
      });
    }
  }

  private initGalaxies(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    const galaxyMult = this.performanceProfile.galaxyStarMultiplier;
    const scaleGalaxyStars = (base: number) => Math.max(20, Math.floor(base * galaxyMult));

    this.backgroundGalaxies = [
      {
        x: width * 0.20,
        y: height * 0.28,
        size: Math.min(width, height) * 0.38,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: 0.00025,
        color: '140, 90, 255', // violet galaxy
        arms: 2,
        starCount: scaleGalaxyStars(180),
        seed: Math.random() * 1000
      },
      {
        x: width * 0.80,
        y: height * 0.70,
        size: Math.min(width, height) * 0.44,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: -0.00018,
        color: '0, 190, 255', // cyan galaxy
        arms: 3,
        starCount: scaleGalaxyStars(240),
        seed: Math.random() * 1000
      },
      {
        x: width * 0.60,
        y: height * 0.82,
        size: Math.min(width, height) * 0.26,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: 0.00035,
        color: '255, 130, 0', // space orange galaxy
        arms: 2,
        starCount: scaleGalaxyStars(120),
        seed: Math.random() * 1000
      }
    ];
  }

  private drawGalaxy(g: BackgroundGalaxy): void {
    // Core glow (radial gradient)
    const lensedCore = this.getLensedCoords(g.x, g.y);
    const coreGrad = this.ctx.createRadialGradient(lensedCore.x, lensedCore.y, 0, lensedCore.x, lensedCore.y, g.size * 0.35);
    coreGrad.addColorStop(0, `rgba(${g.color}, 0.08)`);
    coreGrad.addColorStop(0.4, `rgba(${g.color}, 0.035)`);
    coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = coreGrad;
    this.ctx.beginPath();
    this.ctx.arc(lensedCore.x, lensedCore.y, g.size * 0.35, 0, Math.PI * 2);
    this.ctx.fill();

    // Spiral arms of tiny stars (single batched path)
    this.ctx.fillStyle = `rgba(${g.color}, 0.28)`;
    this.ctx.beginPath();
    for (let i = 0; i < g.starCount; i++) {
      // Deterministic offset calculations based on indices so they don't flicker
      const t = i / g.starCount; // normalized radius offset
      const armIndex = i % g.arms;
      const armAngle = (armIndex * (Math.PI * 2)) / g.arms;
      
      // Logarithmic spiral approximation: angle shifts proportional to distance
      const theta = t * Math.PI * 2.8 + armAngle + g.rotation;
      const r = t * g.size * 0.5;
      
      // Fluffy stellar distribution: add deterministic wave dispersion
      const noiseSeed = i * 23.456 + g.seed;
      const dispersion = g.size * 0.075 * (Math.sin(noiseSeed) * 0.5);
      const dispAngle = noiseSeed * 1.5;
      
      const rawX = g.x + Math.cos(theta) * r + Math.cos(dispAngle) * dispersion;
      const rawY = g.y + Math.sin(theta) * r + Math.sin(dispAngle) * dispersion;
      
      const pt = this.getLensedCoords(rawX, rawY);
      
      // Star dimensions shrink outward
      const radius = (1.0 - t) * 1.1 + 0.35;

      this.ctx.moveTo(pt.x + radius, pt.y);
      this.ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    }
    this.ctx.fill();
  }

  private updateAndDrawComets(width: number, height: number): void {
    // Comet spawn check (very rare)
    if (this.comets.length < 2 && Math.random() < 0.0003) {
      const startFromLeft = Math.random() > 0.5;
      const x = startFromLeft ? -100 : width + 100;
      const y = Math.random() * height * 0.35; // top third
      const angle = startFromLeft 
        ? (Math.random() * 0.35 + 0.08) * Math.PI 
        : (Math.random() * 0.35 + 0.57) * Math.PI;
      const speed = Math.random() * 1.2 + 0.6;
      
      this.comets.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3.0 + 2.0,
        alpha: 0,
        active: true,
        speed,
        color: '0, 190, 255'
      });
    }

    for (let i = this.comets.length - 1; i >= 0; i--) {
      const c = this.comets[i];
      c.x += c.vx;
      c.y += c.vy;

      // check boundaries
      if (c.x < -250 || c.x > width + 250 || c.y > height + 250) {
        this.comets.splice(i, 1);
        continue;
      }

      if (c.alpha < 1.0) {
        c.alpha += 0.015;
      }

      // Draw trails (Ion + Dust)
      const speedVal = Math.sqrt(c.vx * c.vx + c.vy * c.vy) || 1;
      const dx = -c.vx / speedVal;
      const dy = -c.vy / speedVal;

      // Ion Tail (straight, blue-ish gradient)
      const ionGrad = this.ctx.createLinearGradient(c.x, c.y, c.x + dx * 140, c.y + dy * 140);
      ionGrad.addColorStop(0, `rgba(0, 180, 255, ${c.alpha * 0.4})`);
      ionGrad.addColorStop(0.3, `rgba(0, 100, 255, ${c.alpha * 0.15})`);
      ionGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.strokeStyle = ionGrad;
      this.ctx.lineWidth = c.size * 0.85;
      this.ctx.beginPath();
      this.ctx.moveTo(c.x, c.y);
      this.ctx.lineTo(c.x + dx * 140, c.y + dy * 140);
      this.ctx.stroke();

      // Dust Tail (slightly curved, wider, warm golden/white gradient)
      const px = -dy; 
      const py = dx;
      const dustGrad = this.ctx.createLinearGradient(c.x, c.y, c.x + dx * 190 + px * 22, c.y + dy * 190 + py * 22);
      dustGrad.addColorStop(0, `rgba(240, 230, 200, ${c.alpha * 0.3})`);
      dustGrad.addColorStop(0.4, `rgba(210, 190, 170, ${c.alpha * 0.12})`);
      dustGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      this.ctx.fillStyle = dustGrad;
      this.ctx.beginPath();
      this.ctx.moveTo(c.x, c.y);
      this.ctx.lineTo(c.x + dx * 190 - px * 14, c.y + dy * 190 - py * 14);
      this.ctx.lineTo(c.x + dx * 190 + px * 24, c.y + dy * 190 + py * 24);
      this.ctx.closePath();
      this.ctx.fill();

      // Nucleus
      const nucGrad = this.ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.size);
      nucGrad.addColorStop(0, `rgba(255, 255, 255, ${c.alpha})`);
      nucGrad.addColorStop(0.4, `rgba(0, 240, 255, ${c.alpha * 0.75})`);
      nucGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = nucGrad;
      this.ctx.beginPath();
      this.ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private getLensedCoords(x: number, y: number): { x: number; y: number } {
    if (!this.mouse.active || this.mouse.x === -1000 || this.state === 'SINGULARITY') {
      return { x, y };
    }

    // Sandbox powers use their own field visuals — skip lensing while a power click is active
    if (this.isSandboxPowerChannelActive() && this.activePower !== 'DEFAULT') {
      return { x, y };
    }

    const dx = x - this.mouse.x;
    const dy = y - this.mouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    
    const lensRadius = 320;
    if (dist < lensRadius) {
      // Einstein Ring approximation: maximum displacement at mid-radius, tapering to 0 at boundaries
      const force = (lensRadius - dist) / lensRadius;
      const factor = Math.sin(force * Math.PI) * 45; // up to 45px lensing distortion
      
      return {
        x: x + (dx / dist) * factor,
        y: y + (dy / dist) * factor
      };
    }
    
    return { x, y };
  }


  private updateUIAnchors(): void {
    if (typeof document === 'undefined') return;
    const now = Date.now();
    if (now - this.lastAnchorUpdate < 750) return; // limit querying bounds
    this.lastAnchorUpdate = now;

    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();

    const targets = document.querySelectorAll('h1, h2, .logo, nav ul li a, .button');
    const temp: { x: number; y: number }[] = [];

    targets.forEach(t => {
      const r = t.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0) {
        temp.push({
          x: r.left + r.width / 2 - rect.left,
          y: r.top + r.height / 2 - rect.top
        });
      }
    });

    this.uiAnchors = temp;
  }

  private spawnEasterEggConstellation(x: number, y: number): void {
    const template = this.constellationTemplates[Math.floor(Math.random() * this.constellationTemplates.length)];
    this.easterEggs.push({
      x,
      y,
      scale: Math.random() * 50 + 95, // 95px to 145px
      alpha: 1.0,
      points: template.points,
      connections: template.connections
    });
  }

  private drawEasterEggs(): void {
    for (let i = this.easterEggs.length - 1; i >= 0; i--) {
      const egg = this.easterEggs[i];
      egg.alpha -= 0.0035; // Fades out slowly over ~280 frames (~4.5 seconds)

      if (egg.alpha <= 0) {
        this.easterEggs.splice(i, 1);
        continue;
      }

      // Draw connections
      this.ctx.beginPath();
      for (const conn of egg.connections) {
        const p1 = egg.points[conn[0]];
        const p2 = egg.points[conn[1]];
        
        const pt1 = this.getLensedCoords(egg.x + p1.x * egg.scale, egg.y + p1.y * egg.scale);
        const pt2 = this.getLensedCoords(egg.x + p2.x * egg.scale, egg.y + p2.y * egg.scale);

        this.ctx.moveTo(pt1.x, pt1.y);
        this.ctx.lineTo(pt2.x, pt2.y);
      }
      
      // Paint faint glowing neon cyan/magenta linkage lines
      this.ctx.strokeStyle = `rgba(0, 240, 255, ${egg.alpha * 0.28})`;
      this.ctx.lineWidth = 0.9;
      this.ctx.stroke();

      // Draw constellation nodes
      for (const p of egg.points) {
        const pt = this.getLensedCoords(egg.x + p.x * egg.scale, egg.y + p.y * egg.scale);

        // Core star
        this.ctx.beginPath();
        this.ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(255, 255, 255, ${egg.alpha * 0.9})`;
        this.ctx.fill();

        // Outer glow halo
        this.ctx.beginPath();
        this.ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(255, 100, 230, ${egg.alpha * 0.35})`;
        this.ctx.fill();
      }
    }
  }

  private startLogoBlackhole(logoX: number, logoY: number): void {
    if (this.isLogoBlackholeActive) return;
    
    this.isLogoBlackholeActive = true;
    this.logoBlackholeTimer = 0;
    
    // Set singularity target coordinates to logo center
    this.singularity.x = logoX;
    this.singularity.y = logoY;
    this.singularity.active = true;
    this.singularity.timer = 390;
    
    this.transitionTo('MOON_DANCE');
    this.stateTimer = 390;
    this.shakeTimer = 0; // wait to shake on blast
    
    if (typeof document === 'undefined') return;
    
    try {
      const logoEl = document.querySelector('.logo') as HTMLElement;
      const logoImg = document.querySelector('.logoImg') as HTMLElement;
      if (logoEl) {
        logoEl.classList.remove('logo-moon-explode');
        logoEl.classList.add('logo-moon-transform');
      }
      if (logoImg) {
        logoImg.classList.remove('logo-moon-explode');
        logoImg.classList.add('logo-moon-transform-img');
      }

      // Select all individual layout elements and their container borders/outlines to explode
      const selectors = [
        '#header nav',
        '#header nav ul li',
        '#header .content',
        '#header .content h1',
        '#header .content p',
        '#header .subIntro p',
        '#main',
        '#main article.active',
        '#main article.active h2',
        '#main article.active h3',
        '#main article.active p',
        '#main article.active a',
        '#main article.active li',
        '#main article.active .close',
        '#main article.active .field',
        '#main article.active input',
        '#main article.active textarea',
        '#main article.active #github-projects > *',
        'footer',
        'footer p',
        'footer ul li'
      ];
      
      const elements: HTMLElement[] = [];
      const rawElements = Array.from(document.querySelectorAll(selectors.join(','))) as HTMLElement[];
      
      rawElements.forEach((htmlEl) => {
        const rect = htmlEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          elements.push(htmlEl);
        }
      });
      
      this.logoElements = elements;
      this.logoOrigPositions = [];
      
      this.logoElements.forEach(htmlEl => {
        const rect = htmlEl.getBoundingClientRect();
        const elX = rect.left + rect.width / 2;
        const elY = rect.top + rect.height / 2;
        
        this.logoOrigPositions.push({
          dx: logoX - elX,
          dy: logoY - elY
        });
      });
    } catch (e) {
      console.warn('[LogoMoonDance] Failed initialization:', e);
    }
  }

  private endLogoBlackhole(): void {
    try {
      const logoEl = document.querySelector('.logo') as HTMLElement;
      const logoImg = document.querySelector('.logoImg') as HTMLElement;
      
      if (logoEl) {
        logoEl.classList.remove('logo-moon-transform');
        logoEl.classList.remove('logo-moon-explode');
        logoEl.style.transition = 'none';
        logoEl.style.transform = 'scale(0.1)';
        logoEl.style.opacity = '0';
        logoEl.style.boxShadow = '';
        logoEl.style.borderColor = '';
        logoEl.style.background = '';
        void logoEl.offsetHeight; // force reflow
        logoEl.style.transition = 'transform 1.2s cubic-bezier(0.15, 0.85, 0.3, 1.25), opacity 1.2s ease-out';
        logoEl.style.transform = '';
        logoEl.style.opacity = '1';
      }
      
      if (logoImg) {
        logoImg.classList.remove('logo-moon-transform-img');
        logoImg.classList.remove('logo-moon-explode');
        logoImg.style.transition = 'none';
        logoImg.style.transform = '';
        logoImg.style.filter = '';
        logoImg.style.opacity = '1';
      }

      // Restore structural containers with a gravitational snapping animation
      if (this.logoElements) {
        this.logoElements.forEach(htmlEl => {
          if (htmlEl && htmlEl.style) {
            htmlEl.style.transition = 'transform 2.2s cubic-bezier(0.25, 1.5, 0.45, 1), opacity 0.5s ease-out';
            htmlEl.style.transform = 'translate(0, 0) scale(1) rotate(0deg)';
            htmlEl.style.opacity = '1';
          }
        });
      }
    } catch (e) {
      console.warn('[LogoBlackhole] Failed restore:', e);
    }

    // Cleanup reference arrays and restore original CSS transitions/parallax states
    setTimeout(() => {
      try {
        const logoEl = document.querySelector('.logo') as HTMLElement;
        const logoImg = document.querySelector('.logoImg') as HTMLElement;
        if (logoEl) {
          logoEl.style.transition = '';
          logoEl.style.transform = '';
          logoEl.style.opacity = '';
        }
        if (logoImg) {
          logoImg.style.transition = '';
          logoImg.style.transform = '';
          logoImg.style.opacity = '';
        }
        
        if (this.logoElements) {
          this.logoElements.forEach(htmlEl => {
            if (htmlEl && htmlEl.style) {
              htmlEl.style.transition = '';
              htmlEl.style.transform = '';
              htmlEl.style.opacity = '';
            }
          });
        }
      } catch (e) {
        console.warn('[LogoBlackhole] Failed cleanup:', e);
      }
      this.isLogoBlackholeActive = false;
      this.logoElements = [];
      this.logoOrigPositions = [];
    }, 1900);
  }

  private initParticles(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const area = width * height;
    
    const targetCount = Math.min(this.maxParticles, Math.floor(area / this.particleDensity));
    const count = Math.max(35, targetCount);

    const colors = [
      'rgba(0, 240, 255,',   // Neon Cyan
      'rgba(0, 240, 255,',   // Neon Cyan (duplicate to prioritize cyan)
      'rgba(0, 240, 255,',   // Neon Cyan
      'rgba(230, 100, 255,', // Nebula Magenta
      'rgba(100, 180, 255,'  // Space Blue
    ];

    this.particles = [];
    for (let i = 0; i < count; i++) {
      const baseRadius = Math.random() * 2.0 + 1.6;
      const baseVx = (Math.random() - 0.5) * 0.45;
      const baseVy = (Math.random() - 0.5) * 0.45;
      const colorPrefix = Math.random() < 0.12
        ? colors[Math.floor(Math.random() * colors.length)]
        : 'rgba(255, 255, 255,';
      const flockable = Math.random() < 0.22; // Only 22% group up

      this.particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: baseVx,
        vy: baseVy,
        baseVx,
        baseVy,
        radius: baseRadius,
        baseRadius,
        colorBlend: 0.0,
        wobbleTimer: 0,
        colorPrefix,
        flockable,
        life: Math.random() * 0.6 + 0.4,
        birthProgress: 1.0,
        deathProgress: 0.0,
        isDying: false,
        behaviorState: Math.random() < 0.6 ? 'CRUISE' : (Math.random() < 0.5 ? 'DECELERATE' : 'BURST'),
        behaviorTimer: Math.floor(Math.random() * 120) + 60,
        speedFactor: 1.0
      });
    }
  }

  private animate(): void {
    if (this.animationPaused) {
      return;
    }
    this.tickFpsGovernor(typeof performance !== 'undefined' ? performance.now() : Date.now());
    this.draw();
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  private draw(): void {
    const width = this.canvasWidth || window.innerWidth;
    const height = this.canvasHeight || window.innerHeight;

    // Auto close sandbox if website article modal is opened
    if (typeof document !== 'undefined' && document.body.classList.contains('is-article-visible')) {
      this.isSandboxOpen = false;
    }

    // Slowly ease in the flocking strength when returning to DRIFT state
    if (this.state === 'DRIFT') {
      this.flockEasingFactor += (1.0 - this.flockEasingFactor) * 0.007; // Eases over ~4 seconds
    } else {
      this.flockEasingFactor = 0.0;
    }

    // --- UPDATE UI TEXT ANCHORS ---
    this.updateUIAnchors();

    // --- PAGE ELEMENTS EXPLOSION ---
    if (this.pageExplodeActive) {
      try {
        this.pageExplodeTimer++;
        const progress = Math.min(1.0, this.pageExplodeTimer / 120);
        
        const len = this.logoElements ? this.logoElements.length : 0;
        for (let i = 0; i < len; i++) {
          const htmlEl = this.logoElements[i];
          const orig = this.logoOrigPositions ? this.logoOrigPositions[i] : null;
          if (!htmlEl || !htmlEl.style || !orig) continue;
          
          const dirX = -orig.dx;
          const dirY = -orig.dy;
          const lenDist = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
          const ndx = dirX / lenDist;
          const ndy = dirY / lenDist;
          
          const blastDistance = Math.pow(progress, 1.15) * 1100; // translate up to 1100px outward
          const tx = ndx * blastDistance;
          const ty = ndy * blastDistance;
          
          const rotate = progress * 960 * (i % 2 === 0 ? 1 : -1);
          const scale = Math.max(0, 1.0 - Math.pow(progress, 1.6));
          const opacity = Math.max(0, 1.0 - Math.pow(progress, 1.3));
          
          htmlEl.style.transition = 'none';
          htmlEl.style.transform = `translate(${tx}px, ${ty}px) rotate(${rotate}deg) scale(${scale})`;
          htmlEl.style.opacity = `${opacity}`;
        }
      } catch (e) {
        console.warn('[LogoBlackhole] Page elements explosion frame error:', e);
      }
    }

    // --- STATE MACHINE ENGINE TICK ---
    if (this.inversionNovaTimer > 0) {
      this.inversionNovaTimer--;
    }
    if (this.wormholeHypergateTimer > 0) {
      this.wormholeHypergateTimer--;
    }
    if (this.mouseGravityPauseTimer > 0) {
      this.mouseGravityPauseTimer--;
    }

    if (this.state === 'SWARM') {
      if (this.activePower === 'DEFAULT' && !this.isMouseDown && this.mouse.active && this.mouseMoving) {
        if (Date.now() - this.lastMoveTime > 220) {
          this.triggerRandomStopAction();
          this.mouseMoving = false;
        }
      }
    } else if (this.state === 'SINGULARITY') {
      this.stateTimer--;
      if (this.stateTimer <= 0) {
        this.transitionTo('EXPLODING');
        
        // Blast all particles outwards with huge speed and chaos!
        this.blastParticlesAway(this.singularity.x, this.singularity.y, 18.0);
        this.spawnEasterEggConstellation(this.singularity.x, this.singularity.y);
        
        // Add shockwaves
        const waveColor = '0, 240, 255';
        this.shockwaves.push({
          x: this.singularity.x,
          y: this.singularity.y,
          radius: 0,
          maxRadius: this.explosionRadius * 0.95,
          speed: 8.5,
          alpha: 1.0,
          color: waveColor
        });
        this.shakeTimer = 15;
      }
    } else if (this.state === 'MOON_DANCE') {
      this.stateTimer--;
      this.logoBlackholeTimer++;
      
      // Gradually fade out background space environment into black
      if (this.stateTimer > 90) {
        this.blackoutAlpha = Math.min(0.96, ((390 - this.stateTimer) / 300) * 0.96);
      } else {
        this.blackoutAlpha = 0.96;
        
        // Phase 2: Rapid logo trembling and pulsing
        if (!this.performanceProfile.skipDomTremble) {
          const logoEl = document.querySelector('.logo') as HTMLElement;
          if (logoEl) {
            const pulseFactor = 1.35 + Math.sin(this.stateTimer * 0.45) * 0.15;
            const trembleX = (Math.random() - 0.5) * 4;
            const trembleY = (Math.random() - 0.5) * 4;
            logoEl.style.transform = `scale(${pulseFactor}) translate3d(${trembleX}px, ${trembleY}px, 0)`;
          }
        }
        
        // Tremble screen
        this.shakeTimer = Math.max(this.shakeTimer, 3);

        // Convergence cosmic lightning discharges
        if (Math.random() < 0.35 * this.performanceProfile.effectScale) {
          const startFromLeft = Math.random() > 0.5;
          const startX = startFromLeft ? 0 : window.innerWidth;
          const startY = Math.random() * window.innerHeight;
          
          const segments = [];
          const steps = 6;
          for (let s = 0; s <= steps; s++) {
            const pct = s / steps;
            const baseOffset = 45 * (1 - pct);
            const ox = (s === 0 || s === steps) ? 0 : (Math.random() - 0.5) * baseOffset;
            const oy = (s === 0 || s === steps) ? 0 : (Math.random() - 0.5) * baseOffset;
            segments.push({
              x: startX + (this.singularity.x - startX) * pct + ox,
              y: startY + (this.singularity.y - startY) * pct + oy
            });
          }
          this.lightnings.push({ segments, alpha: 1.0 });
        }
      }

      if (this.stateTimer <= 0) {
        this.transitionTo('EXPLODING');
        this.stateTimer = 240; // 4 seconds total cooldown for the Big Bang sequence
        this.screenFlash = 14; // trigger full screen flash overlay

        // Reset particle birth progress and blend so they are bright and flash out on explosion
        for (const p of this.particles) {
          p.birthProgress = 1.0;
          p.colorBlend = 1.0;
        }

        // Blast all particles outwards with hyper kinetic speed (Big Bang)
        this.blastParticlesAway(this.singularity.x, this.singularity.y, 45.0);
        const constellationCount = 1 + Math.floor(2 * this.performanceProfile.effectScale);
        this.spawnEasterEggConstellation(this.singularity.x, this.singularity.y);
        if (constellationCount >= 2) {
          this.spawnEasterEggConstellation(this.singularity.x - 100, this.singularity.y + 100);
        }
        if (constellationCount >= 3) {
          this.spawnEasterEggConstellation(this.singularity.x + 100, this.singularity.y - 100);
        }
        
        // Push massive multi-colored shockwave rings
        const bigBangShockwaves = [
          {
            x: this.singularity.x,
            y: this.singularity.y,
            radius: 0,
            maxRadius: this.explosionRadius * 3.5,
            speed: 22.0,
            alpha: 1.0,
            color: '255, 255, 255'
          },
          {
            x: this.singularity.x,
            y: this.singularity.y,
            radius: 0,
            maxRadius: this.explosionRadius * 3.0,
            speed: 16.0,
            alpha: 0.95,
            color: '0, 240, 255'
          },
          {
            x: this.singularity.x,
            y: this.singularity.y,
            radius: 0,
            maxRadius: this.explosionRadius * 2.5,
            speed: 12.0,
            alpha: 0.85,
            color: '255, 100, 230'
          },
          {
            x: this.singularity.x,
            y: this.singularity.y,
            radius: 0,
            maxRadius: this.explosionRadius * 2.0,
            speed: 9.0,
            alpha: 0.75,
            color: '100, 180, 255'
          }
        ];
        const shockwaveCount = Math.max(1, Math.floor(bigBangShockwaves.length * this.performanceProfile.effectScale));
        for (let w = 0; w < shockwaveCount; w++) {
          this.shockwaves.push(bigBangShockwaves[w]);
        }
        
        // Big Bang explosion sparks (scaled by performance tier)
        const sparkCount = Math.floor(240 * this.performanceProfile.effectScale);
        for (let k = 0; k < sparkCount; k++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 20.0 + 4.5;
          this.sparks.push({
            x: this.singularity.x,
            y: this.singularity.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: Math.random() * 3.2 + 1.2,
            alpha: 1.0,
            color: k % 3 === 0 ? 'rgba(0, 240, 255,' : k % 3 === 1 ? 'rgba(255, 100, 230,' : 'rgba(100, 180, 255,'
          });
        }
        
        this.shakeTimer = 75; // major screen shake duration
        
        // Apply explode class to logo elements
        const logoEl = document.querySelector('.logo') as HTMLElement;
        const logoImg = document.querySelector('.logoImg') as HTMLElement;
        if (logoEl) {
          logoEl.classList.remove('logo-moon-transform');
          logoEl.classList.add('logo-moon-explode');
        }
        if (logoImg) {
          logoImg.classList.remove('logo-moon-transform-img');
          logoImg.classList.add('logo-moon-explode');
        }
        
        this.pageExplodeActive = true;
        this.pageExplodeTimer = 0;
        
        // Schedule restoration/fading back in
        setTimeout(() => {
          this.endLogoBlackhole();
          this.pageExplodeActive = false;
        }, 2200);
      }
    } else if (this.state === 'EXPLODING') {
      this.stateTimer--;
      // Slowly fade out the background blackout
      if (this.blackoutAlpha > 0) {
        this.blackoutAlpha = Math.max(0, this.blackoutAlpha - 0.015);
      }
      if (this.stateTimer <= 0 && this.shockwaves.length === 0) {
        const resumeSwarm = this.mouseMoving && this.isMouseGravityActive();
        this.transitionTo(resumeSwarm ? 'SWARM' : 'DRIFT');
      }
    }

    // --- SCREEN SHAKE RENDERING TRANSLATION ---
    if (this.shakeTimer > 0) {
      this.shakeTimer--;
      const shakeIntensity = (this.shakeTimer / 30) * 8.5;
      const shakeX = (Math.random() - 0.5) * shakeIntensity;
      const shakeY = (Math.random() - 0.5) * shakeIntensity;
      this.ctx.save();
      this.ctx.translate(shakeX, shakeY);
    }

    this.ctx.clearRect(0, 0, width, height);

    // 1. Draw Nebula Clouds Backdrop (Slow breathing drift)
    const nLength = this.nebulas.length;
    for (let i = 0; i < nLength; i++) {
      const neb = this.nebulas[i];
      neb.x = neb.baseX + Math.sin(Date.now() / 15000 + neb.phase) * 60;
      neb.y = neb.baseY + Math.cos(Date.now() / 15000 + neb.phase) * 40;

      const lCoords = this.getLensedCoords(neb.x, neb.y);
      const opacity = neb.maxOpacity * (0.75 + Math.sin(Date.now() / 10000 + neb.phase) * 0.25);
      const currentRadius = neb.radius * (0.92 + Math.sin(Date.now() / 12000 + neb.scalePhase) * 0.08);

      const grad = this.ctx.createRadialGradient(lCoords.x, lCoords.y, 0, lCoords.x, lCoords.y, currentRadius);
      grad.addColorStop(0, `rgba(${neb.colorBase}, ${opacity})`);
      grad.addColorStop(0.5, `rgba(${neb.colorBase}, ${opacity * 0.45})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(lCoords.x, lCoords.y, currentRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 1.5. Draw rotating background galaxies
    this.galaxyFrameTick++;
    const galaxyStride = this.performanceProfile.galaxyUpdateStride;
    const gLength = this.backgroundGalaxies.length;
    for (let i = 0; i < gLength; i++) {
      const g = this.backgroundGalaxies[i];
      if (this.galaxyFrameTick % galaxyStride === 0) {
        g.rotation += g.rotationSpeed * galaxyStride;
      }
      this.drawGalaxy(g);
    }

    // 2. Draw Twinkling Background Starfield
    const bLength = this.backgroundStars.length;
    for (let i = 0; i < bLength; i++) {
      const star = this.backgroundStars[i];
      star.phase += star.twinkleSpeed;
      const twinkleOpacity = 0.12 + (Math.sin(star.phase) + 1.0) * 0.5 * 0.48;

      const lCoords = this.getLensedCoords(star.x, star.y);
      this.ctx.beginPath();
      this.ctx.arc(lCoords.x, lCoords.y, star.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `${star.color}${twinkleOpacity})`;
      this.ctx.fill();

      // Pulsars / Variable Stars pulsating ring echoes
      if (star.isPulsar && !this.performanceProfile.skipPulsarRings) {
        star.pulsarPhase += 0.022;
        const pulseRadius = star.radius * (2.2 + Math.sin(star.pulsarPhase) * 1.3);
        const pulseOpacity = (0.5 - Math.sin(star.pulsarPhase) * 0.5) * 0.15 * twinkleOpacity;
        this.ctx.beginPath();
        this.ctx.arc(lCoords.x, lCoords.y, pulseRadius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `${star.color}${pulseOpacity})`;
        this.ctx.lineWidth = 0.8;
        this.ctx.stroke();
      }
    }

    // 3. Draw Parallax Space Dust (Drifting debris)
    const dLength = this.spaceDust.length;
    for (let i = 0; i < dLength; i++) {
      const d = this.spaceDust[i];
      d.x += d.vx;
      d.y += d.vy;

      // wrap boundaries
      if (d.x < -10) d.x = width + 10;
      else if (d.x > width + 10) d.x = -10;
      if (d.y < -10) d.y = height + 10;
      else if (d.y > height + 10) d.y = -10;

      const lCoords = this.getLensedCoords(d.x, d.y);
      this.ctx.beginPath();
      this.ctx.arc(lCoords.x, lCoords.y, d.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(130, 180, 255, ${d.opacity})`;
      this.ctx.fill();
    }

    // 4. Meteor Shower Queue & Random Shooting Star Spawns
    if (this.shootingStars.length < 6) {
      if (this.meteorShowerCount === 0 && Math.random() < 0.0006) {
        this.meteorShowerCount = Math.floor(Math.random() * 5) + 4;
        this.meteorShowerDelay = 0;
      }

      if (this.meteorShowerCount > 0) {
        this.meteorShowerDelay--;
        if (this.meteorShowerDelay <= 0) {
          const prefixList = ['255, 255, 255,', '0, 230, 255,', '255, 100, 230,'];
          const colorPrefix = prefixList[Math.floor(Math.random() * prefixList.length)];
          this.shootingStars.push({
            x: Math.random() * width + width * 0.2,
            y: Math.random() * height * 0.2,
            vx: -Math.random() * 9 - 9,
            vy: Math.random() * 4.5 + 4.5,
            length: Math.random() * 85 + 45,
            alpha: 1.0,
            colorPrefix
          });
          this.meteorShowerCount--;
          this.meteorShowerDelay = Math.floor(Math.random() * 20) + 8;
        }
      }

      if (this.meteorShowerCount === 0 && Math.random() < 0.004) {
        const prefixList = ['255, 255, 255,', '0, 230, 255,'];
        const colorPrefix = prefixList[Math.floor(Math.random() * prefixList.length)];
        this.shootingStars.push({
          x: Math.random() * width + width * 0.15,
          y: Math.random() * height * 0.25,
          vx: -Math.random() * 8 - 8,
          vy: Math.random() * 4 + 4,
          length: Math.random() * 80 + 40,
          alpha: 1.0,
          colorPrefix
        });
      }
    }

    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const s = this.shootingStars[i];
      s.x += s.vx;
      s.y += s.vy;
      s.alpha -= 0.014;

      if (s.x < -s.length || s.y > height + s.length || s.alpha <= 0) {
        this.shootingStars.splice(i, 1);
      } else {
        const grad = this.ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 3.5, s.y - s.vy * 3.5);
        grad.addColorStop(0, `rgba(255, 255, 255, ${s.alpha * 0.95})`);
        grad.addColorStop(0.3, `rgba(${s.colorPrefix}${s.alpha * 0.65})`);
        grad.addColorStop(1, `rgba(${s.colorPrefix}0)`);

        this.ctx.strokeStyle = grad;
        this.ctx.lineWidth = 1.8;
        this.ctx.beginPath();
        this.ctx.moveTo(s.x, s.y);
        this.ctx.lineTo(s.x - s.vx * 3.5, s.y - s.vy * 3.5);
        this.ctx.stroke();
      }
    }

    // 4.5. Draw Background Comets
    this.updateAndDrawComets(width, height);

    // --- COSMIC EVENT BLACKOUT BACKGROUND OVERLAY ---
    if (this.blackoutAlpha > 0) {
      this.ctx.fillStyle = `rgba(0, 0, 0, ${this.blackoutAlpha})`;
      this.ctx.fillRect(0, 0, width, height);
    }

    // --- UPDATE & RENDER SANDBOX SIMULATION ELEMENTS ---
    this.tickSandboxCharge();
    this.tickTeslaHoldZaps();
    this.applyBlackHolePreviewGravity();
    this.updateAndDrawSandboxElements(width, height);
    this.drawSandboxPowerChargeAuras();

    // 5. Draw Charge Aurora ring & charge energy arcs (Nova Strike CHARGING only)
    let chargeProgress = 0;
    if (this.state === 'CHARGING' && this.usesDefaultMouseGravity()) {
      this.chargeTime++;
      chargeProgress = Math.min(1.0, this.chargeTime / 60);

      const auroraRadius = 35 + chargeProgress * 95;
      const pulse = Math.sin(Date.now() / 60) * 10;
      
      const grad = this.ctx.createRadialGradient(
        this.mouse.x, this.mouse.y, 8,
        this.mouse.x, this.mouse.y, auroraRadius + pulse
      );
      grad.addColorStop(0, `rgba(0, 240, 255, ${0.45 * chargeProgress})`);
      grad.addColorStop(0.35, `rgba(230, 100, 255, ${0.28 * chargeProgress})`);
      grad.addColorStop(0.75, `rgba(130, 80, 255, ${0.14 * chargeProgress})`);
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(this.mouse.x, this.mouse.y, auroraRadius + pulse, 0, Math.PI * 2);
      this.ctx.fill();

      // Energy lightning arcs jumping into cursor hotspot from surrounding stars
      if (Math.random() < 0.38) {
        const attractionDist = this.mouseAttractDistance + chargeProgress * 240;
        const nearby = this.findRandomNearbyParticle(this.mouse.x, this.mouse.y, attractionDist);
        if (nearby) {
          this.drawMiniChargeArc(this.mouse.x, this.mouse.y, nearby.x, nearby.y);
        }
      }
    }

    // 6. Render Active Singularity / Moon Corona
    if (this.state === 'SINGULARITY') {
      const progress = (25 - this.stateTimer) / 25;
      this.ctx.beginPath();
      this.ctx.arc(this.singularity.x, this.singularity.y, progress * 24, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(0, 0, 0, ${progress * 0.88})`;
      this.ctx.fill();
      
      this.ctx.beginPath();
      this.ctx.arc(this.singularity.x, this.singularity.y, progress * 25, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(0, 240, 255, ${0.45 + progress * 0.5})`;
      this.ctx.lineWidth = 2.2;
      this.ctx.stroke();
    } else if (this.state === 'MOON_DANCE') {
      const t = Math.min(1.0, (390 - this.stateTimer) / 300);
      const maxRadius = 150 + t * 130 + Math.sin(Date.now() / 80) * 12;
      const alpha = Math.min(0.85, t * 0.85);

      const grad = this.ctx.createRadialGradient(
        this.singularity.x, this.singularity.y, 10,
        this.singularity.x, this.singularity.y, maxRadius
      );
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`);
      grad.addColorStop(0.25, `rgba(0, 240, 255, ${alpha * 0.6})`);
      grad.addColorStop(0.55, `rgba(255, 100, 230, ${alpha * 0.28})`);
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(this.singularity.x, this.singularity.y, maxRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 7. Render active lightning bolt graphics
    for (let i = this.lightnings.length - 1; i >= 0; i--) {
      const l = this.lightnings[i];
      l.alpha -= 0.12;

      if (l.alpha <= 0) {
        this.lightnings.splice(i, 1);
        continue;
      }

      this.ctx.beginPath();
      this.ctx.moveTo(l.segments[0].x, l.segments[0].y);
      for (let j = 1; j < l.segments.length; j++) {
        this.ctx.lineTo(l.segments[j].x, l.segments[j].y);
      }
      this.ctx.strokeStyle = `rgba(255, 120, 240, ${l.alpha * 0.85})`;
      this.ctx.lineWidth = 2.2;
      this.ctx.stroke();

      this.ctx.strokeStyle = `rgba(0, 230, 255, ${l.alpha * 0.4})`;
      this.ctx.lineWidth = 4.5;
      this.ctx.stroke();
    }

    // 8. Render active expanding shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.radius += s.speed;
      s.alpha = 1 - (s.radius / s.maxRadius);

      if (s.alpha <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }

      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(${s.color}, ${s.alpha * 0.45})`;
      this.ctx.lineWidth = 3.0;
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.radius * 0.82, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(255, 100, 230, ${s.alpha * 0.15})`;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
    }

    // 9. Render cursor sparks (supernova debris particles)
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.alpha -= 0.025;

      if (sp.alpha <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }

      this.ctx.beginPath();
      this.ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `${sp.color}${sp.alpha})`;
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(sp.x, sp.y, sp.radius * 2.5, 0, Math.PI * 2);
      this.ctx.fillStyle = `${sp.color}${sp.alpha * 0.25})`;
      this.ctx.fill();
    }

    // 9.5. Spawn, Update & Render Background Blackholes (Spontaneous cosmic events)
    if (this.state === 'DRIFT' && this.backgroundBlackholes.length < 2 && Math.random() < 0.00015) {
      this.backgroundBlackholes.push({
        x: Math.random() * (width - 240) + 120,
        y: Math.random() * (height - 240) + 120,
        radius: 0,
        maxRadius: Math.random() * 6 + 10,
        timer: 240,
        maxTimer: 240
      });
    }

    for (let k = this.backgroundBlackholes.length - 1; k >= 0; k--) {
      const bh = this.backgroundBlackholes[k];
      bh.timer--;
      if (bh.timer <= 0) {
        this.backgroundBlackholes.splice(k, 1);
        continue;
      }

      const elapsed = bh.maxTimer - bh.timer;
      if (elapsed < 50) {
        bh.radius = bh.maxRadius * (elapsed / 50);
      } else if (bh.timer < 50) {
        bh.radius = bh.maxRadius * (bh.timer / 50);
      } else {
        bh.radius = bh.maxRadius;
      }

      const bhRadius = bh.radius;
      for (let j = 0; j < this.particles.length; j++) {
        const p = this.particles[j];
        if (!p || p.isDying || p.birthProgress < 1.0) continue;

        const dx = bh.x - p.x;
        const dy = bh.y - p.y;
        const distSq = dx * dx + dy * dy;
        const pullDist = 110;

        if (distSq < pullDist * pullDist) {
          const dist = Math.sqrt(distSq) || 1;
          const force = (pullDist - dist) / pullDist;
          const pullStrength = force * 0.11;

          p.vx += (dx / dist) * pullStrength * 0.45;
          p.vy += (dy / dist) * pullStrength * 0.45;
          p.vx += (-dy / dist) * pullStrength * 0.25;
          p.vy += (dx / dist) * pullStrength * 0.25;

          if (dist < bhRadius + 2) {
            p.isDying = true;
            p.deathProgress = 1.0;
            this.spawnMiniSupernova(bh.x, bh.y, p.colorPrefix);
          }
        }
      }

      this.ctx.beginPath();
      this.ctx.arc(bh.x, bh.y, bhRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(10, 10, 15, 0.95)';
      this.ctx.fill();

      const pulse = Math.sin(Date.now() / 100 + bh.x) * bhRadius * 0.25;
      this.ctx.beginPath();
      this.ctx.arc(bh.x, bh.y, bhRadius * 1.55 + pulse, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(130, 80, 255, ${0.45 * (bh.radius / bh.maxRadius)})`;
      this.ctx.lineWidth = 2.2;
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(bh.x, bh.y, bhRadius * 1.35 + pulse * 0.5, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(0, 240, 255, ${0.35 * (bh.radius / bh.maxRadius)})`;
      this.ctx.lineWidth = 1.2;
      this.ctx.stroke();
    }

    // 10. Stellar nursery: Random births if particle count drops (maintain ecosystem)
    if (this.particles.length < this.maxParticles && Math.random() < 0.045) {
      this.spawnStellarBirth(Math.random() * width, Math.random() * height);
    }

    // Spawn painted stars during drag if paint brush is active
    if (this.isMouseDown && this.activePower === 'PAINT_BRUSH' && this.mouse.x !== -1000) {
      this.paintHoldFrame++;
      if (this.nurseryStarCount < this.maxNurseryStars && this.paintHoldFrame % 2 === 0) {
        this.spawnNurseryStar(this.mouse.x, this.mouse.y);
      } else if (this.nurseryStarCount >= this.maxNurseryStars && this.paintHoldFrame % 8 === 0) {
        this.spawnStardustPuff(this.mouse.x, this.mouse.y, 'rgba(255, 220, 180,');
      }
    } else {
      this.paintHoldFrame = 0;
    }

    // 11. Update & Render main interactive constellation particles
    const pLength = this.particles.length;
    const glowAmplitude = 0.15 + (Math.sin(Date.now() / 400) + 1.0) * 0.5 * 0.25;

    this.particleSpatialHash.clear();
    for (let h = 0; h < pLength; h++) {
      const ph = this.particles[h];
      this.particleSpatialHash.insert(h, ph.x, ph.y);
    }

    const intenseMesh = this.isIntenseParticleMesh();
    const meshConnectionDist = this.state === 'DRIFT'
      ? this.scaledConnectionDistance * 0.78
      : (this.state === 'MOON_DANCE' ? this.scaledConnectionDistance * 1.35 : this.scaledConnectionDistance);
    const meshLimitSq = meshConnectionDist * meshConnectionDist;
    const flockRange = 180;
    const breedingRange = 18;

    for (let i = pLength - 1; i >= 0; i--) {
      const p = this.particles[i];

      // A. Star Life Cycle Logic
      if (p.birthProgress < 1.0 && this.state !== 'MOON_DANCE') {
        p.birthProgress += p.isNursery ? 0.08 : 0.025;
      }

      if (this.state !== 'MOON_DANCE') {
        if (!p.isDying) {
          p.life -= Math.random() * 0.00007 + 0.00002;
          if (p.life <= 0.12) {
            p.isDying = true;
          }
        } else {
          p.deathProgress += 0.015;
          if (p.deathProgress >= 1.0) {
            if (p.isNursery) {
              this.nurseryStarCount = Math.max(0, this.nurseryStarCount - 1);
            }
            this.spawnMiniSupernova(p.x, p.y, p.colorPrefix);
            this.particles.splice(i, 1);
            continue;
          }
        }
      }

      // B. Singularity / Moon Dance pull physics (Vortex Black-Hole or Orbit Dance)
      if (this.state === 'SINGULARITY') {
        const dx = this.singularity.x - p.x;
        const dy = this.singularity.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < 400) {
          const force = (400 - dist) / 400;
          p.vx += (dx / dist) * force * 1.55;
          p.vy += (dy / dist) * force * 1.55;

          p.vx += (-dy / dist) * force * 0.85;
          p.vy += (dx / dist) * force * 0.85;

          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          const maxSpeed = 10.0;
          if (speed > maxSpeed) {
            p.vx = (p.vx / speed) * maxSpeed;
            p.vy = (p.vy / speed) * maxSpeed;
          }
        }
      } else if (this.state === 'MOON_DANCE') {
        const dx = this.singularity.x - p.x;
        const dy = this.singularity.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (this.stateTimer > 90) {
          // Phase 1: Spiral galaxy inward pull
          // Target orbit radius slowly collapses from 350px down to 80px over 5 seconds (300 frames)
          const t = Math.min(1.0, (390 - this.stateTimer) / 300);
          const targetOrbit = 350 - t * 270;
          
          const radialDiff = dist - targetOrbit;
          const pullStrength = 0.04 + t * 0.06; // pulls tighter as time goes on
          const pullX = (dx / dist) * radialDiff * pullStrength;
          const pullY = (dy / dist) * radialDiff * pullStrength;

          // Tangential swirl speed increases as orbit shrinks (conservation of angular momentum!)
          const orbitSpeed = 2.8 + t * 4.5;
          const tangentX = (-dy / dist) * orbitSpeed;
          const tangentY = (dx / dist) * orbitSpeed;

          // Dynamic wavy wobble
          const waveFactor = Math.sin(Date.now() * 0.007 + i) * (2.2 * (1 - t * 0.5));
          const danceX = (dx / dist) * waveFactor;
          const danceY = (dy / dist) * waveFactor;

          p.vx += pullX + tangentX + danceX;
          p.vy += pullY + tangentY + danceY;

          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
          const maxSpeed = 7.0 + t * 5.0; // speed limit increases as they get sucked in
          if (speed > maxSpeed) {
            p.vx = (p.vx / speed) * maxSpeed;
            p.vy = (p.vy / speed) * maxSpeed;
          }
        } else {
          // Phase 2: Hyper acceleration directly into the core
          p.vx += (dx / dist) * 2.8;
          p.vy += (dy / dist) * 2.8;
          p.vx += (-dy / dist) * 1.5;
          p.vy += (dx / dist) * 1.5;

          // Decelerate/compress at center
          p.vx *= 0.86;
          p.vy *= 0.86;

          // Vanish
          p.birthProgress = Math.max(0, p.birthProgress - 0.035);
        }
      }

      // C. Evaluate Charging Pull Physics (Nova Strike only)
      if (this.state === 'CHARGING' && this.usesDefaultMouseGravity()) {
        const dx = this.mouse.x - p.x;
        const dy = this.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const activeAttractDist = this.mouseAttractDistance + chargeProgress * 240;

        if (dist < activeAttractDist) {
          const chargeForceMultiplier = 0.78 + chargeProgress * 1.5;
          const pullStrength = (activeAttractDist - dist) / activeAttractDist;
          p.vx += (dx / dist) * pullStrength * chargeForceMultiplier;
          p.vy += (dy / dist) * pullStrength * chargeForceMultiplier;

          p.vx += (-dy / dist) * pullStrength * 0.14;
          p.vy += (dx / dist) * pullStrength * 0.14;

          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          const maxSpeed = 8.0 + chargeProgress * 4.0;
          if (speed > maxSpeed) {
            p.vx = (p.vx / speed) * maxSpeed;
            p.vy = (p.vy / speed) * maxSpeed;
          }
        }
      }

      // D. Evaluate Expanding Shockwave Physics
      for (const s of this.shockwaves) {
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < s.radius && dist > s.radius - 60) {
          const force = (1 - dist / s.maxRadius) * 9.5;
          
          // Add chaotic deflection angle to expanding shockwave boundary hits
          const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.0; 
          const speed = force * 0.35 * (Math.random() * 0.5 + 0.75);
          
          p.vx += Math.cos(angle) * speed;
          p.vy += Math.sin(angle) * speed;
          p.colorBlend = Math.max(p.colorBlend, 0.85);
          this.tryWormholeCapture(p, { forceCapture: true });
        }
      }

      // D2. Sandbox black hole + wormhole world physics (persistent until CLEAR)
      for (const sbh of this.sandboxBlackholes) {
        this.applySandboxBlackholeForces(p, sbh);
      }
      this.applyWormholeForcesToParticle(p);

      // E. Evaluate Swarm Gravity Physics (paused briefly when using a sandbox power)
      if (this.state === 'SWARM' && this.isMouseGravityActive()) {
        const dx = this.mouse.x - p.x;
        const dy = this.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < this.mouseAttractDistance) {
          const pullStrength = (this.mouseAttractDistance - dist) / this.mouseAttractDistance;
          p.vx += (dx / dist) * pullStrength * 0.78;
          p.vy += (dy / dist) * pullStrength * 0.78;

          p.vx += (-dy / dist) * pullStrength * 0.12;
          p.vy += (dx / dist) * pullStrength * 0.12;

          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          const maxSpeed = 7.0;
          if (speed > maxSpeed) {
            p.vx = (p.vx / speed) * maxSpeed;
            p.vy = (p.vy / speed) * maxSpeed;
          }
        }
      }

      // Wormhole placement preview suction (before both portals exist)
      if (this.isMouseDown && this.activePower === 'WORMHOLE' && this.wormholes.length < 2 && this.mouse.active && this.mouse.x !== -1000) {
        const charge = this.getSandboxChargeProgress();
        const suctionRadius = 160 + charge * 120;
        const dx = this.mouse.x - p.x;
        const dy = this.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < suctionRadius) {
          const force = (suctionRadius - dist) / suctionRadius;
          p.vx += (dx / dist) * force * (0.5 + charge * 0.8);
          p.vy += (dy / dist) * force * (0.5 + charge * 0.8);
        }
      }

      // Sandbox Repeller Force (while sandbox channel is active)
      if (this.activePower === 'REPELLER' && this.isSandboxPowerChannelActive() && this.mouse.active && this.mouse.x !== -1000) {
        const charge = this.isMouseDown ? this.getSandboxChargeProgress() : 0.2;
        const fieldRadius = 220 + charge * 220;
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < fieldRadius) {
          const force = (fieldRadius - dist) / fieldRadius;
          const repel = 1.2 + charge * 1.8;
          p.vx += (dx / dist) * force * repel;
          p.vy += (dy / dist) * force * repel;
          p.vx += (-dy / dist) * force * (0.15 + charge * 0.35);
          p.vy += (dx / dist) * force * (0.15 + charge * 0.35);
        }
      }

      if (this.inversionNovaTimer > 0 && this.mouse.x !== -1000) {
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 360) {
          const force = (360 - dist) / 360;
          p.vx += (dx / dist) * force * 2.5;
          p.vy += (dy / dist) * force * 2.5;
        }
      }

      // Chrono Well — time slow + gentle inward drift while sandbox channel is active
      if (this.activePower === 'TIME_DILATION' && this.isSandboxPowerChannelActive() && this.mouse.active && this.mouse.x !== -1000) {
        const charge = this.isMouseDown ? this.getSandboxChargeProgress() : 0.25;
        const fieldRadius = 180 + charge * 180;
        const dx = this.mouse.x - p.x;
        const dy = this.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < fieldRadius) {
          const depth = 1 - dist / fieldRadius;
          const slowFactor = 0.55 - depth * (0.25 + charge * 0.25);
          p.vx *= slowFactor;
          p.vy *= slowFactor;

          const pullStrength = depth * (0.18 + charge * 0.22);
          p.vx += (dx / dist) * pullStrength;
          p.vy += (dy / dist) * pullStrength;
          p.vx += (-dy / dist) * pullStrength * 0.35;
          p.vy += (dx / dist) * pullStrength * 0.35;
          p.colorBlend = Math.max(p.colorBlend, 0.45 + depth * (0.35 + charge * 0.25));
        }
      }

      // Sandbox Nebular Wind Force (while sandbox channel active + mouse held)
      if (this.activePower === 'NEBULAR_WIND' && this.isSandboxPowerChannelActive() && this.isMouseDown && this.mouse.active && this.mouse.x !== -1000) {
        const charge = this.getSandboxChargeProgress();
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const reach = 200 + charge * 180;
        if (dist < reach) {
          const force = (reach - dist) / reach;
          const windScale = 0.25 + charge * 0.45;
          p.vx += this.mouseVelocity.x * force * windScale;
          p.vy += this.mouseVelocity.y * force * windScale;
        }
      }

      // Attract a small fraction of stars to the trigger dot when the panel is closed to hint at its existence
      if (!this.isSandboxOpen && p.flockable && !p.isDying && p.birthProgress >= 1.0) {
        const triggerX = width - 41;
        const triggerY = 41;
        const dx = triggerX - p.x;
        const dy = triggerY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 380) {
          const force = (380 - dist) / 380;
          // Apply a gentle pull towards the dot
          p.vx += (dx / dist) * force * 0.16;
          p.vy += (dy / dist) * force * 0.16;
          // Apply a slight swirl
          p.vx += (-dy / dist) * force * 0.08;
          p.vy += (dx / dist) * force * 0.08;
        }
      }

      // F. Apply Nebula wave wobble
      if (p.wobbleTimer > 0) {
        p.wobbleTimer--;
        p.vx += Math.sin(p.wobbleTimer * 0.45) * 0.95;
        p.vy += Math.cos(p.wobbleTimer * 0.45) * 0.95;
      }

      // Compute Flocking forces and update speedFactor (highly optimized: no Math.sqrt)
      let flockForceX = 0;
      let flockForceY = 0;

      if (this.state === 'DRIFT' && p.flockable && !p.isDying && p.birthProgress >= 1.0) {
        let cohesionX = 0;
        let cohesionY = 0;
        let alignmentVx = 0;
        let alignmentVy = 0;
        let separationX = 0;
        let separationY = 0;
        let neighborCount = 0;

        const flockRangeSq = flockRange * flockRange;
        const separationRange = 65; // subtle spacing
        const separationRangeSq = separationRange * separationRange;

        const flockNeighbors = this.particleSpatialHash.queryRadius(p.x, p.y, flockRange, this.spatialQueryBuffer);
        for (let n = 0; n < flockNeighbors.length; n++) {
          const j = flockNeighbors[n];
          if (i === j) continue;
          const p2 = this.particles[j];
          if (!p2 || !p2.flockable || p2.isDying || p2.birthProgress < 1.0) continue;

          const dx = p2.x - p.x;
          const dy = p2.y - p.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < flockRangeSq) {
            cohesionX += p2.x;
            cohesionY += p2.y;
            alignmentVx += p2.vx;
            alignmentVy += p2.vy;
            neighborCount++;

            if (distSq < separationRangeSq) {
              const force = (separationRangeSq - distSq) / separationRangeSq;
              separationX -= (dx / (distSq + 0.1)) * force * 3.5;
              separationY -= (dy / (distSq + 0.1)) * force * 3.5;
            }
          }
        }

        if (neighborCount > 0) {
          const targetCohesionX = cohesionX / neighborCount;
          const targetCohesionY = cohesionY / neighborCount;
          const steerCohesionX = (targetCohesionX - p.x) * 0.0006 * this.flockEasingFactor;
          const steerCohesionY = (targetCohesionY - p.y) * 0.0006 * this.flockEasingFactor;

          const targetAlignVx = alignmentVx / neighborCount;
          const targetAlignVy = alignmentVy / neighborCount;
          const steerAlignX = (targetAlignVx - p.vx) * 0.008 * this.flockEasingFactor;
          const steerAlignY = (targetAlignVy - p.vy) * 0.008 * this.flockEasingFactor;

          flockForceX = steerCohesionX + steerAlignX + separationX;
          flockForceY = steerCohesionY + steerAlignY + separationY;
        }

        // Gentle border containment force to steer them back if they drift too close to the edges
        const border = 120;
        if (p.x < border) flockForceX += (border - p.x) * 0.0008;
        else if (p.x > width - border) flockForceX -= (p.x - (width - border)) * 0.0008;

        if (p.y < border) flockForceY += (border - p.y) * 0.0008;
        else if (p.y > height - border) flockForceY -= (p.y - (height - border)) * 0.0008;
      }

      // Update grouping and speed state
      if (this.state === 'DRIFT') {
        p.behaviorTimer--;
        if (p.behaviorTimer <= 0) {
          const r = Math.random();
          if (p.behaviorState === 'CRUISE') {
            p.behaviorState = r < 0.6 ? 'DECELERATE' : 'BURST';
          } else if (p.behaviorState === 'DECELERATE') {
            p.behaviorState = r < 0.7 ? 'BURST' : 'CRUISE';
          } else { // BURST
            p.behaviorState = r < 0.7 ? 'CRUISE' : 'DECELERATE';
          }

          if (p.behaviorState === 'CRUISE') {
            p.behaviorTimer = Math.floor(Math.random() * 180) + 120;
          } else if (p.behaviorState === 'DECELERATE') {
            p.behaviorTimer = Math.floor(Math.random() * 120) + 90;
          } else { // BURST
            p.behaviorTimer = Math.floor(Math.random() * 50) + 40;
          }
        }

        let targetSpeed = 1.0;
        let lerpSpeed = 0.05;
        if (p.behaviorState === 'DECELERATE') {
          targetSpeed = 0.5;
          lerpSpeed = 0.02;
        } else if (p.behaviorState === 'BURST') {
          targetSpeed = 2.0;
          lerpSpeed = 0.08;
        }
        p.speedFactor += (targetSpeed - p.speedFactor) * lerpSpeed;
      } else {
        // Fast transition back to standard speed multiplier during mouse actions
        p.speedFactor += (1.0 - p.speedFactor) * 0.15;
      }

      // Apply Flocking forces
      p.vx += flockForceX;
      p.vy += flockForceY;

      // Cap drift speed to keep movement elegant
      if (this.state === 'DRIFT') {
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
        const maxDriftSpeed = 1.6;
        if (speed > maxDriftSpeed) {
          p.vx = (p.vx / speed) * maxDriftSpeed;
          p.vy = (p.vy / speed) * maxDriftSpeed;
        }
      }

      // G. Decelerate / Spring back to base velocities (spring drag)
      const dragFactor = this.state === 'DRIFT' ? 0.008 : 0.035;
      p.vx += (p.baseVx - p.vx) * dragFactor;
      p.vy += (p.baseVy - p.vy) * dragFactor;

      // Update positions
      p.x += p.vx * p.speedFactor;
      p.y += p.vy * p.speedFactor;

      // Wrap boundaries
      const padding = 20;
      if (p.x < -padding) p.x = width + padding;
      else if (p.x > width + padding) p.x = -padding;

      if (p.y < -padding) p.y = height + padding;
      else if (p.y > height + padding) p.y = -padding;

      // Decay color blend
      p.colorBlend *= 0.94;

      // H. Draw Node based on life cycle stage
      let currentRadius = p.radius;
      if (p.birthProgress < 1.0) {
        currentRadius = p.radius * p.birthProgress;
      } else if (p.isDying) {
        currentRadius = p.radius * (1.0 - p.deathProgress);
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
      
      if (p.birthProgress < 1.0) {
        this.ctx.fillStyle = `${p.colorPrefix}${p.birthProgress * 0.95})`;
      } else if (p.isDying) {
        this.ctx.fillStyle = `rgba(255, 80, 50, ${0.9 - p.deathProgress * 0.8})`;
      } else {
        if (this.state === 'DRIFT' && p.behaviorState === 'DECELERATE') {
          const pulse = (Math.sin(Date.now() / 150 + p.x) + 1.0) * 0.5;
          this.ctx.fillStyle = `${p.colorPrefix}${0.8 + pulse * 0.2})`;
        } else {
          this.ctx.fillStyle = p.colorBlend > 0.08 
            ? `${p.colorPrefix}0.95)` 
            : 'rgba(255, 255, 255, 0.88)';
        }
      }
      this.ctx.fill();

      // Render outer glowing halo
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, currentRadius * 2.8, 0, Math.PI * 2);
      if (p.birthProgress < 1.0) {
        this.ctx.fillStyle = `${p.colorPrefix}${p.birthProgress * 0.22})`;
      } else if (p.isDying) {
        this.ctx.fillStyle = `rgba(255, 80, 50, ${0.15 - p.deathProgress * 0.15})`;
      } else {
        if (this.state === 'DRIFT' && p.behaviorState === 'DECELERATE') {
          const pulse = (Math.sin(Date.now() / 150 + p.x) + 1.0) * 0.5;
          this.ctx.fillStyle = `${p.colorPrefix}${0.25 + pulse * 0.35})`;
        } else {
          this.ctx.fillStyle = p.colorBlend > 0.08
            ? `${p.colorPrefix}${0.25 + p.colorBlend * 0.5})`
            : `${p.colorPrefix}${0.15 + glowAmplitude})`;
        }
      }
      this.ctx.fill();

      // I. Particle mating/breeding (on close collision)
      if (!this.performanceProfile.skipBreeding && !p.isDying && p.birthProgress >= 1.0) {
        const breedingRangeSq = breedingRange * breedingRange;
        const breedNeighbors = this.particleSpatialHash.queryRadius(p.x, p.y, breedingRange, this.spatialQueryBuffer);
        for (let n = 0; n < breedNeighbors.length; n++) {
          const j = breedNeighbors[n];
          if (j >= i) continue;
          const p2 = this.particles[j];
          if (p2.isDying || p2.birthProgress < 1.0) continue;

          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < breedingRangeSq) {
            if (Math.random() < 0.005) {
              const mx = (p.x + p2.x) / 2;
              const my = (p.y + p2.y) / 2;
              this.spawnStellarBirth(mx, my);
              this.spawnStardustPuff(mx, my, 'rgba(255, 100, 230,');
            }
          }
        }
      }

      // J. Render constellation links
      let linksDrawn = 0;
      const linkNeighbors = this.particleSpatialHash.queryRadius(p.x, p.y, meshConnectionDist, this.spatialQueryBuffer);
      for (let n = 0; n < linkNeighbors.length; n++) {
        const j = linkNeighbors[n];
        if (j >= i) continue;
        if (intenseMesh && linksDrawn >= BackgroundCanvasComponent.MAX_LINKS_INTENSE) {
          break;
        }
        const p2 = this.particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < meshLimitSq) {
          const dist = Math.sqrt(distSq);
          
          let baseAlphaCoeff = this.state === 'DRIFT' ? 0.16 : 0.35;
          if (this.state === 'MOON_DANCE') {
            baseAlphaCoeff = 0.50; // extra glow for the cosmic whirlpool mesh
          }
          let alpha = (1 - dist / meshConnectionDist) * baseAlphaCoeff;
          if ((this.state === 'SWARM' || this.state === 'CHARGING') && this.isMouseGravityActive()) {
            alpha *= 1.45;
          } else if (this.state === 'DRIFT' && p.behaviorState === 'DECELERATE' && p2.behaviorState === 'DECELERATE') {
            alpha *= 1.25;
          }

          if (p.isDying) alpha *= (1.0 - p.deathProgress);
          if (p2.isDying) alpha *= (1.0 - p2.deathProgress);

          if (alpha > 0.01) {
            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(p2.x, p2.y);
            
            const maxBlend = Math.max(p.colorBlend, p2.colorBlend);
            let strokeStyle = '';
            let lineWidth = 0.6;

            if (maxBlend > 0.08) {
              strokeStyle = `${p.colorPrefix}${alpha * (0.5 + maxBlend * 0.5)})`;
              lineWidth = 1.15;
            } else if (this.state === 'DRIFT' && p.behaviorState === 'DECELERATE' && p2.behaviorState === 'DECELERATE') {
              strokeStyle = `${p.colorPrefix}${alpha * 0.95})`;
              lineWidth = 1.0;
            } else {
              strokeStyle = `${p.colorPrefix}${alpha * 0.55})`;
              lineWidth = 0.6;
            }
              
            this.ctx.strokeStyle = strokeStyle;
            this.ctx.lineWidth = lineWidth;
            this.ctx.stroke();
            linksDrawn++;
          }
        }
      }

      // Draw gravity attraction beams (SWARM / CHARGING when cursor gravity is active)
      if ((this.state === 'SWARM' || this.state === 'CHARGING') && this.isMouseGravityActive()) {
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        const distSq = dx * dx + dy * dy;
        const activeAttractDist = this.state === 'CHARGING'
          ? (this.mouseAttractDistance + chargeProgress * 240)
          : this.mouseAttractDistance;
        const mLimitSq = activeAttractDist * activeAttractDist;

        if (distSq < mLimitSq) {
          const dist = Math.sqrt(distSq);
          let alpha = (1 - dist / activeAttractDist) * 0.45;
          if (p.isDying) alpha *= (1.0 - p.deathProgress);

          if (alpha > 0.01) {
            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(this.mouse.x, this.mouse.y);
            
            this.ctx.strokeStyle = this.state === 'CHARGING'
              ? `rgba(0, 240, 255, ${alpha * (0.55 + chargeProgress * 0.45)})`
              : `rgba(0, 230, 255, ${alpha * (0.55 + glowAmplitude * 0.4)})`;
              
            this.ctx.lineWidth = this.state === 'CHARGING' ? 1.25 : 1.0;
            this.ctx.stroke();
          }
        }
      } else if (this.activePower === 'REPELLER' && this.isSandboxPowerChannelActive() && this.mouse.active && this.mouse.x !== -1000) {
        const charge = this.isMouseDown ? this.getSandboxChargeProgress() : 0.2;
        const repelRadius = 220 + charge * 220;
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        const distSq = dx * dx + dy * dy;
        const repelLimitSq = repelRadius * repelRadius;

        if (distSq < repelLimitSq && distSq > 1) {
          const dist = Math.sqrt(distSq);
          let alpha = (1 - dist / repelRadius) * 0.32;
          if (p.isDying) alpha *= (1.0 - p.deathProgress);

          if (alpha > 0.01) {
            const pushX = p.x + (dx / dist) * 18;
            const pushY = p.y + (dy / dist) * 18;
            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(pushX, pushY);
            this.ctx.strokeStyle = `rgba(255, 120, 190, ${alpha})`;
            this.ctx.lineWidth = 1.0;
            this.ctx.stroke();
          }
        }
      } else if (this.activePower === 'TIME_DILATION' && this.isSandboxPowerChannelActive() && this.mouse.active && this.mouse.x !== -1000) {
        const charge = this.isMouseDown ? this.getSandboxChargeProgress() : 0.25;
        const wellRadius = 180 + charge * 180;
        const dx = this.mouse.x - p.x;
        const dy = this.mouse.y - p.y;
        const distSq = dx * dx + dy * dy;
        const wellLimitSq = wellRadius * wellRadius;

        if (distSq < wellLimitSq && distSq > 1) {
          const dist = Math.sqrt(distSq);
          let alpha = (1 - dist / wellRadius) * 0.32;
          if (p.isDying) alpha *= (1.0 - p.deathProgress);

          if (alpha > 0.01) {
            const pullX = p.x + (dx / dist) * 12;
            const pullY = p.y + (dy / dist) * 12;
            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(pullX, pullY);
            this.ctx.strokeStyle = `rgba(120, 220, 255, ${alpha})`;
            this.ctx.lineWidth = 1.0;
            this.ctx.stroke();
          }
        }
      }

      // K. Connect particles to UI element anchors
      const aLength = this.uiAnchors.length;
      for (let j = 0; j < aLength; j++) {
        const anchor = this.uiAnchors[j];
        const dx = p.x - anchor.x;
        const dy = p.y - anchor.y;
        const distSq = dx * dx + dy * dy;
        const anchorLimitSq = 100 * 100;

        if (distSq < anchorLimitSq) {
          const dist = Math.sqrt(distSq);
          let alpha = (1 - dist / 100) * 0.20;
          
          if (p.isDying) alpha *= (1.0 - p.deathProgress);
          
          // Boost opacity if mouse is near the UI element
          const mdx = this.mouse.x - anchor.x;
          const mdy = this.mouse.y - anchor.y;
          if (Math.sqrt(mdx * mdx + mdy * mdy) < 220) {
            alpha *= 1.8;
          }

          if (alpha > 0.01) {
            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(anchor.x, anchor.y);
            
            this.ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
            this.ctx.lineWidth = 0.65;
            this.ctx.stroke();
          }
        }
      }
    }

    // 12. Render active easter egg constellations (Super Move outlines)
    this.drawEasterEggs();

    // --- RESTORE SCREEN SHAKE TRANSFORMATION ---
    if (this.shakeTimer > 0) {
      this.ctx.restore();
    }

    // --- SCREEN FLASH OVERLAY (Big Bang flash) ---
    if (this.screenFlash > 0) {
      this.screenFlash--;
      const flashAlpha = this.screenFlash / 14;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
      this.ctx.fillRect(0, 0, width, height);
    }
  }

  // --- SANDBOX CONTROL PANEL METHODS ---
  public toggleSandboxBar(): void {
    this.isSandboxOpen = !this.isSandboxOpen;
  }

  public toggleSandboxPin(): void {
    this.isSandboxPinned = !this.isSandboxPinned;
  }
  
  public selectPower(power: MousePower): void {
    this.activePower = power;
  }
  
  public clearSandboxElements(): void {
    this.sandboxBlackholes = [];
    this.wormholes = [];
    this.wormholeHypergateTimer = 0;
    this.inversionNovaTimer = 0;
    this.particles = this.particles.filter(p => !p.isNursery);
    this.nurseryStarCount = 0;
    this.paintHoldFrame = 0;
  }

  private getSandboxChargeProgress(): number {
    return Math.min(1, this.chargeTime / 60);
  }

  private getSandboxChargeTier(): SandboxChargeTier {
    if (this.chargeTime >= 60) {
      return 'super';
    }
    if (this.chargeTime >= 12) {
      return 'charged';
    }
    return 'tap';
  }

  private isSandboxSuperCharged(): boolean {
    return this.chargeTime >= 60;
  }

  private tickSandboxCharge(): void {
    if (this.isMouseDown && this.activePower !== 'DEFAULT') {
      this.chargeTime++;
    }
  }

  private drawSandboxChargeAura(
    innerColor: string,
    midColor: string,
    outerColor: string,
    baseRadius = 35
  ): void {
    if (!this.isMouseDown || this.mouse.x === -1000) {
      return;
    }

    const chargeProgress = this.getSandboxChargeProgress();
    const auroraRadius = baseRadius + chargeProgress * 95;
    const pulse = Math.sin(Date.now() / 60) * 10;

    const grad = this.ctx.createRadialGradient(
      this.mouse.x, this.mouse.y, 8,
      this.mouse.x, this.mouse.y, auroraRadius + pulse
    );
    grad.addColorStop(0, innerColor.replace('ALPHA', String(0.45 * chargeProgress)));
    grad.addColorStop(0.35, midColor.replace('ALPHA', String(0.28 * chargeProgress)));
    grad.addColorStop(0.75, outerColor.replace('ALPHA', String(0.14 * chargeProgress)));
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(this.mouse.x, this.mouse.y, auroraRadius + pulse, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawSandboxPowerChargeAuras(): void {
    if (!this.isMouseDown || this.mouse.x === -1000) {
      return;
    }

    switch (this.activePower) {
      case 'BLACK_HOLE':
        this.drawBlackHolePreview();
        break;
      case 'TESLA_DISCHARGE':
        this.drawSandboxChargeAura(
          'rgba(180, 220, 255, ALPHA)',
          'rgba(120, 180, 255, ALPHA)',
          'rgba(80, 140, 255, ALPHA)'
        );
        break;
      case 'REPELLER':
        this.drawSandboxChargeAura(
          'rgba(255, 140, 200, ALPHA)',
          'rgba(255, 100, 170, ALPHA)',
          'rgba(255, 70, 130, ALPHA)'
        );
        break;
      case 'TIME_DILATION':
        this.drawSandboxChargeAura(
          'rgba(0, 240, 255, ALPHA)',
          'rgba(80, 200, 255, ALPHA)',
          'rgba(120, 160, 255, ALPHA)'
        );
        break;
      case 'NEBULAR_WIND':
        this.drawSandboxChargeAura(
          'rgba(120, 220, 255, ALPHA)',
          'rgba(80, 180, 255, ALPHA)',
          'rgba(60, 140, 255, ALPHA)',
          28
        );
        break;
      case 'PAINT_BRUSH':
        this.drawSandboxChargeAura(
          'rgba(255, 220, 180, ALPHA)',
          'rgba(255, 180, 140, ALPHA)',
          'rgba(255, 140, 120, ALPHA)',
          30
        );
        break;
      case 'WORMHOLE':
        this.drawSandboxChargeAura(
          'rgba(0, 240, 255, ALPHA)',
          'rgba(255, 100, 230, ALPHA)',
          'rgba(140, 120, 255, ALPHA)'
        );
        break;
    }
  }

  private handleSandboxPowerRelease(): void {
    const tier = this.getSandboxChargeTier();

    switch (this.activePower) {
      case 'BLACK_HOLE':
        this.spawnSandboxBlackhole(this.mouse.x, this.mouse.y, tier);
        break;
      case 'TESLA_DISCHARGE':
        this.triggerTeslaDischargePower(tier === 'tap' ? 'tap' : tier === 'charged' ? 'charged' : 'super');
        break;
      case 'REPELLER':
        this.releaseRepellerPower(tier);
        break;
      case 'TIME_DILATION':
        this.releaseTimeDilationPower(tier);
        break;
      case 'NEBULAR_WIND':
        this.releaseNebularWindPower(tier);
        break;
      case 'PAINT_BRUSH':
        this.releasePaintBrushPower(tier);
        break;
      case 'WORMHOLE':
        this.releaseWormholePower(tier);
        break;
    }
  }

  private spawnSandboxBlackhole(x: number, y: number, tier: SandboxChargeTier): void {
    if (tier === 'tap') {
      this.sandboxBlackholes.push({
        x,
        y,
        radius: 0,
        maxRadius: Math.random() * 8 + 18,
        timer: 0,
        maxTimer: 600,
        pullRadius: 340,
        gravityStrength: 1.2
      });
      return;
    }

    if (tier === 'charged') {
      this.sandboxBlackholes.push({
        x,
        y,
        radius: 0,
        maxRadius: Math.random() * 7 + 28,
        timer: 0,
        maxTimer: 720,
        pullRadius: 460,
        gravityStrength: 2.4
      });
      this.shakeTimer = Math.max(this.shakeTimer, 8);
      return;
    }

    this.sandboxBlackholes.push({
      x,
      y,
      radius: 0,
      maxRadius: Math.random() * 15 + 40,
      timer: 0,
      maxTimer: 900,
      pullRadius: 560,
      gravityStrength: 3.5
    });
    this.shakeTimer = 22;
  }

  private applyBlackHolePreviewGravity(): void {
    if (!this.isSandboxPowerEngaged() || this.activePower !== 'BLACK_HOLE' || this.mouse.x === -1000) {
      return;
    }

    const charge = this.getSandboxChargeProgress();
    const pullRadius = 280 + charge * 220;
    const gravity = 1.0 + charge * 2.2;

    for (const p of this.particles) {
      if (p.isDying || p.birthProgress < 1.0) {
        continue;
      }

      const dx = this.mouse.x - p.x;
      const dy = this.mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      if (dist < pullRadius) {
        const force = (pullRadius - dist) / pullRadius;
        p.vx += (dx / dist) * force * gravity;
        p.vy += (dy / dist) * force * gravity;
        p.vx += (-dy / dist) * force * (gravity * 0.55);
        p.vy += (dx / dist) * force * (gravity * 0.55);
        p.colorBlend = Math.max(p.colorBlend, 0.45 + charge * 0.4);
      }
    }
  }

  private drawBlackHolePreview(): void {
    if (!this.isSandboxPowerEngaged() || this.activePower !== 'BLACK_HOLE' || this.mouse.x === -1000) {
      return;
    }

    const charge = this.getSandboxChargeProgress();
    const previewRadius = 14 + charge * 28;
    const pullRadius = 280 + charge * 220;
    const pulse = Math.sin(Date.now() / 80) * previewRadius * 0.15;

    this.ctx.beginPath();
    this.ctx.arc(this.mouse.x, this.mouse.y, pullRadius, 0, Math.PI * 2);
    this.ctx.strokeStyle = `rgba(230, 100, 255, ${0.12 + charge * 0.22})`;
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([10, 14]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    this.ctx.beginPath();
    this.ctx.arc(this.mouse.x, this.mouse.y, previewRadius + pulse, 0, Math.PI * 2);
    this.ctx.fillStyle = `rgba(2, 4, 10, ${0.75 + charge * 0.2})`;
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.arc(this.mouse.x, this.mouse.y, previewRadius * 1.6 + pulse, 0, Math.PI * 2);
    this.ctx.strokeStyle = `rgba(0, 240, 255, ${0.35 + charge * 0.45})`;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }

  private releaseRepellerPower(tier: SandboxChargeTier): void {
    if (tier === 'tap') {
      this.shockwaves.push({
        x: this.mouse.x,
        y: this.mouse.y,
        radius: 0,
        maxRadius: 180,
        speed: 9,
        alpha: 0.85,
        color: '255, 120, 190'
      });
      this.blastParticlesAway(this.mouse.x, this.mouse.y, 8);
      return;
    }

    if (tier === 'charged') {
      this.shockwaves.push({
        x: this.mouse.x,
        y: this.mouse.y,
        radius: 0,
        maxRadius: 280,
        speed: 8,
        alpha: 0.9,
        color: '255, 100, 210'
      });
      this.blastParticlesAway(this.mouse.x, this.mouse.y, 14);
      return;
    }

    this.inversionNovaTimer = 30;
    this.shakeTimer = 18;
    this.blastParticlesAway(this.mouse.x, this.mouse.y, 20);
    this.shockwaves.push({
      x: this.mouse.x,
      y: this.mouse.y,
      radius: 0,
      maxRadius: 400,
      speed: 9.5,
      alpha: 1,
      color: '255, 100, 230'
    });
    this.shockwaves.push({
      x: this.mouse.x,
      y: this.mouse.y,
      radius: 0,
      maxRadius: 320,
      speed: 7,
      alpha: 0.85,
      color: '255, 160, 220'
    });
  }

  private releaseTimeDilationPower(tier: SandboxChargeTier): void {
    const radius = tier === 'tap' ? 180 : tier === 'charged' ? 280 : 360;
    const slowFactor = tier === 'tap' ? 0.78 : tier === 'charged' ? 0.42 : 0.12;

    for (const p of this.particles) {
      if (p.isDying || p.birthProgress < 1.0) {
        continue;
      }

      const dx = p.x - this.mouse.x;
      const dy = p.y - this.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      if (dist < radius) {
        const depth = 1 - dist / radius;
        const damp = slowFactor - depth * (tier === 'super' ? 0.04 : 0.12);
        p.vx *= damp;
        p.vy *= damp;

        if (tier !== 'tap') {
          p.vx += (-dy / dist) * depth * (0.25 + (tier === 'super' ? 0.35 : 0.15));
          p.vy += (dx / dist) * depth * (0.25 + (tier === 'super' ? 0.35 : 0.15));
        }

        p.colorBlend = Math.max(p.colorBlend, 0.55 + depth * (tier === 'super' ? 0.45 : 0.3));
      }
    }

    if (tier === 'super') {
      this.shockwaves.push({
        x: this.mouse.x,
        y: this.mouse.y,
        radius: 0,
        maxRadius: 260,
        speed: 3.5,
        alpha: 0.45,
        color: '0, 220, 255'
      });
    } else if (tier === 'charged') {
      this.shockwaves.push({
        x: this.mouse.x,
        y: this.mouse.y,
        radius: 0,
        maxRadius: 190,
        speed: 2.8,
        alpha: 0.28,
        color: '0, 210, 255'
      });
    }
  }

  private releaseNebularWindPower(tier: SandboxChargeTier): void {
    const speed = Math.sqrt(this.mouseVelocity.x ** 2 + this.mouseVelocity.y ** 2);
    const vxNorm = speed > 0.5 ? this.mouseVelocity.x / speed : 1;
    const vyNorm = speed > 0.5 ? this.mouseVelocity.y / speed : 0;
    const gustStrength = tier === 'tap' ? 6 : tier === 'charged' ? 11 : 18;

    for (const p of this.particles) {
      const dx = p.x - this.mouse.x;
      const dy = p.y - this.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const reach = tier === 'super' ? 420 : tier === 'charged' ? 320 : 200;

      if (dist < reach) {
        const force = (reach - dist) / reach;
        p.vx += vxNorm * force * gustStrength;
        p.vy += vyNorm * force * gustStrength;
        p.colorBlend = Math.max(p.colorBlend, 0.55 + force * 0.35);
      }
    }

    if (tier === 'super') {
      this.shakeTimer = 12;
      this.shockwaves.push({
        x: this.mouse.x,
        y: this.mouse.y,
        radius: 0,
        maxRadius: 380,
        speed: 10,
        alpha: 0.95,
        color: '100, 200, 255'
      });
    }
  }

  private releasePaintBrushPower(tier: SandboxChargeTier): void {
    const remaining = this.maxNurseryStars - this.nurseryStarCount;
    if (remaining <= 0) {
      this.spawnStardustPuff(this.mouse.x, this.mouse.y, 'rgba(255, 220, 180,');
      return;
    }

    if (tier === 'tap') {
      this.spawnNurseryStar(this.mouse.x, this.mouse.y);
      return;
    }

    if (tier === 'charged') {
      const burst = Math.min(4, remaining);
      for (let i = 0; i < burst; i++) {
        const angle = (Math.PI * 2 * i) / burst;
        this.spawnNurseryStar(
          this.mouse.x + Math.cos(angle) * 24,
          this.mouse.y + Math.sin(angle) * 24
        );
      }
      return;
    }

    const burst = Math.min(10, remaining);
    for (let i = 0; i < burst; i++) {
      const angle = i * 0.85;
      const dist = 18 + i * 7;
      this.spawnNurseryStar(
        this.mouse.x + Math.cos(angle) * dist,
        this.mouse.y + Math.sin(angle) * dist
      );
    }
    this.shockwaves.push({
      x: this.mouse.x,
      y: this.mouse.y,
      radius: 0,
      maxRadius: 160,
      speed: 5,
      alpha: 0.7,
      color: '255, 220, 180'
    });
  }

  private tryWormholeCapture(p: Particle, opts?: { forceCapture?: boolean }): boolean {
    if (p.isDying || p.birthProgress < 1.0 || this.wormholes.length !== 2) {
      return false;
    }

    const entry = this.wormholes[0];
    const exit = this.wormholes[1];
    const hypergateActive = this.wormholeHypergateTimer > 0;
    const captureRadius = entry.radius * (hypergateActive ? 1.8 : 1);
    const dx = p.x - entry.x;
    const dy = p.y - entry.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);

    if (dist >= captureRadius) {
      return false;
    }

    if (!opts?.forceCapture && speed < 3.5 && dist > captureRadius * 0.55) {
      return false;
    }

    p.x = exit.x + (Math.random() - 0.5) * 8;
    p.y = exit.y + (Math.random() - 0.5) * 8;

    const launchSpeed = hypergateActive ? 12 : 8;
    const launchAngle = Math.random() * Math.PI * 2;
    const launch = Math.random() * launchSpeed + 5.5;
    p.vx = Math.cos(launchAngle) * launch;
    p.vy = Math.sin(launchAngle) * launch;
    p.colorBlend = 1.0;

    this.spawnStardustPuff(entry.x, entry.y, 'rgba(0, 240, 255,');
    this.spawnStardustPuff(exit.x, exit.y, 'rgba(255, 100, 230,');
    return true;
  }

  private applyWormholeForcesToParticle(p: Particle): void {
    if (p.isDying || p.birthProgress < 1.0 || this.wormholes.length !== 2) {
      return;
    }

    const entry = this.wormholes[0];
    const hypergateActive = this.wormholeHypergateTimer > 0;
    const entryReach = entry.radius * (hypergateActive ? 2.2 : 1) + 10;
    const pullStrength = hypergateActive ? 1.35 : 0.65;

    const dx = entry.x - p.x;
    const dy = entry.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    if (dist < entryReach) {
      p.vx += (dx / dist) * pullStrength;
      p.vy += (dy / dist) * pullStrength;
      this.tryWormholeCapture(p);
    }
  }

  private applySandboxBlackholeForces(p: Particle, sbh: SandboxBlackhole): void {
    if (p.isDying || p.birthProgress < 1.0) {
      return;
    }

    const sbhRadius = sbh.radius;
    const dx = sbh.x - p.x;
    const dy = sbh.y - p.y;
    const distSq = dx * dx + dy * dy;
    const pullDist = sbh.pullRadius;
    const gravity = sbh.gravityStrength;

    if (distSq >= pullDist * pullDist) {
      return;
    }

    const dist = Math.sqrt(distSq) || 1;
    const force = (pullDist - dist) / pullDist;
    p.vx += (dx / dist) * force * gravity;
    p.vy += (dy / dist) * force * gravity;

    p.vx += (-dy / dist) * force * (gravity * 0.58);
    p.vy += (dx / dist) * force * (gravity * 0.58);

    if (dist < sbhRadius * 2.5) {
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const maxInward = 6 + gravity * 2.5;
      if (speed > maxInward) {
        p.vx = (p.vx / speed) * maxInward;
        p.vy = (p.vy / speed) * maxInward;
      }
    }

    if (dist < sbhRadius + 6) {
      if (this.wormholes.length === 2) {
        const entry = this.wormholes[0];
        const edx = entry.x - p.x;
        const edy = entry.y - p.y;
        const edist = Math.sqrt(edx * edx + edy * edy) || 1;
        p.vx += (edx / edist) * 3.5;
        p.vy += (edy / edist) * 3.5;
        this.tryWormholeCapture(p, { forceCapture: true });
      } else {
        p.isDying = true;
        p.deathProgress = 1.0;
        if (p.isNursery) {
          this.nurseryStarCount = Math.max(0, this.nurseryStarCount - 1);
        }
        this.spawnMiniSupernova(sbh.x, sbh.y, p.colorPrefix);
      }
    }
  }

  private placeWormholePortal(): void {
    if (this.wormholes.length < 2) {
      const type = this.wormholes.length === 0 ? 'ENTRY' : 'EXIT';
      this.wormholes.push({
        x: this.mouse.x,
        y: this.mouse.y,
        radius: 30,
        type,
        pulsePhase: Math.random() * Math.PI
      });
      return;
    }

    const first = this.wormholes[0];
    const second = this.wormholes[1];
    const dFirst = (this.mouse.x - first.x) ** 2 + (this.mouse.y - first.y) ** 2;
    const dSecond = (this.mouse.x - second.x) ** 2 + (this.mouse.y - second.y) ** 2;
    const nearest = dFirst <= dSecond ? first : second;
    nearest.x = this.mouse.x;
    nearest.y = this.mouse.y;
  }

  private releaseWormholePower(tier: SandboxChargeTier): void {
    if (tier === 'super' && this.wormholes.length === 2) {
      this.wormholeHypergateTimer = 180;
      this.shakeTimer = 14;
      return;
    }

    this.placeWormholePortal();
  }

  private triggerTeslaDischargePower(intensity: 'tap' | 'charged' | 'super' = 'tap'): void {
    const config = {
      tap: { maxTargets: 6, radius: 500, blast: 14, chain: false },
      charged: { maxTargets: 10, radius: 550, blast: 16, chain: false },
      super: { maxTargets: 25, radius: 600, blast: 18, chain: true }
    }[intensity];

    const sorted = [...this.particles]
      .map(p => {
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        return { particle: p, dist: Math.sqrt(dx * dx + dy * dy) };
      })
      .sort((a, b) => a.dist - b.dist);

    const targetCount = Math.min(config.maxTargets, sorted.length);
    const struck: Particle[] = [];

    for (let i = 0; i < targetCount; i++) {
      const p = sorted[i].particle;
      const dx = p.x - this.mouse.x;
      const dy = p.y - this.mouse.y;
      const dist = sorted[i].dist || 1;

      if (dist < config.radius) {
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.4;
        p.vx = Math.cos(angle) * config.blast;
        p.vy = Math.sin(angle) * config.blast;
        p.colorBlend = 1.0;
        struck.push(p);

        const segments = [];
        const steps = intensity === 'super' ? 6 : 4;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const baseOffset = (intensity === 'super' ? 22 : 15) * (1 - t);
          const ox = (s === 0 || s === steps) ? 0 : (Math.random() - 0.5) * baseOffset;
          const oy = (s === 0 || s === steps) ? 0 : (Math.random() - 0.5) * baseOffset;
          segments.push({
            x: this.mouse.x + (p.x - this.mouse.x) * t + ox,
            y: this.mouse.y + (p.y - this.mouse.y) * t + oy
          });
        }
        this.lightnings.push({ segments, alpha: 1.0 });
      }
    }

    if (config.chain && struck.length > 1) {
      for (let i = 0; i < struck.length - 1 && i < 14; i++) {
        const a = struck[i];
        const b = struck[i + 1];
        this.lightnings.push({
          segments: [
            { x: a.x, y: a.y },
            { x: (a.x + b.x) / 2 + (Math.random() - 0.5) * 20, y: (a.y + b.y) / 2 + (Math.random() - 0.5) * 20 },
            { x: b.x, y: b.y }
          ],
          alpha: 0.85
        });
      }
    }

    if (intensity === 'super') {
      this.shakeTimer = 25;
      this.screenFlash = 8;
      this.blastParticlesAway(this.mouse.x, this.mouse.y, 18);
    }
  }

  private tickTeslaHoldZaps(): void {
    if (!this.isMouseDown || this.activePower !== 'TESLA_DISCHARGE' || this.mouse.x === -1000) {
      return;
    }

    this.teslaHoldZapTimer++;
    if (this.teslaHoldZapTimer % 8 !== 0) {
      return;
    }

    const charge = this.getSandboxChargeProgress();
    const zapCount = Math.max(1, Math.floor((2 + Math.floor(charge * 3)) * this.performanceProfile.effectScale));
    const zapIndices = this.findNearestParticleIndices(this.mouse.x, this.mouse.y, zapCount, 420);

    for (const idx of zapIndices) {
      const p = this.particles[idx];
      if (!p) {
        continue;
      }

      const dx = p.x - this.mouse.x;
      const dy = p.y - this.mouse.y;
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.35;
      p.vx += Math.cos(angle) * 4.5;
      p.vy += Math.sin(angle) * 4.5;
      p.colorBlend = Math.max(p.colorBlend, 0.75);

      this.lightnings.push({
        segments: [
          { x: this.mouse.x, y: this.mouse.y },
          { x: this.mouse.x + (p.x - this.mouse.x) * 0.5 + (Math.random() - 0.5) * 12, y: this.mouse.y + (p.y - this.mouse.y) * 0.5 + (Math.random() - 0.5) * 12 },
          { x: p.x, y: p.y }
        ],
        alpha: 0.75
      });
    }
  }

  private isIntenseParticleMesh(): boolean {
    return this.state === 'MOON_DANCE'
      || this.sandboxBlackholes.length > 0
      || this.wormholes.length > 0
      || (this.isSandboxOpen && this.activePower !== 'DEFAULT');
  }

  private findRandomNearbyParticle(cx: number, cy: number, maxDist: number): Particle | null {
    const maxDistSq = maxDist * maxDist;
    const len = this.particles.length;
    if (len === 0) {
      return null;
    }

    const scanCount = Math.min(12, len);
    const start = Math.floor(Math.random() * len);
    let best: Particle | null = null;
    let bestDistSq = maxDistSq;

    for (let n = 0; n < scanCount; n++) {
      const p = this.particles[(start + n) % len];
      const dx = p.x - cx;
      const dy = p.y - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = p;
      }
    }

    return best;
  }

  private findNearestParticleIndices(cx: number, cy: number, count: number, maxDist: number): number[] {
    const maxDistSq = maxDist * maxDist;
    const nearest: { idx: number; distSq: number }[] = [];

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const dx = p.x - cx;
      const dy = p.y - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq > maxDistSq) {
        continue;
      }

      if (nearest.length < count) {
        nearest.push({ idx: i, distSq });
        if (nearest.length === count) {
          nearest.sort((a, b) => a.distSq - b.distSq);
        }
      } else if (distSq < nearest[nearest.length - 1].distSq) {
        nearest[nearest.length - 1] = { idx: i, distSq };
        nearest.sort((a, b) => a.distSq - b.distSq);
      }
    }

    return nearest.map(entry => entry.idx);
  }

  private updateAndDrawSandboxElements(width: number, height: number): void {
    const hypergateActive = this.wormholeHypergateTimer > 0;

    // 1. Sandbox Black holes — persistent until CLEAR (spawn-in animation only)
    for (const sbh of this.sandboxBlackholes) {
      sbh.timer++;
      if (sbh.timer < 60) {
        sbh.radius = sbh.maxRadius * (sbh.timer / 60);
      } else {
        sbh.radius = sbh.maxRadius;
      }

      const sbhRadius = sbh.radius;
      const pulse = Math.sin(Date.now() / 80 + sbh.x) * sbhRadius * 0.2;

      this.ctx.beginPath();
      this.ctx.arc(sbh.x, sbh.y, sbh.pullRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(230, 100, 255, ${0.08 * (sbh.radius / sbh.maxRadius)})`;
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([6, 10]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      this.ctx.beginPath();
      this.ctx.arc(sbh.x, sbh.y, sbhRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(2, 4, 10, 0.98)';
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(sbh.x, sbh.y, sbhRadius * 1.45 + pulse, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(230, 100, 255, ${0.65 * (sbh.radius / sbh.maxRadius)})`;
      this.ctx.lineWidth = 2.0;
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(sbh.x, sbh.y, sbhRadius * 1.2 + pulse * 0.5, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(0, 240, 255, ${0.45 * (sbh.radius / sbh.maxRadius)})`;
      this.ctx.lineWidth = 1.0;
      this.ctx.stroke();
    }
    
    // 2. Sandbox Wormholes
    const wLen = this.wormholes.length;
    for (let i = 0; i < wLen; i++) {
      const wh = this.wormholes[i];
      wh.pulsePhase += 0.05;
      
      const pulse = Math.sin(wh.pulsePhase) * 4;
      const radius = wh.radius + pulse;
      
      const grad = this.ctx.createRadialGradient(wh.x, wh.y, 2, wh.x, wh.y, radius * 1.5);
      const colorStr = wh.type === 'ENTRY' ? '0, 240, 255' : '255, 100, 230';
      grad.addColorStop(0, `rgba(10, 15, 30, 0.9)`);
      grad.addColorStop(0.5, `rgba(${colorStr}, 0.5)`);
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(wh.x, wh.y, radius * 1.5, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.beginPath();
      this.ctx.arc(wh.x, wh.y, radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(${colorStr}, 0.85)`;
      this.ctx.lineWidth = 2.5;
      this.ctx.stroke();
      
      this.ctx.beginPath();
      for (let j = 0; j < 4; j++) {
        const spiralAngle = wh.pulsePhase + (j * Math.PI) / 2;
        const sx = wh.x + Math.cos(spiralAngle) * (radius * 0.7);
        const sy = wh.y + Math.sin(spiralAngle) * (radius * 0.7);
        this.ctx.moveTo(wh.x, wh.y);
        this.ctx.quadraticCurveTo(wh.x + Math.sin(spiralAngle)*radius*0.4, wh.y + Math.cos(spiralAngle)*radius*0.4, sx, sy);
      }
      this.ctx.strokeStyle = `rgba(${colorStr}, 0.45)`;
      this.ctx.lineWidth = 1.0;
      this.ctx.stroke();
    }
    
    if (this.wormholes.length === 2 && hypergateActive) {
      const entry = this.wormholes[0];
      this.ctx.beginPath();
      this.ctx.arc(entry.x, entry.y, entry.radius * 2.2, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([8, 10]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    // 3. Anti-Gravity repulsion field visual (while gravity paused on click/hold)
    if (this.activePower === 'REPELLER' && this.isSandboxPowerChannelActive() && this.mouse.active && this.mouse.x !== -1000) {
      this.ctx.save();
      const charge = this.isMouseDown ? this.getSandboxChargeProgress() : 0.2;
      const fieldRadius = 220 + charge * 220;
      this.ctx.beginPath();
      this.ctx.arc(this.mouse.x, this.mouse.y, fieldRadius, 0, Math.PI * 2);
      const repelGrad = this.ctx.createRadialGradient(this.mouse.x, this.mouse.y, 18, this.mouse.x, this.mouse.y, fieldRadius);
      repelGrad.addColorStop(0, 'rgba(255, 100, 180, 0.06)');
      repelGrad.addColorStop(0.55, 'rgba(255, 80, 120, 0.14)');
      repelGrad.addColorStop(1.0, 'rgba(255, 60, 100, 0.28)');
      this.ctx.fillStyle = repelGrad;
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(this.mouse.x, this.mouse.y, fieldRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(255, 120, 180, 0.35)';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([6, 10]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      this.ctx.restore();
    }

    // 4. Chrono Well bubble visual (while gravity paused on click/hold)
    if (this.activePower === 'TIME_DILATION' && this.isSandboxPowerChannelActive() && this.mouse.active && this.mouse.x !== -1000) {
      this.ctx.save();
      const charge = this.isMouseDown ? this.getSandboxChargeProgress() : 0.25;
      const bubbleRadius = 180 + charge * 180;
      
      // Draw glowing chrono bubble background
      this.ctx.beginPath();
      this.ctx.arc(this.mouse.x, this.mouse.y, bubbleRadius, 0, Math.PI * 2);
      const radGrad = this.ctx.createRadialGradient(this.mouse.x, this.mouse.y, 10, this.mouse.x, this.mouse.y, bubbleRadius);
      radGrad.addColorStop(0, 'rgba(0, 240, 255, 0.04)');
      radGrad.addColorStop(0.8, 'rgba(0, 240, 255, 0.10)');
      radGrad.addColorStop(1.0, 'rgba(0, 240, 255, 0.24)');
      this.ctx.fillStyle = radGrad;
      this.ctx.fill();
      
      // Draw outer rotating dashed clock ring
      this.ctx.beginPath();
      this.ctx.arc(this.mouse.x, this.mouse.y, bubbleRadius, Date.now() / 1200, Date.now() / 1200 + Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([8, 12]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      
      // Draw inner sweeping radar time-line
      const sweepAngle = (Date.now() / 1500) % (Math.PI * 2);
      this.ctx.beginPath();
      this.ctx.moveTo(this.mouse.x, this.mouse.y);
      this.ctx.lineTo(this.mouse.x + Math.cos(sweepAngle) * bubbleRadius, this.mouse.y + Math.sin(sweepAngle) * bubbleRadius);
      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
      this.ctx.lineWidth = 2.0;
      this.ctx.stroke();
      
      this.ctx.restore();
    }

    // 5. Nebular Wind Visual (while gravity paused + mouse held)
    if (this.activePower === 'NEBULAR_WIND' && this.isSandboxPowerChannelActive() && this.mouse.active && this.mouse.x !== -1000 && this.isMouseDown) {
      const windSpeedSq = this.mouseVelocity.x * this.mouseVelocity.x + this.mouseVelocity.y * this.mouseVelocity.y;
      if (windSpeedSq > 0.5) {
        this.ctx.save();
        const count = 5;
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
        this.ctx.lineWidth = 1.0;
        
        const speed = Math.sqrt(windSpeedSq);
        const vxNorm = this.mouseVelocity.x / speed;
        const vyNorm = this.mouseVelocity.y / speed;
        
        for (let j = 0; j < count; j++) {
          const r = Math.random() * 80;
          const theta = Math.random() * Math.PI * 2;
          const ox = Math.cos(theta) * r;
          const oy = Math.sin(theta) * r;
          
          const startX = this.mouse.x + ox - vxNorm * 100;
          const startY = this.mouse.y + oy - vyNorm * 100;
          const endX = this.mouse.x + ox + vxNorm * 120;
          const endY = this.mouse.y + oy + vyNorm * 120;
          
          this.ctx.beginPath();
          this.ctx.moveTo(startX, startY);
          this.ctx.bezierCurveTo(
            startX + vxNorm * 50 + (Math.random() - 0.5) * 30,
            startY + vyNorm * 50 + (Math.random() - 0.5) * 30,
            startX + vxNorm * 100 + (Math.random() - 0.5) * 30,
            startY + vyNorm * 100 + (Math.random() - 0.5) * 30,
            endX,
            endY
          );
          this.ctx.stroke();
        }
        this.ctx.restore();
      }
    }
  }
}
