import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';

type GameState = 'DRIFT' | 'SWARM' | 'CHARGING' | 'SINGULARITY' | 'EXPLODING' | 'MOON_DANCE';

type MousePower = 'DEFAULT' | 'BLACK_HOLE' | 'PAINT_BRUSH' | 'REPELLER' | 'TESLA_DISCHARGE' | 'WORMHOLE';

interface SandboxBlackhole {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  timer: number;
  maxTimer: number;
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
      <!-- Trigger Button -->
      <button class="sandbox-trigger" (click)="toggleSandboxBar()" aria-label="Toggle Sandbox Mode">
        <div class="pulsar-icon">
          <span class="pulsar-icon__core"></span>
          <span class="pulsar-icon__ring"></span>
        </div>
        <span>COSMIC CONTROL PANEL</span>
      </button>

      <!-- Sandbox Control Panel -->
      <div class="sandbox-panel" [class.sandbox-panel--open]="isSandboxOpen">
        <div class="sandbox-panel__header">
          <span class="sandbox-panel__title">SANDBOX UNIVERSE CREATOR</span>
          <span class="sandbox-panel__subtitle">CHOOSE A COSMIC MOUSE POWER TO BEND GRAVITY AND PHYSICS</span>
        </div>
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
          <button class="sandbox-action-btn" (click)="clearSandboxElements()">CLEAR SIMULATION</button>
          <button class="sandbox-action-btn sandbox-action-btn--close" (click)="toggleSandboxBar()">CLOSE</button>
        </div>
      </div>
      
