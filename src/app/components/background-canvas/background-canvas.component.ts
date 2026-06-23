import { Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';

type GameState = 'DRIFT' | 'SWARM' | 'SINGULARITY' | 'EXPLODING';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVx: number;
  baseVy: number;
  radius: number;
  baseRadius: number;
  colorBlend: number;   // 1.0 = neon cyan flash, decays to 0.0
  wobbleTimer: number;  // countdown for wave ripple oscillation wobble
}

interface TwinkleStar {
  x: number;
  y: number;
  radius: number;
  phase: number;
  twinkleSpeed: number;
  color: string; // soft color tint (white, yellow, cyan, purple)
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
  color: string;
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
  radius: number;
  color: string;
}

@Component({
  selector: 'app-background-canvas',
  standalone: true,
  template: `<canvas #canvasRef id="bg-canvas"></canvas>`,
  styles: [`
    #bg-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2;
      display: block;
      pointer-events: none;
    }
  `]
})
export class BackgroundCanvasComponent implements OnInit, OnDestroy {
  @ViewChild('canvasRef', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  
  // Game state engine
  private state: GameState = 'DRIFT';
  private stateTimer = 0; // multi-purpose timer for state transitions
  private singularity = { x: 0, y: 0, active: false, timer: 0 };

  // Cosmic Arrays
  private particles: Particle[] = [];
  private backgroundStars: TwinkleStar[] = [];
  private nebulas: NebulaCloud[] = [];
  private sparks: Spark[] = [];
  private shockwaves: Shockwave[] = [];
  private lightnings: Lightning[] = [];
  private shootingStars: ShootingStar[] = [];

  // Mouse dynamics
  private mouse = { x: -1000, y: -1000, active: false };
  private mouseMoving = false;
  private lastMoveTime = 0;

  // Meteor shower queue state
  private meteorShowerCount = 0;
  private meteorShowerDelay = 0;

  private animationFrameId: number | null = null;

  // Custom configuration constants
  private readonly maxParticles = 90;
  private readonly particleDensity = 14000;
  private readonly connectionDistance = 145;
  private readonly mouseAttractDistance = 360;
  private readonly explosionRadius = 320;

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
    this.initParticles();
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    this.mouse.x = event.clientX;
    this.mouse.y = event.clientY;
    this.mouse.active = true;
    this.lastMoveTime = Date.now();

    // State machine logic: move to swarm when mouse is active and moving
    if (this.state === 'DRIFT' || (this.state === 'EXPLODING' && this.stateTimer < 15)) {
      this.transitionTo('SWARM');
    }
    this.mouseMoving = true;
  }

  @HostListener('window:mouseleave')
  onMouseLeave(): void {
    if (this.state === 'SWARM') {
      this.triggerRandomStopAction();
    }
    this.mouse.active = false;
    this.mouse.x = -1000;
    this.mouse.y = -1000;
    this.mouseMoving = false;
  }

  @HostListener('window:click', ['$event'])
  onClick(event: MouseEvent): void {
    // Ignore clicks if singularity black hole is actively gathering energy (Vortex Implosion)
    if (this.state === 'SINGULARITY') {
      return;
    }

    // Force transition to exploding state on click
    this.transitionTo('EXPLODING');

    if (this.shockwaves.length > 2) {
      this.shockwaves.shift();
    }
    this.shockwaves.push({
      x: event.clientX,
      y: event.clientY,
      radius: 0,
      maxRadius: 280,
      speed: 7.5,
      alpha: 1.0,
      color: '0, 240, 255'
    });
  }

  // --- STATE MACHINE ROUTING ---
  private transitionTo(newState: GameState): void {
    // Console log state transitions under development if needed, keeping it silent for now
    this.state = newState;
    
    if (newState === 'EXPLODING') {
      this.stateTimer = 40; // Cooldown timer (40 frames, ~650ms) before user can swarm again
    } else if (newState === 'SINGULARITY') {
      this.stateTimer = 25; // Implosion charge timer
    }
  }

  private triggerRandomStopAction(): void {
    if (this.mouse.x === -1000) {
      this.transitionTo('DRIFT');
      return;
    }

    // Select random stop action event
    const eventTypes: ('supernova' | 'blackhole' | 'lightning' | 'nebula')[] = [
      'supernova',
      'blackhole',
      'lightning',
      'nebula'
    ];
    const chosen = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    if (chosen === 'blackhole') {
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

  // --- STOP EVENTS ---
  private triggerSupernovaBurst(): void {
    this.blastParticlesAway(this.mouse.x, this.mouse.y, 14.0);

    this.shockwaves.push({
      x: this.mouse.x,
      y: this.mouse.y,
      radius: 0,
      maxRadius: 280,
      speed: 8.0,
      alpha: 1.0,
      color: '0, 230, 255'
    });

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
      p.vx = (dx / dist) * 12.0;
      p.vy = (dy / dist) * 12.0;
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
        segments.push({
          x: cx + (p.x - cx) * t + ox,
          y: cy + (p.y - cy) * t + oy
        });
      }
      this.lightnings.push({ segments, alpha: 1.0 });
    }
  }

