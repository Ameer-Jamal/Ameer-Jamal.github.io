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
});
