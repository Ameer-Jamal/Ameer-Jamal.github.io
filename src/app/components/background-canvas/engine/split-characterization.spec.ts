import { getProfileForTier } from '../../../utils/performance-profile';
import { CosmicCanvasEngine } from './cosmic-canvas-engine';
import { draw } from './draw-frame';
import { draw as drawImpl } from './frame/index';
import {
  clearSandboxElements,
  updateAndDrawSandboxElements
} from './sandbox-powers';
import { clearSandboxElements as clearSandboxElementsImpl } from './sandbox-powers/toolbar';
import { updateAndDrawSandboxElements as updateAndDrawSandboxElementsImpl } from './sandbox-powers/render';

describe('background canvas engine split characterization', () => {
  let engine: CosmicCanvasEngine;

  beforeEach(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;

    engine = new CosmicCanvasEngine(canvas, ctx);
    engine.world.performanceProfile = getProfileForTier('high');
    engine.world.canvasWidth = 800;
    engine.world.canvasHeight = 600;
    engine.world.state = 'DRIFT';
  });

  afterEach(() => {
    document.body.classList.remove('is-article-visible');
  });

  it('keeps the draw-frame and sandbox-powers compatibility barrels wired to the split modules', () => {
    expect(draw).toBe(drawImpl);
    expect(clearSandboxElements).toBe(clearSandboxElementsImpl);
    expect(updateAndDrawSandboxElements).toBe(updateAndDrawSandboxElementsImpl);
  });

  it('releases a queued stellar lasso through updateAndDrawSandboxElements after the path collapses', () => {
    engine.world.activePower = 'STELLAR_LASSO';
    engine.world.isMouseDown = false;
    engine.world.mouse.x = 180;
    engine.world.mouse.y = 220;
    engine.world.lassoReleaseQueued = true;
    engine.world.lassoReleaseTier = 'charged';
    engine.world.lassoPath = [
      { x: 120, y: 140 },
      { x: 121, y: 141 }
    ];
    engine.world.particles = [{
      x: 125,
      y: 145,
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
      life: 1,
      birthProgress: 1,
      deathProgress: 0,
      isDying: false,
      behaviorState: 'CRUISE',
      behaviorTimer: 60,
      speedFactor: 1,
      isLassoed: true
    }];

    updateAndDrawSandboxElements(engine, 800, 600);

    expect(engine.world.lassoPath.length).toBe(0);
    expect(engine.world.lassoReleaseQueued).toBeFalse();
    expect(engine.world.shockwaves.length).toBe(1);
    expect(engine.world.shakeTimer).toBe(18);
    expect(engine.world.particles[0].isLassoed).toBeFalse();
  });

  it('closes the sandbox through the public draw entrypoint when an article modal is visible', () => {
    document.body.classList.add('is-article-visible');
    engine.world.isSandboxOpen = true;

    draw(engine);

    expect(engine.world.isSandboxOpen).toBeFalse();
  });

  it('breaks out of a stale aya formation lock through the public draw entrypoint', () => {
    engine.world.state = 'AYA_FORMATION';
    engine.world.stateTimer = 10001;
    engine.world.isAyaDanceActive = false;
    engine.world.particles = [{
      x: 300,
      y: 220,
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
      life: 1,
      birthProgress: 1,
      deathProgress: 0,
      isDying: false,
      behaviorState: 'CRUISE',
      behaviorTimer: 100,
      speedFactor: 1,
      formationActive: true,
      formationTx: 320,
      formationTy: 240
    }];

    draw(engine);

    expect(engine.world.state).toBe('DRIFT');
    expect(engine.world.particles[0].formationActive).toBeFalse();
    expect(engine.world.particles[0].formationTx).toBeUndefined();
    expect(engine.world.particles[0].formationTy).toBeUndefined();
  });
});
