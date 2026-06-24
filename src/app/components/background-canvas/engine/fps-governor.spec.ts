import { getProfileForTier } from '../../../utils/performance-profile';
import { createCosmicWorld } from './cosmic-world';
import { applyPerformanceTier, tickFpsGovernor } from './fps-governor';
import { CosmicCanvasEngine } from './cosmic-canvas-engine';

describe('fps-governor', () => {
  let engine: CosmicCanvasEngine;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    ctx = canvas.getContext('2d')!;
    engine = new CosmicCanvasEngine(canvas, ctx);
    engine.world.performanceProfile = getProfileForTier('high');
  });

  it('downgrades tier when sustained FPS is low', () => {
    applyPerformanceTier(engine, 'high');
    engine.world.fpsGovernorCooldown = 0;
    engine.world.fpsLowStreak = 59;
    engine.world.fpsHighStreak = 0;
    engine.world.fpsFrameDeltas = Array(30).fill(1000 / 30);
    engine.world.lastFrameTime = 0;

    tickFpsGovernor(engine, 1000);

    expect(engine.world.performanceProfile.tier).toBe('medium');
  });

  it('creates cosmic world with default drift state', () => {
    const world = createCosmicWorld(canvas, ctx);
    expect(world.state).toBe('DRIFT');
    expect(world.particles).toEqual([]);
    expect(world.mouse.x).toBe(-1000);
  });
});
