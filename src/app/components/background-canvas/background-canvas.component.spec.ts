import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackgroundCanvasComponent } from './background-canvas.component';
import { CosmicWorld } from './engine/cosmic-world';
import { CosmicCanvasEngine } from './engine/cosmic-canvas-engine';
import { draw } from './engine/draw-frame';
import { findNearestParticleIndices } from './engine/particle-system';
import { findRandomNearbyParticle } from './engine/particle-system';
import { initParticles } from './engine/particle-system';
import { initStars } from './engine/background-layers';
import { resizeCanvas } from './engine/background-layers';
import { tickFpsGovernor } from './engine/fps-governor';
import { transitionTo } from './engine/state-machine';
import { tryWormholeCapture } from './engine/sandbox-powers';

describe('BackgroundCanvasComponent', () => {
  let component: BackgroundCanvasComponent;
  let fixture: ComponentFixture<BackgroundCanvasComponent>;
  let eng: () => CosmicCanvasEngine;
  let w: () => CosmicWorld;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackgroundCanvasComponent]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BackgroundCanvasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    eng = () => component.getEngineForTests();
    w = () => eng().world;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize particles with expected properties', () => {
    // Manually trigger initialization to ensure population
    initParticles(eng(), );
    expect(w().particles.length).toBeGreaterThan(0);

    const firstParticle = w().particles[0];
    expect(firstParticle.x).toBeDefined();
    expect(firstParticle.y).toBeDefined();
    expect(firstParticle.vx).toBeDefined();
    expect(firstParticle.vy).toBeDefined();
    expect(firstParticle.colorPrefix).toBeDefined();
    expect(firstParticle.flockable).toBeDefined();
    expect(firstParticle.behaviorState).toBeDefined();
    expect(firstParticle.behaviorTimer).toBeGreaterThan(0);
    expect(firstParticle.speedFactor).toEqual(1.0);
  });

  it('should cap particle count according to the active performance tier', () => {
    eng().applyPerformanceTier('low');
    initParticles(eng(), );
    expect(w().particles.length).toBeLessThanOrEqual(70);

    eng().applyPerformanceTier('high');
    initParticles(eng(), );
    expect(w().particles.length).toBeLessThanOrEqual(145);
    expect(w().particles.length).toBeGreaterThan(35);
  });

  it('should scale background star density by performance tier', () => {
    eng().applyPerformanceTier('low');
    initStars(eng(), );
    const lowStars = w().backgroundStars.length;

    eng().applyPerformanceTier('high');
    initStars(eng(), );
    const highStars = w().backgroundStars.length;

    expect(highStars).toBeGreaterThan(lowStars);
  });

  it('should downgrade performance tier when sustained FPS is low', () => {
    if (w().animationFrameId !== null) {
      cancelAnimationFrame(w().animationFrameId!);
      w().animationFrameId = null;
    }
    eng().applyPerformanceTier('high');
    w().fpsGovernorCooldown = 0;
    w().fpsLowStreak = 59;
    w().fpsHighStreak = 0;
    w().fpsFrameDeltas = Array(30).fill(1000 / 30);
    w().lastFrameTime = 0;
    tickFpsGovernor(eng(), 1000);
    expect(w().performanceProfile.tier).toBe('medium');
  });

  it('should pause and resume the animation loop on visibility change', () => {
    if (w().animationFrameId !== null) {
      cancelAnimationFrame(w().animationFrameId!);
      w().animationFrameId = null;
    }

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    component.onVisibilityChange();
    expect(w().animationPaused).toBe(true);
    expect(w().animationFrameId).toBeNull();

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    component.onVisibilityChange();
    expect(w().animationPaused).toBe(false);
    expect(w().animationFrameId).not.toBeNull();

    cancelAnimationFrame(w().animationFrameId!);
    w().animationFrameId = null;
  });

  it('should find the nearest particle within range without scanning the full array', () => {
    w().particles = [
      { x: 200, y: 100 } as never,
      { x: 108, y: 100 } as never,
      { x: 900, y: 900 } as never
    ];
    const nearest = findRandomNearbyParticle(eng(), 100, 100, 20);
    expect(nearest?.x).toBe(108);
  });

  it('should find the closest particle indices for Tesla zaps', () => {
    w().particles = [
      { x: 100, y: 100 } as never,
      { x: 120, y: 100 } as never,
      { x: 400, y: 400 } as never
    ];
    const indices = findNearestParticleIndices(eng(), 100, 100, 2, 200);
    expect(indices.length).toBe(2);
    expect(indices).toContain(0);
    expect(indices).toContain(1);
    expect(indices).not.toContain(2);
  });

  it('should cache canvas dimensions after resize', () => {
    resizeCanvas(eng(), );
    expect(w().canvasWidth).toBeGreaterThan(0);
    expect(w().canvasHeight).toBeGreaterThan(0);
  });

  it('should transition game state correctly', () => {
    transitionTo(eng(), 'SWARM');
    expect(w().state).toBe('SWARM');

    transitionTo(eng(), 'EXPLODING');
    expect(w().state).toBe('EXPLODING');
    expect(w().stateTimer).toBe(40);

    transitionTo(eng(), 'SINGULARITY');
    expect(w().state).toBe('SINGULARITY');
    expect(w().stateTimer).toBe(25);

    transitionTo(eng(), 'MOON_DANCE');
    expect(w().state).toBe('MOON_DANCE');
    expect(w().stateTimer).toBe(390);

    transitionTo(eng(), 'DRIFT');
    expect(w().state).toBe('DRIFT');
    expect(w().flockEasingFactor).toBe(0.0);
  });

  it('should handle background blackhole creation, star attraction and absorption', () => {
    // Manually seed a background blackhole
    w().backgroundBlackholes = [{
      x: 100,
      y: 100,
      radius: 10,
      maxRadius: 10,
      timer: 100,
      maxTimer: 100
    }];

    // Put a particle close but not inside event horizon to test attraction check
    w().particles = [{
      x: 120,
      y: 100,
      vx: 0,
      vy: 0,
      baseVx: 0.1,
      baseVy: 0.1,
      radius: 2,
      baseRadius: 2,
      colorBlend: 0,
      wobbleTimer: 0,
      colorPrefix: 'rgba(255, 255, 255,',
      flockable: true,
      life: 0.8,
      birthProgress: 1.0,
      deathProgress: 0.0,
      isDying: false,
      behaviorState: 'CRUISE',
      behaviorTimer: 100,
      speedFactor: 1.0
    }];

    w().state = 'DRIFT';

    // Invoke draw iteration to run the blackhole physics updates
    draw(eng(), );

    // Verify particle velocity was altered due to gravity pull
    const p = w().particles[0];
    expect(p.vx).not.toBe(0);

    // Place particle inside event horizon to test absorption check
    p.x = 101;
    p.y = 100;
    p.isDying = false;

    // Run draw iteration again
    draw(eng(), );

    // Star should now be set to dying with max death progress
    expect(p.isDying).toBe(true);
    expect(p.deathProgress).toBeGreaterThanOrEqual(1.0);
  });

  it('should spawn mini supernovae upon particle death progress completion', () => {
    const initialShockwavesLength = w().shockwaves.length;

    // Lifecycle (death progress) only advances outside LOADING/MOON_DANCE/AYA_FORMATION.
    // The component briefly sits in LOADING after init, so pin the state for determinism.
    w().state = 'DRIFT';

    // Inject a dying particle with deathProgress almost complete
    w().particles = [{
      x: 150,
      y: 150,
      vx: 0.1,
      vy: 0.1,
      baseVx: 0.1,
      baseVy: 0.1,
      radius: 2,
      baseRadius: 2,
      colorBlend: 0.0,
      wobbleTimer: 0,
      colorPrefix: 'rgba(255, 100, 230,',
      flockable: true,
      life: 0.01,
      birthProgress: 1.0,
      deathProgress: 0.99,
      isDying: true,
      behaviorState: 'CRUISE',
      behaviorTimer: 100,
      speedFactor: 1.0
    }];

    // Run draw iteration to finish lifecycle
    draw(eng(), );

    // Particle should have been cleaned up and spliced out
    expect(w().particles.length).toBe(0);

    // Mini supernova shockwave should have been spawned
    expect(w().shockwaves.length).toBeGreaterThan(initialShockwavesLength);
    const wave = w().shockwaves[w().shockwaves.length - 1];
    expect(wave.x).toBe(150);
    expect(wave.y).toBe(150);
    expect(wave.maxRadius).toBe(75);
  });

  it('should ease in flocking forces when returning to DRIFT state', () => {
    w().state = 'DRIFT';
    w().flockEasingFactor = 0.0;

    // Call draw() once to verify incrementing easing factor
    draw(eng(), );
    expect(w().flockEasingFactor).toBeGreaterThan(0.0);
    expect(w().flockEasingFactor).toBeLessThan(1.0);
  });

  it('should apply orbit dance forces on particles in Phase 1 and shrink them in Phase 2 during MOON_DANCE', () => {
    // Phase 1 (orbit dance)
    w().state = 'MOON_DANCE';
    w().stateTimer = 120; // Phase 1 is stateTimer > 90
    w().singularity = { x: 100, y: 100, active: true, timer: 120 };

    w().particles = [{
      x: 100,
      y: 200, // 100px away vertically
      vx: 0,
      vy: 0,
      baseVx: 0,
      baseVy: 0,
      radius: 2,
      baseRadius: 2,
      colorBlend: 0,
      wobbleTimer: 0,
      colorPrefix: 'rgba(255, 255, 255,',
      flockable: false,
      life: 1.0,
      birthProgress: 1.0,
      deathProgress: 0.0,
      isDying: false,
      behaviorState: 'CRUISE',
      behaviorTimer: 100,
      speedFactor: 1.0
    }];

    // Run physics tick
    draw(eng(), );

    const p = w().particles[0];
    // In Phase 1, particle should acquire velocity to orbit/swirl
    expect(p.vx).not.toBe(0);
    expect(p.vy).not.toBe(0);

    // Phase 2 (absorption / pull inside)
    w().stateTimer = 30; // Phase 2 is stateTimer <= 90
    p.birthProgress = 1.0;
    p.vx = 0;
    p.vy = 0;

    // Run physics tick
    draw(eng(), );

    // In Phase 2, particle is pulled closer and birthProgress starts shrinking/vanishing
    expect(p.birthProgress).toBeLessThan(1.0);
    expect(p.vx).not.toBe(0);
  });

  describe('Sandbox Cosmic Control Panel and Simulator', () => {
    beforeEach(() => {
      // Mock canvas getBoundingClientRect to ensure coordinates are consistent
      spyOn(component.canvasRef.nativeElement, 'getBoundingClientRect').and.returnValue({
        left: 0,
        top: 0,
        right: 1000,
        bottom: 1000,
        width: 1000,
        height: 1000,
        x: 0,
        y: 0,
        toJSON: () => {}
      } as DOMRect);
      resizeCanvas(eng(), );
    });

    it('should toggle the sandbox open state', () => {
      expect(component.isSandboxOpen).toBeFalse();
      component.toggleSandboxBar();
      expect(component.isSandboxOpen).toBeTrue();
      component.toggleSandboxBar();
      expect(component.isSandboxOpen).toBeFalse();
    });

    it('should toggle sandbox pin state', () => {
      expect(component.isSandboxPinned).toBeFalse();
      component.toggleSandboxPin();
      expect(component.isSandboxPinned).toBeTrue();
      component.toggleSandboxPin();
      expect(component.isSandboxPinned).toBeFalse();
    });

    it('should keep wormholes when switching tools', () => {
      w().wormholes = [{ x: 50, y: 50, radius: 30, type: 'ENTRY', pulsePhase: 0 }];
      component.selectPower('BLACK_HOLE');
      expect(component.activePower).toBe('BLACK_HOLE');
      expect(w().wormholes.length).toBe(1);
    });

    it('should clear sandbox elements', () => {
      w().sandboxBlackholes = [{
        x: 50, y: 50, radius: 10, maxRadius: 10, timer: 100, maxTimer: 100,
        pullRadius: 340, gravityStrength: 1.2
      }];
      w().wormholes = [{ x: 50, y: 50, radius: 30, type: 'ENTRY', pulsePhase: 0 }];
      w().particles.push({
        x: 10, y: 10, vx: 0, vy: 0, baseVx: 0, baseVy: 0, radius: 2, baseRadius: 2,
        colorBlend: 0, wobbleTimer: 0, colorPrefix: 'rgba(255,255,255,', flockable: false,
        life: 1, birthProgress: 1, deathProgress: 0, isDying: false, behaviorState: 'CRUISE',
        behaviorTimer: 100, speedFactor: 1, isNursery: true
      });
      w().nurseryStarCount = 1;
      
      component.clearSandboxElements();
      expect(w().sandboxBlackholes.length).toBe(0);
      expect(w().wormholes.length).toBe(0);
      expect(w().nurseryStarCount).toBe(0);
    });

    it('should keep sandbox black holes until CLEAR', () => {
      w().sandboxBlackholes = [{
        x: 50, y: 50, radius: 10, maxRadius: 10, timer: 500, maxTimer: 600,
        pullRadius: 340, gravityStrength: 1.2
      }];

      for (let i = 0; i < 800; i++) {
        draw(eng(), );
      }

      expect(w().sandboxBlackholes.length).toBe(1);
    });

    it('should add persistent black holes when active power is Event Horizon and mouse click is fired', () => {
      component.selectPower('BLACK_HOLE');
      
      const mousedownEvent = new MouseEvent('mousedown', { clientX: 200, clientY: 200 });
      component.onMouseDown(mousedownEvent);
      expect(w().sandboxBlackholes.length).toBe(0);

      const mouseupEvent = new MouseEvent('mouseup', { clientX: 200, clientY: 200 });
      component.onMouseUp(mouseupEvent);
      
      expect(w().sandboxBlackholes.length).toBe(1);
      expect(w().sandboxBlackholes[0].x).toBe(200);
      expect(w().sandboxBlackholes[0].y).toBe(200);
      expect(w().sandboxBlackholes[0].pullRadius).toBeGreaterThan(0);
      
      // Let's add a particle near the blackhole to test attraction in draw()
      w().particles = [{
        x: 220,
        y: 200,
        vx: 0,
        vy: 0,
        baseVx: 0,
        baseVy: 0,
        radius: 2,
        baseRadius: 2,
        colorBlend: 0,
        wobbleTimer: 0,
        colorPrefix: 'rgba(255, 255, 255,',
        flockable: true,
        life: 1.0,
        birthProgress: 1.0,
        deathProgress: 0.0,
        isDying: false,
        behaviorState: 'CRUISE',
        behaviorTimer: 100,
        speedFactor: 1.0
      }];
      
      // Expand the blackhole fully so gravity reaches the particle immediately
      w().sandboxBlackholes[0].radius = w().sandboxBlackholes[0].maxRadius;
      w().sandboxBlackholes[0].timer = 60;
      
      draw(eng());
      
      // Particle vx/vy should be modified (pulled towards 200, 200)
      expect(w().particles[0].vx).not.toBe(0);
      expect(w().particles[0].vy).not.toBe(0);
    });

    it('should paint nursery stars when Stellar Nursery is released after hold', () => {
      component.selectPower('PAINT_BRUSH');
      const startCount = w().particles.length;
      
      const mousedownEvent = new MouseEvent('mousedown', { clientX: 300, clientY: 300 });
      component.onMouseDown(mousedownEvent);
      const mouseupEvent = new MouseEvent('mouseup', { clientX: 300, clientY: 300 });
      component.onMouseUp(mouseupEvent);
      
      expect(w().particles.length).toBeGreaterThan(startCount);
      expect(w().nurseryStarCount).toBe(1);
      const nurseryParticle = w().particles.find(p => p.isNursery);
      expect(nurseryParticle).toBeDefined();
      expect(Math.abs(nurseryParticle!.x - 300)).toBeLessThan(20);
      expect(Math.abs(nurseryParticle!.y - 300)).toBeLessThan(20);
    });

    it('should spawn a planet when Planet Forge is released after hold', () => {
      component.selectPower('PLANET');
      
      const mousedownEvent = new MouseEvent('mousedown', { clientX: 200, clientY: 200 });
      component.onMouseDown(mousedownEvent);
      w().chargeTime = 40;
      
      const mouseupEvent = new MouseEvent('mouseup', { clientX: 200, clientY: 200 });
      component.onMouseUp(mouseupEvent);
      
      expect(w().sandboxPlanets.length).toBe(1);
      expect(w().sandboxPlanets[0].x).toBe(200);
      expect(w().sandboxPlanets[0].y).toBe(200);
      expect(w().sandboxPlanets[0].radius).toBeGreaterThan(12);
      expect(w().sandboxPlanets[0].mass).toBeGreaterThan(0);
    });

    it('should repel particles when Anti-Gravity is clicked and gravity is paused', () => {
      component.selectPower('REPELLER');
      
      w().mouse.x = 100;
      w().mouse.y = 100;
      w().mouse.active = true;
      w().mouseGravityPauseTimer = 90;
      
      w().particles = [{
        x: 120, // right of mouse
        y: 100,
        vx: 0,
        vy: 0,
        baseVx: 0,
        baseVy: 0,
        radius: 2,
        baseRadius: 2,
        colorBlend: 0,
        wobbleTimer: 0,
        colorPrefix: 'rgba(255, 255, 255,',
        flockable: true,
        life: 1.0,
        birthProgress: 1.0,
        deathProgress: 0.0,
        isDying: false,
        behaviorState: 'CRUISE',
        behaviorTimer: 100,
        speedFactor: 1.0
      }];
      
      draw(eng(), );
      
      // Since particle is to the right of the mouse, vx should be positive (repelled)
      expect(w().particles[0].vx).toBeGreaterThan(0);
    });

    it('should apply swarm gravity with sandbox power when gravity is not paused', () => {
      component.selectPower('REPELLER');
      w().state = 'SWARM';
      w().mouseGravityPauseTimer = 0;

      w().mouse.x = 100;
      w().mouse.y = 100;
      w().mouse.active = true;

      w().particles = [{
        x: 50,
        y: 100,
        vx: 0,
        vy: 0,
        baseVx: 0,
        baseVy: 0,
        radius: 2,
        baseRadius: 2,
        colorBlend: 0,
        wobbleTimer: 0,
        colorPrefix: 'rgba(255, 255, 255,',
        flockable: true,
        life: 1.0,
        birthProgress: 1.0,
        deathProgress: 0.0,
        isDying: false,
        behaviorState: 'CRUISE',
        behaviorTimer: 100,
        speedFactor: 1.0
      }];

      draw(eng(), );

      expect(w().particles[0].vx).toBeGreaterThan(0);
    });

    it('should pause cursor gravity when a sandbox power is clicked', () => {
      component.selectPower('REPELLER');
      component.onMouseDown(new MouseEvent('mousedown', { clientX: 200, clientY: 200 }));
      expect(w().mouseGravityPauseTimer).toBeGreaterThan(0);
    });

    it('should keep SWARM when selecting a sandbox power', () => {
      w().state = 'SWARM';
      component.selectPower('REPELLER');
      expect(w().state).toBe('SWARM');
    });

    it('should not enter CHARGING when Anti-Gravity is active', () => {
      component.selectPower('REPELLER');
      const mousedownEvent = new MouseEvent('mousedown', { clientX: 200, clientY: 200 });
      component.onMouseDown(mousedownEvent);
      expect(w().state).not.toBe('CHARGING');
    });

    it('should trigger tesla lightning discharge when active power is Tesla Discharge', () => {
      component.selectPower('TESLA_DISCHARGE');
      
      w().particles = [{
        x: 105,
        y: 105,
        vx: 0,
        vy: 0,
        baseVx: 0,
        baseVy: 0,
        radius: 2,
        baseRadius: 2,
        colorBlend: 0,
        wobbleTimer: 0,
        colorPrefix: 'rgba(255, 255, 255,',
        flockable: true,
        life: 1.0,
        birthProgress: 1.0,
        deathProgress: 0.0,
        isDying: false,
        behaviorState: 'CRUISE',
        behaviorTimer: 100,
        speedFactor: 1.0
      }];
      
      const mousedownEvent = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      component.onMouseDown(mousedownEvent);
      const mouseupEvent = new MouseEvent('mouseup', { clientX: 100, clientY: 100 });
      component.onMouseUp(mouseupEvent);
      
      // Lightning segment should be created
      expect(w().lightnings.length).toBeGreaterThan(0);
      // Particle should be energized (vx/vy updated and colorBlend = 1.0)
      expect(w().particles[0].colorBlend).toBe(1.0);
      expect(w().particles[0].vx).not.toBe(0);
    });

    it('should create Entry/Exit portals and teleport particles through Wormhole Gate', () => {
      component.selectPower('WORMHOLE');
      
      // Click 1: Spawn Entry Portal
      const click1 = new MouseEvent('mousedown', { clientX: 150, clientY: 150 });
      component.onMouseDown(click1);
      component.onMouseUp(new MouseEvent('mouseup', { clientX: 150, clientY: 150 }));
      expect(w().wormholes.length).toBe(1);
      expect(w().wormholes[0].type).toBe('ENTRY');
      
      // Click 2: Spawn Exit Portal
      const click2 = new MouseEvent('mousedown', { clientX: 450, clientY: 450 });
      component.onMouseDown(click2);
      component.onMouseUp(new MouseEvent('mouseup', { clientX: 450, clientY: 450 }));
      expect(w().wormholes.length).toBe(2);
      expect(w().wormholes[1].type).toBe('EXIT');
      
      // Click 3: Relocate nearest portal (entry is closer to 200,200)
      const initialEntryX = w().wormholes[0].x;
      const click3 = new MouseEvent('mousedown', { clientX: 200, clientY: 200 });
      component.onMouseDown(click3);
      component.onMouseUp(new MouseEvent('mouseup', { clientX: 200, clientY: 200 }));
      
      expect(w().wormholes[0].x).not.toBe(initialEntryX);
      expect(w().wormholes[0].x).toBe(200);
      expect(w().wormholes[0].y).toBe(200);
      
      // Manually set portals to known static points to test warp physics
      w().wormholes[0].x = 100;
      w().wormholes[0].y = 100;
      w().wormholes[1].x = 500;
      w().wormholes[1].y = 500;
      w().wormholeHypergateTimer = 0;
      
      // Put a particle at 101, 100 (near entry at 100, 100)
      w().particles = [{
        x: 101,
        y: 100,
        vx: 0.1,
        vy: 0.1,
        baseVx: 0.1,
        baseVy: 0.1,
        radius: 2,
        baseRadius: 2,
        colorBlend: 0,
        wobbleTimer: 0,
        colorPrefix: 'rgba(255, 255, 255,',
        flockable: true,
        life: 1.0,
        birthProgress: 1.0,
        deathProgress: 0.0,
        isDying: false,
        behaviorState: 'CRUISE',
        behaviorTimer: 100,
        speedFactor: 1.0
      }];
      
      // Run drawing/physics iteration
      draw(eng(), );
      
      // The particle should be teleported near the exit (500, 500)
      expect(Math.abs(w().particles[0].x - 500)).toBeLessThan(15);
      expect(Math.abs(w().particles[0].y - 500)).toBeLessThan(15);
      // Particle should acquire high kinetic speed and flash color
      expect(w().particles[0].colorBlend).toBeGreaterThan(0.85);
    });

    it('should teleport particles via tryWormholeCapture when forceCapture is used', () => {
      w().wormholes = [
        { x: 100, y: 100, radius: 30, type: 'ENTRY', pulsePhase: 0 },
        { x: 500, y: 500, radius: 30, type: 'EXIT', pulsePhase: 0 }
      ];
      const particle = {
        x: 105,
        y: 100,
        vx: 0,
        vy: 0,
        baseVx: 0,
        baseVy: 0,
        radius: 2,
        baseRadius: 2,
        colorBlend: 0,
        wobbleTimer: 0,
        colorPrefix: 'rgba(255, 255, 255,',
        flockable: true,
        life: 1.0,
        birthProgress: 1.0,
        deathProgress: 0.0,
        isDying: false,
        behaviorState: 'CRUISE' as const,
        behaviorTimer: 100,
        speedFactor: 1.0
      };

      const captured = tryWormholeCapture(eng(), particle, { forceCapture: true });
      expect(captured).toBeTrue();
      expect(Math.abs(particle.x - 500)).toBeLessThan(15);
      expect(Math.abs(particle.y - 500)).toBeLessThan(15);
    });

    it('should pull particles inward when Chrono Well is clicked and gravity is paused', () => {
      component.selectPower('TIME_DILATION');
      w().mouse.x = 100;
      w().mouse.y = 100;
      w().mouse.active = true;
      w().isMouseDown = true;
      w().mouseGravityPauseTimer = 90;

      w().particles = [{
        x: 50,
        y: 100,
        vx: 0,
        vy: 0,
        baseVx: 0,
        baseVy: 0,
        radius: 2,
        baseRadius: 2,
        colorBlend: 0,
        wobbleTimer: 0,
        colorPrefix: 'rgba(255, 255, 255,',
        flockable: true,
        life: 1.0,
        birthProgress: 1.0,
        deathProgress: 0.0,
        isDying: false,
        behaviorState: 'CRUISE',
        behaviorTimer: 100,
        speedFactor: 1.0
      }];

      draw(eng(), );

      expect(w().particles[0].vx).toBeGreaterThan(0);
    });

    it('should spawn a stronger black hole on super charge release', () => {
      component.selectPower('BLACK_HOLE');
      component.onMouseDown(new MouseEvent('mousedown', { clientX: 200, clientY: 200 }));
      w().chargeTime = 60;
      component.onMouseUp(new MouseEvent('mouseup', { clientX: 200, clientY: 200 }));

      expect(w().sandboxBlackholes.length).toBe(1);
      expect(w().sandboxBlackholes[0].gravityStrength).toBeGreaterThan(3);
      expect(w().sandboxBlackholes[0].pullRadius).toBeGreaterThanOrEqual(560);
    });

    it('should create more lightning on Tesla super release than tap', () => {
      component.selectPower('TESLA_DISCHARGE');
      w().particles = Array.from({ length: 30 }, (_, i) => ({
        x: 100 + (i % 5) * 8,
        y: 100 + Math.floor(i / 5) * 8,
        vx: 0,
        vy: 0,
        baseVx: 0,
        baseVy: 0,
        radius: 2,
        baseRadius: 2,
        colorBlend: 0,
        wobbleTimer: 0,
        colorPrefix: 'rgba(255, 255, 255,',
        flockable: true,
        life: 1.0,
        birthProgress: 1.0,
        deathProgress: 0.0,
        isDying: false,
        behaviorState: 'CRUISE',
        behaviorTimer: 100,
        speedFactor: 1.0
      }));

      component.onMouseDown(new MouseEvent('mousedown', { clientX: 100, clientY: 100 }));
      component.onMouseUp(new MouseEvent('mouseup', { clientX: 100, clientY: 100 }));
      const tapLightnings = w().lightnings.length;

      w().lightnings = [];
      component.onMouseDown(new MouseEvent('mousedown', { clientX: 100, clientY: 100 }));
      w().chargeTime = 60;
      component.onMouseUp(new MouseEvent('mouseup', { clientX: 100, clientY: 100 }));
      const superLightnings = w().lightnings.length;

      expect(superLightnings).toBeGreaterThan(tapLightnings);
    });

    it('should add shockwave on Anti-Gravity super release', () => {
      component.selectPower('REPELLER');
      const initialWaves = w().shockwaves.length;
      component.onMouseDown(new MouseEvent('mousedown', { clientX: 200, clientY: 200 }));
      w().chargeTime = 60;
      component.onMouseUp(new MouseEvent('mouseup', { clientX: 200, clientY: 200 }));

      expect(w().shockwaves.length).toBeGreaterThan(initialWaves);
      expect(w().inversionNovaTimer).toBeGreaterThan(0);
    });

    it('should blow particles with mouse velocity when Nebular Wind is clicked and gravity is paused', () => {
      component.selectPower('NEBULAR_WIND');
      w().mouse.x = 100;
      w().mouse.y = 100;
      w().mouse.active = true;
      w().isMouseDown = true;
      w().mouseGravityPauseTimer = 90;
      w().mouseVelocity = { x: 10.0, y: -5.0 };

      w().particles = [{
        x: 120,
        y: 100,
        vx: 0.0,
        vy: 0.0,
        baseVx: 0.0,
        baseVy: 0.0,
        radius: 2,
        baseRadius: 2,
        colorBlend: 0,
        wobbleTimer: 0,
        colorPrefix: 'rgba(255, 255, 255,',
        flockable: true,
        life: 1.0,
        birthProgress: 1.0,
        deathProgress: 0.0,
        isDying: false,
        behaviorState: 'CRUISE',
        behaviorTimer: 100,
        speedFactor: 1.0
      }];

      draw(eng(), );

      // Wind force applies: force = (280 - 20) / 280 = 260 / 280 = ~0.928
      // vx increases by mouseVelocity.x * force * 0.25 = 10.0 * 0.928 * 0.25 = ~2.32
      expect(w().particles[0].vx).toBeGreaterThan(0);
      expect(w().particles[0].vy).toBeLessThan(0);
    });
  });

  describe('touch pointer tracking', () => {
    function touchPointerEvent(
      type: string,
      clientX: number,
      clientY: number,
      pointerType = 'touch'
    ): PointerEvent {
      return new PointerEvent(type, {
        clientX,
        clientY,
        pointerType,
        bubbles: true,
        cancelable: true
      });
    }

    it('should update coords and mouseMoving on touch pointermove', () => {
      component.onPointerMove(touchPointerEvent('pointermove', 150, 200));
      expect(w().mouse.x).toBe(150);
      expect(w().mouse.y).toBe(200);
      expect(w().mouse.active).toBe(true);
      expect(w().mouseMoving).toBe(true);
    });

    it('should transition to SWARM on touch pointermove while in DRIFT', () => {
      w().state = 'DRIFT';
      component.onPointerMove(touchPointerEvent('pointermove', 120, 110));
      expect(w().state).toBe('SWARM');
    });

    it('should update coords during touch drag while charging', () => {
      w().state = 'DRIFT';
      component.onPointerDown(touchPointerEvent('pointerdown', 100, 100));
      component.onPointerMove(touchPointerEvent('pointermove', 180, 220));
      expect(w().mouse.x).toBe(180);
      expect(w().mouse.y).toBe(220);
      expect(w().state).toBe('CHARGING');
    });

    it('should clear pointer state after touch pointerup', () => {
      w().state = 'DRIFT';
      component.onPointerDown(touchPointerEvent('pointerdown', 100, 100));
      component.onPointerUp(touchPointerEvent('pointerup', 100, 100));
      expect(w().mouse.x).toBe(-1000);
      expect(w().mouse.y).toBe(-1000);
      expect(w().mouse.active).toBe(false);
      expect(w().mouseMoving).toBe(false);
    });

    it('should not clear pointer state on mouse pointerup', () => {
      w().state = 'DRIFT';
      component.onPointerDown(touchPointerEvent('pointerdown', 100, 100, 'mouse'));
      component.onPointerUp(touchPointerEvent('pointerup', 100, 100, 'mouse'));
      expect(w().mouse.active).toBe(true);
      expect(w().mouse.x).toBe(100);
    });
  });
});