  private triggerNebulaWave(): void {
    this.shockwaves.push({
      x: this.mouse.x,
      y: this.mouse.y,
      radius: 0,
      maxRadius: 300,
      speed: 7.0,
      alpha: 1.0,
      color: '0, 240, 255'
    });

    this.shockwaves.push({
      x: this.mouse.x,
      y: this.mouse.y,
      radius: 0,
      maxRadius: 280,
      speed: 6.0,
      alpha: 0.9,
      color: '255, 100, 230'
    });

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
        p.vx = (dx / dist) * force * multiplier;
        p.vy = (dy / dist) * force * multiplier;
        p.colorBlend = 1.0;
      }
    }
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
  }

  // --- INITIALIZATION ---
  private initNebulas(): void {
    // Generate 3 glowing cosmic gas nebulas in the background
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.nebulas = [
      { x: width * 0.25, y: height * 0.35, radius: Math.min(width, height) * 0.45, color: 'rgba(0, 100, 255, 0.05)' },
      { x: width * 0.75, y: height * 0.65, radius: Math.min(width, height) * 0.50, color: 'rgba(180, 50, 255, 0.035)' },
      { x: width * 0.50, y: height * 0.15, radius: Math.min(width, height) * 0.35, color: 'rgba(0, 180, 220, 0.025)' }
    ];
  }

  private initStars(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const area = width * height;
    // High star count for real galaxy backdrop
    const starCount = Math.floor(area / 6500); 

    const colorTints = [
      'rgba(255, 255, 255,',   // Pure White
      'rgba(220, 240, 255,',   // Soft Blue
      'rgba(255, 250, 210,',   // Warm Yellow
      'rgba(240, 210, 255,'    // Soft Purple
    ];

    this.backgroundStars = [];
    for (let i = 0; i < starCount; i++) {
      this.backgroundStars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.1 + 0.3,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.018 + 0.004,
        color: colorTints[Math.floor(Math.random() * colorTints.length)]
      });
    }
  }

  private initParticles(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const area = width * height;
    
    const targetCount = Math.min(this.maxParticles, Math.floor(area / this.particleDensity));
    const count = Math.max(35, targetCount);

    this.particles = [];
    for (let i = 0; i < count; i++) {
      const baseRadius = Math.random() * 2.0 + 1.6;
      const baseVx = (Math.random() - 0.5) * 0.45;
      const baseVy = (Math.random() - 0.5) * 0.45;

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
        wobbleTimer: 0
      });
    }
  }

  private animate(): void {
    this.draw();
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  private draw(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // --- STATE MACHINE ENGINE TICK ---
    if (this.state === 'SWARM') {
      // Check if mouse has stopped moving to trigger stop actions
      if (this.mouse.active && this.mouseMoving) {
        if (Date.now() - this.lastMoveTime > 220) {
          this.triggerRandomStopAction();
        }
      }
    } else if (this.state === 'SINGULARITY') {
      this.stateTimer--;
      if (this.stateTimer <= 0) {
        // Explode black hole singularity outward and transition to exploding state
        this.transitionTo('EXPLODING');
        this.blastParticlesAway(this.singularity.x, this.singularity.y, 18.0);
        this.shockwaves.push({
          x: this.singularity.x,
          y: this.singularity.y,
          radius: 0,
          maxRadius: this.explosionRadius * 0.95,
          speed: 8.5,
          alpha: 1.0,
          color: '0, 240, 255'
        });
      }
    } else if (this.state === 'EXPLODING') {
      this.stateTimer--;
      if (this.stateTimer <= 0 && this.shockwaves.length === 0) {
        // Return back to DRIFT once explosion clears and stabilizers snap particles
        this.transitionTo(this.mouse.active ? 'SWARM' : 'DRIFT');
      }
    }

    this.ctx.clearRect(0, 0, width, height);

    // 1. Draw Nebula Clouds Backdrop
    const nLength = this.nebulas.length;
    for (let i = 0; i < nLength; i++) {
      const neb = this.nebulas[i];
      const grad = this.ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.radius);
      grad.addColorStop(0, neb.color);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(neb.x, neb.y, neb.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // 2. Draw Twinkling Background Starfield
    const bLength = this.backgroundStars.length;
    for (let i = 0; i < bLength; i++) {
      const star = this.backgroundStars[i];
      star.phase += star.twinkleSpeed;
      const twinkleOpacity = 0.12 + (Math.sin(star.phase) + 1.0) * 0.5 * 0.48;

      this.ctx.beginPath();
      this.ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `${star.color}${twinkleOpacity})`;
      this.ctx.fill();
    }

    // 3. Meteor Shower Queue & Random Shooting Star Spawns
    if (this.shootingStars.length < 6) {
      // Small chance of starting a meteor shower (roughly once every 40-50 seconds)
      if (this.meteorShowerCount === 0 && Math.random() < 0.0006) {
        this.meteorShowerCount = Math.floor(Math.random() * 5) + 4; // 4 to 8 stars in a shower
        this.meteorShowerDelay = 0;
      }

      // Handle Meteor Shower Star Spawns
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
          this.meteorShowerDelay = Math.floor(Math.random() * 20) + 8; // stagger shower next star
        }
      }

      // Standard background shooting star chance (low frequency)
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

    // Update & Draw active shooting stars
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

    // 4. Render Active Singularity Black-Hole Core
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
    }

    // 5. Render active lightning bolt graphics
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

    // 6. Render active expanding shockwaves
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

    // 7. Render cursor sparks (supernova debris particles)
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

    // 8. Render main interactive constellation particles
    const pLength = this.particles.length;
    const glowAmplitude = 0.15 + (Math.sin(Date.now() / 400) + 1.0) * 0.5 * 0.25;

    for (let i = 0; i < pLength; i++) {
      const p = this.particles[i];

      // A. Evaluate Singularity state physics (Black Hole Gravity Vortex)
      if (this.state === 'SINGULARITY') {
        const dx = this.singularity.x - p.x;
        const dy = this.singularity.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < 400) {
          const force = (400 - dist) / 400;
          // Pull vector towards central singularity
          p.vx += (dx / dist) * force * 1.55;
          p.vy += (dy / dist) * force * 1.55;

          // Perpendicular vortex spin vector
          p.vx += (-dy / dist) * force * 0.85;
          p.vy += (dx / dist) * force * 0.85;

          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          const maxSpeed = 10.0;
          if (speed > maxSpeed) {
            p.vx = (p.vx / speed) * maxSpeed;
            p.vy = (p.vy / speed) * maxSpeed;
          }
        }
      }

      // B. Evaluate Expanding Shockwave Physics
      for (const s of this.shockwaves) {
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < s.radius && dist > s.radius - 60) {
          const force = (1 - dist / s.maxRadius) * 9.5;
          p.vx += (dx / dist) * force * 0.35;
          p.vy += (dy / dist) * force * 0.35;
          p.colorBlend = Math.max(p.colorBlend, 0.85);
        }
      }

      // C. Evaluate Swarm Gravity Physics (only active in SWARM state)
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

      // D. Apply Nebula wave wobble
      if (p.wobbleTimer > 0) {
        p.wobbleTimer--;
        p.vx += Math.sin(p.wobbleTimer * 0.45) * 0.95;
        p.vy += Math.cos(p.wobbleTimer * 0.45) * 0.95;
      }

      // E. Decelerate / Spring back to base velocities (spring drag)
      p.vx += (p.baseVx - p.vx) * 0.035;
      p.vy += (p.baseVy - p.vy) * 0.035;

      // Update positions
      p.x += p.vx;
      p.y += p.vy;

      // Wrap boundaries
      const padding = 20;
      if (p.x < -padding) p.x = width + padding;
      else if (p.x > width + padding) p.x = -padding;

      if (p.y < -padding) p.y = height + padding;
      else if (p.y > height + padding) p.y = -padding;

      // Decay color blend
      p.colorBlend *= 0.94;

      // Render base node dot
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.colorBlend > 0.08 
        ? `rgba(0, 240, 255, 0.95)` 
        : 'rgba(255, 255, 255, 0.88)';
      this.ctx.fill();

      // Render outer glow
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius * 2.8, 0, Math.PI * 2);
      this.ctx.fillStyle = p.colorBlend > 0.08
        ? `rgba(0, 240, 255, ${0.25 + p.colorBlend * 0.5})`
        : `rgba(100, 200, 255, ${0.15 + glowAmplitude})`;
      this.ctx.fill();

      // Render constellation links
      for (let j = i + 1; j < pLength; j++) {
        const p2 = this.particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const distSq = dx * dx + dy * dy;
        const limitSq = this.connectionDistance * this.connectionDistance;

        if (distSq < limitSq) {
          const dist = Math.sqrt(distSq);
          
          let alpha = (1 - dist / this.connectionDistance) * 0.35;
          if (this.state === 'SWARM') {
            alpha *= 1.4;
          }

          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p2.x, p2.y);
          
          const maxBlend = Math.max(p.colorBlend, p2.colorBlend);
          this.ctx.strokeStyle = maxBlend > 0.08
            ? `rgba(0, 220, 255, ${alpha * (0.5 + maxBlend * 0.5)})`
            : `rgba(130, 200, 255, ${alpha})`;
            
          this.ctx.lineWidth = maxBlend > 0.08 ? 1.1 : 0.85;
          this.ctx.stroke();
        }
      }

      // Draw gravity attraction beams (only active in SWARM state)
      if (this.state === 'SWARM') {
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        const distSq = dx * dx + dy * dy;
        const mLimitSq = this.mouseAttractDistance * this.mouseAttractDistance;

        if (distSq < mLimitSq) {
          const dist = Math.sqrt(distSq);
          const alpha = (1 - dist / this.mouseAttractDistance) * 0.45;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(this.mouse.x, this.mouse.y);
          this.ctx.strokeStyle = `rgba(0, 230, 255, ${alpha * (0.55 + glowAmplitude * 0.4)})`;
          this.ctx.lineWidth = 1.0;
          this.ctx.stroke();
        }
      }
    }
  }
}