      <canvas #canvasRef id="bg-canvas"></canvas>
    </div>
  `,
  styles: [`
    .sandbox-container {
      position: relative;
      width: 100%;
      height: 100%;
    }
    #bg-canvas {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 2;
      display: block;
      pointer-events: none;
    }
    ::ng-deep .logo-vortex-spin {
      animation: blackhole-spin 2.6s cubic-bezier(0.5, 0, 0.5, 1) forwards !important;
    }
    @keyframes blackhole-spin {
      0% { transform: rotate(0deg) scale(1); filter: hue-rotate(0deg) brightness(1); }
      40% { transform: rotate(720deg) scale(1.35); filter: hue-rotate(180deg) brightness(1.5); }
      100% { transform: rotate(1440deg) scale(0); filter: hue-rotate(360deg) brightness(0); }
    }
    ::ng-deep .logo, ::ng-deep .logoImg {
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
      -webkit-user-drag: none !important;
      user-drag: none !important;
    }
    ::ng-deep .logo-moon-transform {
      animation: none !important;
      box-shadow: 0 0 60px 25px rgba(255, 255, 255, 1), inset 0 0 35px 15px rgba(255, 255, 255, 1) !important;
      border-color: rgba(255, 255, 255, 1) !important;
      background: rgba(255, 255, 255, 1) !important;
      transform: scale(1.35) translate3d(0, 0, 0) !important;
      transition: all 3.0s cubic-bezier(0.25, 1, 0.5, 1) !important;
    }
    ::ng-deep .logo-moon-transform-img {
      filter: brightness(0) invert(1) !important;
      opacity: 1 !important;
      transform: scale(1.0) rotate(0deg) !important;
      transition: all 3.0s ease-in-out !important;
    }
    ::ng-deep .logo-moon-explode {
      transform: scale(0) !important;
      opacity: 0 !important;
      filter: brightness(0) invert(1) drop-shadow(0 0 100px rgba(255, 255, 255, 1)) !important;
      transition: transform 0.6s cubic-bezier(0.6, -0.28, 0.735, 0.045), opacity 0.5s ease, filter 0.5s ease !important;
    }
    
    /* Control Panel styles */
    .sandbox-trigger {
      position: fixed;
      top: 25px;
      right: 25px;
      z-index: 11000;
      background: rgba(10, 15, 30, 0.65);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(0, 240, 255, 0.35);
      border-radius: 20px;
      color: #00f0ff;
      padding: 10px 18px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.12rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 10px rgba(0, 240, 255, 0.15);
      transition: all 0.35s ease;
    }
    .sandbox-trigger:hover {
      background: rgba(0, 240, 255, 0.12);
      border-color: #00f0ff;
      box-shadow: 0 6px 24px rgba(0, 240, 255, 0.3), 0 0 15px rgba(0, 240, 255, 0.4);
      transform: translateY(-1px);
    }
    .pulsar-icon {
      position: relative;
      width: 12px;
      height: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pulsar-icon__core {
      width: 4px;
      height: 4px;
      background: #00f0ff;
      border-radius: 50%;
      box-shadow: 0 0 8px #00f0ff;
    }
    .pulsar-icon__ring {
      position: absolute;
      width: 100%;
      height: 100%;
      border: 1px solid rgba(0, 240, 255, 0.6);
      border-radius: 50%;
      animation: pulsarPulse 1.8s infinite linear;
    }
    @keyframes pulsarPulse {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    .sandbox-panel {
      position: fixed;
      top: -360px;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 820px;
      background: rgba(5, 10, 24, 0.78);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border: 1px solid rgba(0, 240, 255, 0.25);
      border-radius: 16px;
      box-shadow: 0 30px 70px rgba(0, 0, 0, 0.8), 0 0 35px rgba(0, 240, 255, 0.1);
      z-index: 12000;
      transition: all 0.65s cubic-bezier(0.19, 1, 0.22, 1);
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 20px 24px;
    }
    .sandbox-panel--open {
      top: 25px;
    }
    .sandbox-panel__header {
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 12px;
    }
    .sandbox-panel__title {
      font-size: 0.88rem;
      font-weight: 800;
      letter-spacing: 0.15rem;
      color: #ffffff;
      text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
    }
    .sandbox-panel__subtitle {
      font-size: 0.65rem;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.5);
      letter-spacing: 0.05rem;
    }
    .sandbox-panel__tools {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    @media (max-width: 600px) {
      .sandbox-panel__tools {
        grid-template-columns: 1fr;
      }
    }
    .sandbox-tool {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 10px 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 14px;
      transition: all 0.3s ease;
      text-align: left;
      color: inherit;
    }
    .sandbox-tool:hover {
      background: rgba(0, 240, 255, 0.05);
      border-color: rgba(0, 240, 255, 0.35);
      transform: translateY(-1px);
    }
    .sandbox-tool--active {
      background: rgba(0, 240, 255, 0.12) !important;
      border-color: #00f0ff !important;
      box-shadow: 0 0 12px rgba(0, 240, 255, 0.25);
    }
    .sandbox-tool__icon {
      font-size: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
    }
    .sandbox-tool--active .sandbox-tool__icon {
      background: rgba(0, 240, 255, 0.2);
    }
    .sandbox-tool__info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .sandbox-tool__name {
      font-size: 0.72rem;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.05rem;
    }
    .sandbox-tool__desc {
      font-size: 0.58rem;
      color: rgba(255, 255, 255, 0.45);
      line-height: 1.25;
    }
    .sandbox-panel__actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 14px;
    }
    .sandbox-action-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      color: #ffffff;
      padding: 8px 16px;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.05rem;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    .sandbox-action-btn:hover {
      background: rgba(255, 80, 50, 0.15);
      border-color: rgba(255, 80, 50, 0.45);
      color: #ff5032;
    }
    .sandbox-action-btn--close {
      background: #00f0ff;
      border-color: #00f0ff;
      color: #040814;
    }
    .sandbox-action-btn--close:hover {
      background: #ffffff;
      border-color: #ffffff;
      color: #040814;
      box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
    }
  `]
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
  public activePower: MousePower = 'DEFAULT';
  private sandboxBlackholes: SandboxBlackhole[] = [];
  private wormholes: Wormhole[] = [];

  public toolsList = [
    { id: 'DEFAULT', name: 'Nova Strike', desc: 'Shockwave clicks & press Super Move', icon: '⚡' },
    { id: 'BLACK_HOLE', name: 'Event Horizon', desc: 'Spawn persistent black holes that eat stars', icon: '🕳️' },
    { id: 'PAINT_BRUSH', name: 'Stellar Nursery', desc: 'Drag to paint new stars in space', icon: '🎨' },
    { id: 'REPELLER', name: 'Anti-Gravity', desc: 'Project a forcefield that repels stars', icon: '🧲' },
    { id: 'TESLA_DISCHARGE', name: 'Tesla Discharge', desc: 'Shock nearby stars with electric lightning', icon: '⚡' },
    { id: 'WORMHOLE', name: 'Wormhole Gate', desc: 'Spawn Entry/Exit portals to teleport stars', icon: '🌀' }
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

  // Singularity (Implosion/Black-Hole) state
  private singularity = { x: 0, y: 0, active: false, timer: 0 };
  private backgroundBlackholes: BackgroundBlackhole[] = [];
  private flockEasingFactor = 0.0;

  // Meteor shower queue state
  private meteorShowerCount = 0;
  private meteorShowerDelay = 0;

  private animationFrameId: number | null = null;

  // Custom configuration constants (Clean, performant constellations)
  private readonly maxParticles = 145; 
  private readonly particleDensity = 8000;
  private readonly connectionDistance = 145; // cleaner web connections
  private readonly mouseAttractDistance = 370;
  private readonly explosionRadius = 330;

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

    this.resizeCanvas();
    this.initNebulas();
    this.initStars();
    this.initGalaxies();
    this.initParticles();

    // Run animation loop outside Angular Zone to prevent triggering change detection 60 times/sec
    this.ngZone.runOutsideAngular(() => {
      this.animate();
    });
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.resizeCanvas();
    this.initNebulas();
    this.initStars();
    this.initGalaxies();
    this.initParticles();
  }

  private updateMouseCoords(event: MouseEvent): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = event.clientX - rect.left;
    this.mouse.y = event.clientY - rect.top;
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    this.updateMouseCoords(event);
    this.mouse.active = true;
    this.lastMoveTime = Date.now();

    // Move to swarm when mouse is active and moving (unless charging/singularity)
    if (this.state === 'DRIFT' || (this.state === 'EXPLODING' && this.stateTimer < 15)) {
      this.transitionTo('SWARM');
    }
    this.mouseMoving = true;
  }

  @HostListener('window:mouseleave')
  onMouseLeave(): void {
    if (this.state === 'SWARM' || this.state === 'CHARGING') {
      this.triggerRandomStopAction();
    }
    this.mouse.active = false;
    this.mouse.x = -1000;
    this.mouse.y = -1000;
    this.mouseMoving = false;
    this.isMouseDown = false;
  }

  @HostListener('window:mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    if (this.state === 'SINGULARITY' || this.state === 'MOON_DANCE') {
      return;
    }

    // Ignore clicks on sandbox mode UI controls
    if (typeof document !== 'undefined') {
      const panel = document.querySelector('.sandbox-panel');
      const trigger = document.querySelector('.sandbox-trigger');
      if (panel?.contains(event.target as Node) || trigger?.contains(event.target as Node)) {
        return;
      }
    }

    this.updateMouseCoords(event);
    this.mouse.active = true;
    this.isMouseDown = true;
    this.chargeTime = 0;

    // Process sandbox mouse down click powers
    if (this.activePower === 'BLACK_HOLE') {
      this.sandboxBlackholes.push({
        x: this.mouse.x,
        y: this.mouse.y,
        radius: 0,
        maxRadius: Math.random() * 8 + 18,
        timer: 600,
        maxTimer: 600
      });
      return;
    }
    
    if (this.activePower === 'TESLA_DISCHARGE') {
      this.triggerTeslaDischargePower();
      return;
    }
    
    if (this.activePower === 'WORMHOLE') {
      if (this.wormholes.length < 2) {
        const type = this.wormholes.length === 0 ? 'ENTRY' : 'EXIT';
        this.wormholes.push({
          x: this.mouse.x,
          y: this.mouse.y,
          radius: 30,
          type,
          pulsePhase: Math.random() * Math.PI
        });
      } else {
        const first = this.wormholes[0];
        const second = this.wormholes[1];
        if (Math.random() > 0.5) {
          first.x = this.mouse.x;
          first.y = this.mouse.y;
        } else {
          second.x = this.mouse.x;
          second.y = this.mouse.y;
        }
      }
      return;
    }

    if (this.activePower === 'PAINT_BRUSH') {
      this.spawnStellarBirth(this.mouse.x, this.mouse.y);
      return;
    }

    this.transitionTo('CHARGING');
  }

  @HostListener('window:mouseup', ['$event'])
  onMouseUp(event: MouseEvent): void {
    if (!this.isMouseDown) {
      return;
    }
    this.isMouseDown = false;

    if (this.state === 'SINGULARITY' || this.state === 'MOON_DANCE') {
      return;
    }

    // Ignore releases on sandbox mode UI controls
    if (typeof document !== 'undefined') {
      const panel = document.querySelector('.sandbox-panel');
      const trigger = document.querySelector('.sandbox-trigger');
      if (panel?.contains(event.target as Node) || trigger?.contains(event.target as Node)) {
        return;
      }
    }

    this.updateMouseCoords(event);

    if (this.activePower !== 'DEFAULT') {
      return;
    }

    if (this.chargeTime >= 20) {
      this.triggerSuperMoveExplosion();
    } else {
      this.transitionTo('EXPLODING');
      this.triggerNormalClickShockwave();
    }
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
        
        // High turbulence: deflection range of +/- 1.8 radians (about 200 degrees spread)
        // plus speed dispersion from 0.3x to 1.8x
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 3.6; 
        const speed = force * multiplier * (Math.random() * 1.5 + 0.3);
        
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.colorBlend = 1.0;

        // 50% chance of initiating dynamic post-blast wobble (spiraling or curved trajectory)
        if (Math.random() < 0.50) {
          p.wobbleTimer = Math.floor(Math.random() * 45) + 20;
        }
      }
    }
  }

  // --- STELLAR NURSERY & LIFE CYCLE SYSTEM ---
  private spawnStellarBirth(x: number, y: number): void {
    if (this.particles.length >= this.maxParticles + 15) return;

    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2.5 + 1.0;
    const baseRadius = Math.random() * 2.0 + 1.6;

    const colors = [
      'rgba(0, 240, 255,',   // Neon Cyan
      'rgba(0, 240, 255,',   // Neon Cyan (duplicate to prioritize cyan)
      'rgba(0, 240, 255,',   // Neon Cyan
      'rgba(230, 100, 255,', // Nebula Magenta
      'rgba(100, 180, 255,'  // Space Blue
    ];
    const colorPrefix = Math.random() < 0.12
      ? colors[Math.floor(Math.random() * colors.length)]
      : 'rgba(255, 255, 255,';
    const flockable = Math.random() < 0.22; // Only 22% group up

    this.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      baseVx: Math.cos(angle) * 0.4,
      baseVy: Math.sin(angle) * 0.4,
      radius: baseRadius,
      baseRadius,
      colorBlend: 0.0,
      wobbleTimer: 0,
      colorPrefix,
      flockable,
      life: 1.0,
      birthProgress: 0.0,
      deathProgress: 0.0,
      isDying: false,
      behaviorState: 'CRUISE',
      behaviorTimer: Math.floor(Math.random() * 120) + 120,
      speedFactor: 1.0
    });
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
    const dpr = window.devicePixelRatio || 1;
    
    // Size physical resolution to match canvas layout bounds precisely
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);
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
    const starCount = Math.floor(area / 6000); 

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
    const dustCount = Math.floor(area / 10000);
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
    
    this.backgroundGalaxies = [
      {
        x: width * 0.20,
        y: height * 0.28,
        size: Math.min(width, height) * 0.38,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: 0.00025,
        color: '140, 90, 255', // violet galaxy
        arms: 2,
        starCount: 180,
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
        starCount: 240,
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
        starCount: 120,
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

    // Spiral arms of tiny stars
    this.ctx.fillStyle = `rgba(${g.color}, 0.28)`;
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
      
      this.ctx.beginPath();
      this.ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
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
    this.draw();
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  private draw(): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;

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
    if (this.state === 'SWARM') {
      if (this.mouse.active && this.mouseMoving) {
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
        const logoEl = document.querySelector('.logo') as HTMLElement;
        if (logoEl) {
          const pulseFactor = 1.35 + Math.sin(this.stateTimer * 0.45) * 0.15;
          const trembleX = (Math.random() - 0.5) * 4;
          const trembleY = (Math.random() - 0.5) * 4;
          logoEl.style.transform = `scale(${pulseFactor}) translate3d(${trembleX}px, ${trembleY}px, 0)`;
        }
        
        // Tremble screen
        this.shakeTimer = Math.max(this.shakeTimer, 3);

        // Convergence cosmic lightning discharges
        if (Math.random() < 0.35) {
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
        this.spawnEasterEggConstellation(this.singularity.x, this.singularity.y);
        this.spawnEasterEggConstellation(this.singularity.x - 100, this.singularity.y + 100);
        this.spawnEasterEggConstellation(this.singularity.x + 100, this.singularity.y - 100);
        
        // Push massive multi-colored shockwave rings
        this.shockwaves.push({
          x: this.singularity.x,
          y: this.singularity.y,
          radius: 0,
          maxRadius: this.explosionRadius * 3.5,
          speed: 22.0,
          alpha: 1.0,
          color: '255, 255, 255' // Supernova white flash ring
        });
        this.shockwaves.push({
          x: this.singularity.x,
          y: this.singularity.y,
          radius: 0,
          maxRadius: this.explosionRadius * 3.0,
          speed: 16.0,
          alpha: 0.95,
          color: '0, 240, 255' // Neon Cyan
        });
        this.shockwaves.push({
          x: this.singularity.x,
          y: this.singularity.y,
          radius: 0,
          maxRadius: this.explosionRadius * 2.5,
          speed: 12.0,
          alpha: 0.85,
          color: '255, 100, 230' // Nebula Magenta
        });
        this.shockwaves.push({
          x: this.singularity.x,
          y: this.singularity.y,
          radius: 0,
          maxRadius: this.explosionRadius * 2.0,
          speed: 9.0,
          alpha: 0.75,
          color: '100, 180, 255' // Space Blue
        });
        
        // Big Bang explosion sparks (240 high-speed debris)
        for (let k = 0; k < 240; k++) {
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
        this.transitionTo(this.mouseMoving ? 'SWARM' : 'DRIFT');
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
    const gLength = this.backgroundGalaxies.length;
    for (let i = 0; i < gLength; i++) {
      const g = this.backgroundGalaxies[i];
      g.rotation += g.rotationSpeed;
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
      if (star.isPulsar) {
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
    this.updateAndDrawSandboxElements(width, height);

    // 5. Draw Charge Aurora ring & charge energy arcs (Only in CHARGING state)
    let chargeProgress = 0;
    if (this.state === 'CHARGING') {
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
        const closeNodes = this.particles.filter(p => {
          const dx = p.x - this.mouse.x;
          const dy = p.y - this.mouse.y;
          return Math.sqrt(dx*dx + dy*dy) < attractionDist;
        });
        if (closeNodes.length > 0) {
          const p = closeNodes[Math.floor(Math.random() * closeNodes.length)];
          this.drawMiniChargeArc(this.mouse.x, this.mouse.y, p.x, p.y);
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
      if (Math.random() < 0.35) {
        this.spawnStellarBirth(this.mouse.x, this.mouse.y);
      }
    }

    // 11. Update & Render main interactive constellation particles
    const pLength = this.particles.length;
    const glowAmplitude = 0.15 + (Math.sin(Date.now() / 400) + 1.0) * 0.5 * 0.25;

    for (let i = pLength - 1; i >= 0; i--) {
      const p = this.particles[i];

      // A. Star Life Cycle Logic
      if (p.birthProgress < 1.0 && this.state !== 'MOON_DANCE') {
        p.birthProgress += 0.025;
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

      // C. Evaluate Charging Pull Physics
      if (this.state === 'CHARGING') {
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
        }
      }

      // E. Evaluate Swarm Gravity Physics (only active in SWARM state)
      if (this.state === 'SWARM') {
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

      // Sandbox Repeller Force
      if (this.activePower === 'REPELLER' && this.mouse.active && this.mouse.x !== -1000) {
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 320) {
          const force = (320 - dist) / 320;
          p.vx += (dx / dist) * force * 1.5;
          p.vy += (dy / dist) * force * 1.5;
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

        const flockRangeSq = 180 * 180;
        const separationRange = 65; // subtle spacing
        const separationRangeSq = separationRange * separationRange;

        for (let j = 0; j < this.particles.length; j++) {
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
      if (!p.isDying && p.birthProgress >= 1.0) {
        for (let j = i - 1; j >= 0; j--) {
          const p2 = this.particles[j];
          if (p2.isDying || p2.birthProgress < 1.0) continue;

          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < 18 * 18) {
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
      for (let j = i - 1; j >= 0; j--) {
        const p2 = this.particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const distSq = dx * dx + dy * dy;
        const currentConnectionDist = this.state === 'DRIFT'
          ? this.connectionDistance * 0.78
          : (this.state === 'MOON_DANCE' ? this.connectionDistance * 1.35 : this.connectionDistance);
        const limitSq = currentConnectionDist * currentConnectionDist;

        if (distSq < limitSq) {
          const dist = Math.sqrt(distSq);
          
          let baseAlphaCoeff = this.state === 'DRIFT' ? 0.16 : 0.35;
          if (this.state === 'MOON_DANCE') {
            baseAlphaCoeff = 0.50; // extra glow for the cosmic whirlpool mesh
          }
          let alpha = (1 - dist / currentConnectionDist) * baseAlphaCoeff;
          if (this.state === 'SWARM' || this.state === 'CHARGING') {
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
          }
        }
      }

      // Draw gravity attraction beams (active in SWARM or CHARGING state)
      if (this.state === 'SWARM' || this.state === 'CHARGING') {
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
  
  public selectPower(power: MousePower): void {
    this.activePower = power;
    this.wormholes = []; // Reset portals
  }
  
  public clearSandboxElements(): void {
    this.sandboxBlackholes = [];
    this.wormholes = [];
  }

  private triggerTeslaDischargePower(): void {
    const sorted = [...this.particles]
      .map(p => {
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        return { particle: p, dist: Math.sqrt(dx*dx + dy*dy) };
      })
      .sort((a, b) => a.dist - b.dist);
    
    const targetCount = Math.min(12, sorted.length);
    for (let i = 0; i < targetCount; i++) {
      const p = sorted[i].particle;
      const dx = p.x - this.mouse.x;
      const dy = p.y - this.mouse.y;
      const dist = sorted[i].dist || 1;
      
      if (dist < 500) {
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.4;
        p.vx = Math.cos(angle) * 14.0;
        p.vy = Math.sin(angle) * 14.0;
        p.colorBlend = 1.0;
        
        // Spawn lightning segment
        const segments = [];
        const steps = 4;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const baseOffset = 15 * (1 - t);
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
  }

  private updateAndDrawSandboxElements(width: number, height: number): void {
    // 1. Sandbox Black holes
    for (let i = this.sandboxBlackholes.length - 1; i >= 0; i--) {
      const sbh = this.sandboxBlackholes[i];
      sbh.timer--;
      
      if (sbh.timer <= 0) {
        this.sandboxBlackholes.splice(i, 1);
        continue;
      }
      
      const elapsed = sbh.maxTimer - sbh.timer;
      if (elapsed < 60) {
        sbh.radius = sbh.maxRadius * (elapsed / 60);
      } else if (sbh.timer < 60) {
        sbh.radius = sbh.maxRadius * (sbh.timer / 60);
      } else {
        sbh.radius = sbh.maxRadius;
      }
      
      const sbhRadius = sbh.radius;
      for (const p of this.particles) {
        if (p.isDying || p.birthProgress < 1.0) continue;
        
        const dx = sbh.x - p.x;
        const dy = sbh.y - p.y;
        const distSq = dx * dx + dy * dy;
        const pullDist = 320;
        
        if (distSq < pullDist * pullDist) {
          const dist = Math.sqrt(distSq) || 1;
          const force = (pullDist - dist) / pullDist;
          p.vx += (dx / dist) * force * 0.72;
          p.vy += (dy / dist) * force * 0.72;
          
          p.vx += (-dy / dist) * force * 0.42;
          p.vy += (dx / dist) * force * 0.42;
          
          if (dist < sbhRadius + 6) {
            p.isDying = true;
            p.deathProgress = 1.0;
            this.spawnMiniSupernova(sbh.x, sbh.y, p.colorPrefix);
          }
        }
      }
      
      this.ctx.beginPath();
      this.ctx.arc(sbh.x, sbh.y, sbhRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(2, 4, 10, 0.98)';
      this.ctx.fill();
      
      const pulse = Math.sin(Date.now() / 80 + sbh.x) * sbhRadius * 0.2;
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
    
    // Wormhole warp physics
    if (this.wormholes.length === 2) {
      const entry = this.wormholes[0];
      const exit = this.wormholes[1];
      
      for (const p of this.particles) {
        if (p.isDying || p.birthProgress < 1.0) continue;
        
        const dx = entry.x - p.x;
        const dy = entry.y - p.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        
        if (dist < entry.radius + 10) {
          p.vx += (dx / dist) * 0.65;
          p.vy += (dy / dist) * 0.65;
          
          if (dist < entry.radius) {
            p.x = exit.x + (Math.random() - 0.5) * 8;
            p.y = exit.y + (Math.random() - 0.5) * 8;
            
            const launchAngle = Math.random() * Math.PI * 2;
            const launchSpeed = Math.random() * 8.0 + 5.5;
            p.vx = Math.cos(launchAngle) * launchSpeed;
            p.vy = Math.sin(launchAngle) * launchSpeed;
            p.colorBlend = 1.0;
            
            this.spawnStardustPuff(entry.x, entry.y, 'rgba(0, 240, 255,');
            this.spawnStardustPuff(exit.x, exit.y, 'rgba(255, 100, 230,');
          }
        }
      }
    }
  }
}
