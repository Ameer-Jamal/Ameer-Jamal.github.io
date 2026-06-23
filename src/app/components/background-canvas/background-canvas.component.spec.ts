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
    });

    it('should toggle the sandbox open state', () => {
      expect(component.isSandboxOpen).toBeFalse();
      component.toggleSandboxBar();
      expect(component.isSandboxOpen).toBeTrue();
      component.toggleSandboxBar();
      expect(component.isSandboxOpen).toBeFalse();
    });

    it('should select cosmic powers and clear wormholes on selection', () => {
      component['wormholes'] = [{ x: 50, y: 50, radius: 30, type: 'ENTRY', pulsePhase: 0 }];
      component.selectPower('BLACK_HOLE');
      expect(component.activePower).toBe('BLACK_HOLE');
      expect(component['wormholes'].length).toBe(0);
    });

    it('should clear sandbox elements', () => {
      component['sandboxBlackholes'] = [{ x: 50, y: 50, radius: 10, maxRadius: 10, timer: 100, maxTimer: 100 }];
      component['wormholes'] = [{ x: 50, y: 50, radius: 30, type: 'ENTRY', pulsePhase: 0 }];
      
      component.clearSandboxElements();
      expect(component['sandboxBlackholes'].length).toBe(0);
      expect(component['wormholes'].length).toBe(0);
    });

    it('should add persistent black holes when active power is Event Horizon and mouse click is fired', () => {
      component.selectPower('BLACK_HOLE');
      
      const mousedownEvent = new MouseEvent('mousedown', { clientX: 200, clientY: 200 });
      component.onMouseDown(mousedownEvent);
      
      expect(component['sandboxBlackholes'].length).toBe(1);
      expect(component['sandboxBlackholes'][0].x).toBe(200);
      expect(component['sandboxBlackholes'][0].y).toBe(200);
      
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

    it('should paint new stars when active power is Stellar Nursery and dragging mouse click', () => {
      component.selectPower('PAINT_BRUSH');
      const startCount = component['particles'].length;
      
      const mousedownEvent = new MouseEvent('mousedown', { clientX: 300, clientY: 300 });
      component.onMouseDown(mousedownEvent);
      
      expect(component['particles'].length).toBeGreaterThan(startCount);
      const newParticle = component['particles'][component['particles'].length - 1];
      expect(newParticle.x).toBe(300);
      expect(newParticle.y).toBe(300);
    });

    it('should repel particles when active power is Anti-Gravity and mouse is active', () => {
      component.selectPower('REPELLER');
      
      component['mouse'].x = 100;
      component['mouse'].y = 100;
      component['mouse'].active = true;
      
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

    it('should not apply swarm gravity when Anti-Gravity is active even in SWARM state', () => {
      component.selectPower('REPELLER');
      component['state'] = 'SWARM';

      component['mouse'].x = 100;
      component['mouse'].y = 100;
      component['mouse'].active = true;

      component['particles'] = [{
        x: 120,
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

    it('should leave SWARM when selecting a sandbox power', () => {
      component['state'] = 'SWARM';
      component.selectPower('REPELLER');
      expect(component['state']).toBe('DRIFT');
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
      expect(component['wormholes'].length).toBe(1);
      expect(component['wormholes'][0].type).toBe('ENTRY');
      
      // Click 2: Spawn Exit Portal
      const click2 = new MouseEvent('mousedown', { clientX: 450, clientY: 450 });
      component.onMouseDown(click2);
      expect(component['wormholes'].length).toBe(2);
      expect(component['wormholes'][1].type).toBe('EXIT');
      
      // Click 3: Relocate one portal (to verify relocation path)
      const initialEntryX = component['wormholes'][0].x;
      const initialExitX = component['wormholes'][1].x;
      const click3 = new MouseEvent('mousedown', { clientX: 200, clientY: 200 });
      component.onMouseDown(click3);
      
      // One of the wormholes should have moved to 200, 200
      const entryChanged = component['wormholes'][0].x !== initialEntryX;
      const exitChanged = component['wormholes'][1].x !== initialExitX;
      expect(entryChanged || exitChanged).toBeTrue();
      
      // Manually set portals to known static points to test warp physics
      component['wormholes'][0].x = 100;
      component['wormholes'][0].y = 100;
      component['wormholes'][1].x = 500;
      component['wormholes'][1].y = 500;
      
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
      // Particle should acquire high kinetic speed
      expect(component['particles'][0].colorBlend).toBeCloseTo(0.94, 5);
    });

    it('should slow particle velocity when active power is Time Dilation', () => {
      component.selectPower('TIME_DILATION');
      component['mouse'].x = 100;
      component['mouse'].y = 100;
      component['mouse'].active = true;

      component['particles'] = [{
        x: 110,
        y: 100,
        vx: 4.0,
        vy: 4.0,
        baseVx: 1.0,
        baseVy: 1.0,
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

      // Particle is inside chronosphere (distance 10 < 240), so its velocity should be scaled down significantly
      expect(component['particles'][0].vx).toBeLessThan(1.0);
      expect(component['particles'][0].vy).toBeLessThan(1.0);
      expect(component['particles'][0].vx).toBeGreaterThan(0.5);
      expect(component['particles'][0].vy).toBeGreaterThan(0.5);
      // colorBlend should be boosted to at least 0.7 (but decayed by 0.94 in draw, so 0.7 * 0.94 = 0.658)
      expect(component['particles'][0].colorBlend).toBeCloseTo(0.658, 4);
    });

    it('should blow particles with mouse velocity when active power is Nebular Wind and mouse is pressed', () => {
      component.selectPower('NEBULAR_WIND');
      component['mouse'].x = 100;
      component['mouse'].y = 100;
      component['mouse'].active = true;
      component['isMouseDown'] = true;
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
});
