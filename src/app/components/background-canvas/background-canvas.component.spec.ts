import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackgroundCanvasComponent } from './background-canvas.component';

describe('BackgroundCanvasComponent', () => {
  let component: BackgroundCanvasComponent;
  let fixture: ComponentFixture<BackgroundCanvasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackgroundCanvasComponent]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BackgroundCanvasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize particles with expected properties', () => {
    // Manually trigger initialization to ensure population
    component['initParticles']();
    expect(component['particles'].length).toBeGreaterThan(0);

    const firstParticle = component['particles'][0];
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
    component['applyPerformanceTier']('low');
    component['initParticles']();
    expect(component['particles'].length).toBeLessThanOrEqual(70);

    component['applyPerformanceTier']('high');
    component['initParticles']();
    expect(component['particles'].length).toBeLessThanOrEqual(145);
    expect(component['particles'].length).toBeGreaterThan(35);
  });

  it('should scale background star density by performance tier', () => {
    component['applyPerformanceTier']('low');
    component['initStars']();
    const lowStars = component['backgroundStars'].length;

    component['applyPerformanceTier']('high');
    component['initStars']();
    const highStars = component['backgroundStars'].length;

    expect(highStars).toBeGreaterThan(lowStars);
  });

  it('should downgrade performance tier when sustained FPS is low', () => {
    if (component['animationFrameId'] !== null) {
      cancelAnimationFrame(component['animationFrameId']!);
      component['animationFrameId'] = null;
    }
    component['applyPerformanceTier']('high');
    component['fpsGovernorCooldown'] = 0;
    component['fpsLowStreak'] = 59;
    component['fpsHighStreak'] = 0;
    component['fpsFrameDeltas'] = Array(30).fill(1000 / 30);
    component['lastFrameTime'] = 0;
    component['tickFpsGovernor'](1000);
    expect(component['performanceProfile'].tier).toBe('medium');
  });

  it('should pause and resume the animation loop on visibility change', () => {
    if (component['animationFrameId'] !== null) {
      cancelAnimationFrame(component['animationFrameId']!);
      component['animationFrameId'] = null;
    }

    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    component.onVisibilityChange();
    expect(component['animationPaused']).toBe(true);
    expect(component['animationFrameId']).toBeNull();

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    component.onVisibilityChange();
    expect(component['animationPaused']).toBe(false);
    expect(component['animationFrameId']).not.toBeNull();

    cancelAnimationFrame(component['animationFrameId']!);
    component['animationFrameId'] = null;
  });

  it('should find the nearest particle within range without scanning the full array', () => {
    component['particles'] = [
      { x: 200, y: 100 } as never,
      { x: 108, y: 100 } as never,
      { x: 900, y: 900 } as never
    ];
    const nearest = component['findRandomNearbyParticle'](100, 100, 20);
    expect(nearest?.x).toBe(108);
  });

  it('should find the closest particle indices for Tesla zaps', () => {
    component['particles'] = [
      { x: 100, y: 100 } as never,
      { x: 120, y: 100 } as never,
      { x: 400, y: 400 } as never
    ];
    const indices = component['findNearestParticleIndices'](100, 100, 2, 200);
    expect(indices.length).toBe(2);
    expect(indices).toContain(0);
    expect(indices).toContain(1);
    expect(indices).not.toContain(2);
  });

  it('should cache canvas dimensions after resize', () => {
    component['resizeCanvas']();
    expect(component['canvasWidth']).toBeGreaterThan(0);
    expect(component['canvasHeight']).toBeGreaterThan(0);
  });

  it('should transition game state correctly', () => {
    component['transitionTo']('SWARM');
    expect(component['state']).toBe('SWARM');

    component['transitionTo']('EXPLODING');
    expect(component['state']).toBe('EXPLODING');
    expect(component['stateTimer']).toBe(40);

    component['transitionTo']('SINGULARITY');
    expect(component['state']).toBe('SINGULARITY');
    expect(component['stateTimer']).toBe(25);

    component['transitionTo']('MOON_DANCE');
    expect(component['state']).toBe('MOON_DANCE');
    expect(component['stateTimer']).toBe(390);

    component['transitionTo']('DRIFT');
    expect(component['state']).toBe('DRIFT');
    expect(component['flockEasingFactor']).toBe(0.0);
  });

  it('should handle background blackhole creation, star attraction and absorption', () => {
    // Manually seed a background blackhole
    component['backgroundBlackholes'] = [{
      x: 100,
      y: 100,
      radius: 10,
      maxRadius: 10,
      timer: 100,
      maxTimer: 100
    }];

    // Put a particle close but not inside event horizon to test attraction check
    component['particles'] = [{
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

    component['state'] = 'DRIFT';

    // Invoke draw iteration to run the blackhole physics updates
    component['draw']();

    // Verify particle velocity was altered due to gravity pull
    const p = component['particles'][0];
    expect(p.vx).not.toBe(0);

    // Place particle inside event horizon to test absorption check
    p.x = 101;
    p.y = 100;
    p.isDying = false;

    // Run draw iteration again
    component['draw']();

    // Star should now be set to dying with max death progress
    expect(p.isDying).toBe(true);
    expect(p.deathProgress).toBeGreaterThanOrEqual(1.0);
  });

  it('should spawn mini supernovae upon particle death progress completion', () => {
    const initialShockwavesLength = component['shockwaves'].length;
    
    // Inject a dying particle with deathProgress almost complete
    component['particles'] = [{
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
    component['draw']();

    // Particle should have been cleaned up and spliced out
    expect(component['particles'].length).toBe(0);

    // Mini supernova shockwave should have been spawned
    expect(component['shockwaves'].length).toBeGreaterThan(initialShockwavesLength);
    const wave = component['shockwaves'][component['shockwaves'].length - 1];
    expect(wave.x).toBe(150);
    expect(wave.y).toBe(150);
    expect(wave.maxRadius).toBe(75);
  });

  it('should ease in flocking forces when returning to DRIFT state', () => {
    component['state'] = 'DRIFT';
    component['flockEasingFactor'] = 0.0;

    // Call draw() once to verify incrementing easing factor
    component['draw']();
    expect(component['flockEasingFactor']).toBeGreaterThan(0.0);
    expect(component['flockEasingFactor']).toBeLessThan(1.0);
  });

  it('should apply orbit dance forces on particles in Phase 1 and shrink them in Phase 2 during MOON_DANCE', () => {
    // Phase 1 (orbit dance)
    component['state'] = 'MOON_DANCE';
    component['stateTimer'] = 120; // Phase 1 is stateTimer > 90
    component['singularity'] = { x: 100, y: 100, active: true, timer: 120 };

    component['particles'] = [{
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
    component['draw']();

    const p = component['particles'][0];
    // In Phase 1, particle should acquire velocity to orbit/swirl
    expect(p.vx).not.toBe(0);
    expect(p.vy).not.toBe(0);

    // Phase 2 (absorption / pull inside)
    component['stateTimer'] = 30; // Phase 2 is stateTimer <= 90
    p.birthProgress = 1.0;
    p.vx = 0;
    p.vy = 0;

    // Run physics tick
    component['draw']();

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
      component['resizeCanvas']();
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
      component['wormholes'] = [{ x: 50, y: 50, radius: 30, type: 'ENTRY', pulsePhase: 0 }];
      component.selectPower('BLACK_HOLE');
      expect(component.activePower).toBe('BLACK_HOLE');
      expect(component['wormholes'].length).toBe(1);
    });

    it('should clear sandbox elements', () => {
      component['sandboxBlackholes'] = [{
        x: 50, y: 50, radius: 10, maxRadius: 10, timer: 100, maxTimer: 100,
        pullRadius: 340, gravityStrength: 1.2
      }];
      component['wormholes'] = [{ x: 50, y: 50, radius: 30, type: 'ENTRY', pulsePhase: 0 }];
      component['particles'].push({
        x: 10, y: 10, vx: 0, vy: 0, baseVx: 0, baseVy: 0, radius: 2, baseRadius: 2,
        colorBlend: 0, wobbleTimer: 0, colorPrefix: 'rgba(255,255,255,', flockable: false,
        life: 1, birthProgress: 1, deathProgress: 0, isDying: false, behaviorState: 'CRUISE',
        behaviorTimer: 100, speedFactor: 1, isNursery: true
      });
      component['nurseryStarCount'] = 1;
      
      component.clearSandboxElements();
      expect(component['sandboxBlackholes'].length).toBe(0);
      expect(component['wormholes'].length).toBe(0);
      expect(component['nurseryStarCount']).toBe(0);
    });

    it('should keep sandbox black holes until CLEAR', () => {
      component['sandboxBlackholes'] = [{
        x: 50, y: 50, radius: 10, maxRadius: 10, timer: 500, maxTimer: 600,
        pullRadius: 340, gravityStrength: 1.2
      }];

      for (let i = 0; i < 800; i++) {
        component['draw']();
      }

      expect(component['sandboxBlackholes'].length).toBe(1);
    });

    it('should add persistent black holes when active power is Event Horizon and mouse click is fired', () => {
      component.selectPower('BLACK_HOLE');
      
      const mousedownEvent = new MouseEvent('mousedown', { clientX: 200, clientY: 200 });
      component.onMouseDown(mousedownEvent);
      expect(component['sandboxBlackholes'].length).toBe(0);

      const mouseupEvent = new MouseEvent('mouseup', { clientX: 200, clientY: 200 });
      component.onMouseUp(mouseupEvent);
      
      expect(component['sandboxBlackholes'].length).toBe(1);
      expect(component['sandboxBlackholes'][0].x).toBe(200);
      expect(component['sandboxBlackholes'][0].y).toBe(200);
      expect(component['sandboxBlackholes'][0].pullRadius).toBeGreaterThan(0);
      
      // Let's add a particle near the blackhole to test attraction in draw()
      component['particles'] = [{
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
      
      component['draw']();
      
      // Particle vx/vy should be modified (pulled towards 200, 200)
      expect(component['particles'][0].vx).not.toBe(0);
      expect(component['particles'][0].vy).not.toBe(0);
    });

    it('should paint nursery stars when Stellar Nursery is released after hold', () => {
      component.selectPower('PAINT_BRUSH');
      const startCount = component['particles'].length;
      
      const mousedownEvent = new MouseEvent('mousedown', { clientX: 300, clientY: 300 });
      component.onMouseDown(mousedownEvent);
      const mouseupEvent = new MouseEvent('mouseup', { clientX: 300, clientY: 300 });
      component.onMouseUp(mouseupEvent);
      
      expect(component['particles'].length).toBeGreaterThan(startCount);
      expect(component['nurseryStarCount']).toBe(1);
      const nurseryParticle = component['particles'].find(p => p.isNursery);
      expect(nurseryParticle).toBeDefined();
      expect(Math.abs(nurseryParticle!.x - 300)).toBeLessThan(20);
      expect(Math.abs(nurseryParticle!.y - 300)).toBeLessThan(20);
    });

    it('should repel particles when Anti-Gravity is clicked and gravity is paused', () => {
      component.selectPower('REPELLER');
      
      component['mouse'].x = 100;
      component['mouse'].y = 100;
      component['mouse'].active = true;
      component['mouseGravityPauseTimer'] = 90;
      
      component['particles'] = [{
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
      
      component['draw']();
      
      // Since particle is to the right of the mouse, vx should be positive (repelled)
      expect(component['particles'][0].vx).toBeGreaterThan(0);
    });

    it('should apply swarm gravity with sandbox power when gravity is not paused', () => {
      component.selectPower('REPELLER');
      component['state'] = 'SWARM';
      component['mouseGravityPauseTimer'] = 0;

      component['mouse'].x = 100;
      component['mouse'].y = 100;
      component['mouse'].active = true;

      component['particles'] = [{
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

      component['draw']();

      expect(component['particles'][0].vx).toBeGreaterThan(0);
    });

    it('should pause cursor gravity when a sandbox power is clicked', () => {
      component.selectPower('REPELLER');
      component.onMouseDown(new MouseEvent('mousedown', { clientX: 200, clientY: 200 }));
      expect(component['mouseGravityPauseTimer']).toBeGreaterThan(0);
    });

    it('should keep SWARM when selecting a sandbox power', () => {
      component['state'] = 'SWARM';
      component.selectPower('REPELLER');
      expect(component['state']).toBe('SWARM');
    });

    it('should not enter CHARGING when Anti-Gravity is active', () => {
      component.selectPower('REPELLER');
      const mousedownEvent = new MouseEvent('mousedown', { clientX: 200, clientY: 200 });
      component.onMouseDown(mousedownEvent);
      expect(component['state']).not.toBe('CHARGING');
    });

    it('should trigger tesla lightning discharge when active power is Tesla Discharge', () => {
      component.selectPower('TESLA_DISCHARGE');
      
      component['particles'] = [{
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
      expect(component['lightnings'].length).toBeGreaterThan(0);
      // Particle should be energized (vx/vy updated and colorBlend = 1.0)
      expect(component['particles'][0].colorBlend).toBe(1.0);
      expect(component['particles'][0].vx).not.toBe(0);
    });

    it('should create Entry/Exit portals and teleport particles through Wormhole Gate', () => {
      component.selectPower('WORMHOLE');
      
      // Click 1: Spawn Entry Portal
      const click1 = new MouseEvent('mousedown', { clientX: 150, clientY: 150 });
      component.onMouseDown(click1);
      component.onMouseUp(new MouseEvent('mouseup', { clientX: 150, clientY: 150 }));
      expect(component['wormholes'].length).toBe(1);
      expect(component['wormholes'][0].type).toBe('ENTRY');
      
      // Click 2: Spawn Exit Portal
      const click2 = new MouseEvent('mousedown', { clientX: 450, clientY: 450 });
      component.onMouseDown(click2);
      component.onMouseUp(new MouseEvent('mouseup', { clientX: 450, clientY: 450 }));
      expect(component['wormholes'].length).toBe(2);
      expect(component['wormholes'][1].type).toBe('EXIT');
      
      // Click 3: Relocate nearest portal (entry is closer to 200,200)
      const initialEntryX = component['wormholes'][0].x;
      const click3 = new MouseEvent('mousedown', { clientX: 200, clientY: 200 });
      component.onMouseDown(click3);
      component.onMouseUp(new MouseEvent('mouseup', { clientX: 200, clientY: 200 }));
      
      expect(component['wormholes'][0].x).not.toBe(initialEntryX);
      expect(component['wormholes'][0].x).toBe(200);
      expect(component['wormholes'][0].y).toBe(200);
      
      // Manually set portals to known static points to test warp physics
      component['wormholes'][0].x = 100;
      component['wormholes'][0].y = 100;
      component['wormholes'][1].x = 500;
      component['wormholes'][1].y = 500;
      component['wormholeHypergateTimer'] = 0;
      
      // Put a particle at 101, 100 (near entry at 100, 100)
      component['particles'] = [{
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
      component['draw']();
      
      // The particle should be teleported near the exit (500, 500)
      expect(Math.abs(component['particles'][0].x - 500)).toBeLessThan(15);
      expect(Math.abs(component['particles'][0].y - 500)).toBeLessThan(15);
      // Particle should acquire high kinetic speed and flash color
      expect(component['particles'][0].colorBlend).toBeGreaterThan(0.85);
    });

    it('should teleport particles via tryWormholeCapture when forceCapture is used', () => {
      component['wormholes'] = [
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

      const captured = component['tryWormholeCapture'](particle, { forceCapture: true });
      expect(captured).toBeTrue();
      expect(Math.abs(particle.x - 500)).toBeLessThan(15);
      expect(Math.abs(particle.y - 500)).toBeLessThan(15);
    });

    it('should pull particles inward when Chrono Well is clicked and gravity is paused', () => {
      component.selectPower('TIME_DILATION');
      component['mouse'].x = 100;
      component['mouse'].y = 100;
      component['mouse'].active = true;
      component['isMouseDown'] = true;
      component['mouseGravityPauseTimer'] = 90;

      component['particles'] = [{
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

      component['draw']();

      expect(component['particles'][0].vx).toBeGreaterThan(0);
    });

    it('should spawn a stronger black hole on super charge release', () => {
      component.selectPower('BLACK_HOLE');
      component.onMouseDown(new MouseEvent('mousedown', { clientX: 200, clientY: 200 }));
      component['chargeTime'] = 60;
      component.onMouseUp(new MouseEvent('mouseup', { clientX: 200, clientY: 200 }));

      expect(component['sandboxBlackholes'].length).toBe(1);
      expect(component['sandboxBlackholes'][0].gravityStrength).toBeGreaterThan(3);
      expect(component['sandboxBlackholes'][0].pullRadius).toBeGreaterThanOrEqual(560);
    });

    it('should create more lightning on Tesla super release than tap', () => {
      component.selectPower('TESLA_DISCHARGE');
      component['particles'] = Array.from({ length: 30 }, (_, i) => ({
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
      const tapLightnings = component['lightnings'].length;

      component['lightnings'] = [];
      component.onMouseDown(new MouseEvent('mousedown', { clientX: 100, clientY: 100 }));
      component['chargeTime'] = 60;
      component.onMouseUp(new MouseEvent('mouseup', { clientX: 100, clientY: 100 }));
      const superLightnings = component['lightnings'].length;

      expect(superLightnings).toBeGreaterThan(tapLightnings);
    });

    it('should add shockwave on Anti-Gravity super release', () => {
      component.selectPower('REPELLER');
      const initialWaves = component['shockwaves'].length;
      component.onMouseDown(new MouseEvent('mousedown', { clientX: 200, clientY: 200 }));
      component['chargeTime'] = 60;
      component.onMouseUp(new MouseEvent('mouseup', { clientX: 200, clientY: 200 }));

      expect(component['shockwaves'].length).toBeGreaterThan(initialWaves);
      expect(component['inversionNovaTimer']).toBeGreaterThan(0);
    });

    it('should blow particles with mouse velocity when Nebular Wind is clicked and gravity is paused', () => {
      component.selectPower('NEBULAR_WIND');
      component['mouse'].x = 100;
      component['mouse'].y = 100;
      component['mouse'].active = true;
      component['isMouseDown'] = true;
      component['mouseGravityPauseTimer'] = 90;
      component['mouseVelocity'] = { x: 10.0, y: -5.0 };

      component['particles'] = [{
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

      component['draw']();

      // Wind force applies: force = (280 - 20) / 280 = 260 / 280 = ~0.928
      // vx increases by mouseVelocity.x * force * 0.25 = 10.0 * 0.928 * 0.25 = ~2.32
      expect(component['particles'][0].vx).toBeGreaterThan(0);
      expect(component['particles'][0].vy).toBeLessThan(0);
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
      expect(component['mouse'].x).toBe(150);
      expect(component['mouse'].y).toBe(200);
      expect(component['mouse'].active).toBe(true);
      expect(component['mouseMoving']).toBe(true);
    });

    it('should transition to SWARM on touch pointermove while in DRIFT', () => {
      component['state'] = 'DRIFT';
      component.onPointerMove(touchPointerEvent('pointermove', 120, 110));
      expect(component['state']).toBe('SWARM');
    });

    it('should update coords during touch drag while charging', () => {
      component['state'] = 'DRIFT';
      component.onPointerDown(touchPointerEvent('pointerdown', 100, 100));
      component.onPointerMove(touchPointerEvent('pointermove', 180, 220));
      expect(component['mouse'].x).toBe(180);
      expect(component['mouse'].y).toBe(220);
      expect(component['state']).toBe('CHARGING');
    });

    it('should clear pointer state after touch pointerup', () => {
      component['state'] = 'DRIFT';
      component.onPointerDown(touchPointerEvent('pointerdown', 100, 100));
      component.onPointerUp(touchPointerEvent('pointerup', 100, 100));
      expect(component['mouse'].x).toBe(-1000);
      expect(component['mouse'].y).toBe(-1000);
      expect(component['mouse'].active).toBe(false);
      expect(component['mouseMoving']).toBe(false);
    });

    it('should not clear pointer state on mouse pointerup', () => {
      component['state'] = 'DRIFT';
      component.onPointerDown(touchPointerEvent('pointerdown', 100, 100, 'mouse'));
      component.onPointerUp(touchPointerEvent('pointerup', 100, 100, 'mouse'));
      expect(component['mouse'].active).toBe(true);
      expect(component['mouse'].x).toBe(100);
    });
  });
});
