import type { CosmicCanvasEngine } from '../cosmic-canvas-engine';
import { renderBackground } from './background';
import { renderEffects } from './effects';
import { updateAndRenderParticles } from './particles';
import { renderSandboxFrame } from './sandbox';
import { tickFrameState } from './state';
import { renderOverlays } from './overlays';

export function draw(engine: CosmicCanvasEngine): void {
  const width = engine.world.canvasWidth || window.innerWidth;
  const height = engine.world.canvasHeight || window.innerHeight;

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const lastTick = (engine.world as any).lastStateTickTime || now;
  (engine.world as any).lastStateTickTime = now;
  const deltaMs = now - lastTick;
  const cappedDeltaMs = Math.min(100, deltaMs);
  const frameDelta = deltaMs <= 0 ? 1.0 : cappedDeltaMs / 16.6667;

  tickFrameState(engine, frameDelta);

  let shakeApplied = false;
  if (engine.world.shakeTimer > 0) {
    engine.world.shakeTimer--;
    const shakeIntensity = (engine.world.shakeTimer / 30) * 8.5;
    const shakeX = (Math.random() - 0.5) * shakeIntensity;
    const shakeY = (Math.random() - 0.5) * shakeIntensity;
    engine.world.ctx.save();
    engine.world.ctx.translate(shakeX, shakeY);
    shakeApplied = true;
  }

  renderBackground(engine, width, height);
  const chargeProgress = renderSandboxFrame(engine, width, height);
  renderEffects(engine, width, height);
  updateAndRenderParticles(engine, width, height, chargeProgress);
  renderOverlays(engine, width, height);

  if (shakeApplied) {
    engine.world.ctx.restore();
  }

  if (engine.world.screenFlash > 0) {
    engine.world.screenFlash--;
    const flashMax = engine.world.isAyaDanceActive ? 18 : 14;
    const flashAlpha = engine.world.screenFlash / flashMax;
    const flashRgb = engine.world.isAyaDanceActive ? '255, 180, 220' : '255, 255, 255';
    engine.world.ctx.fillStyle = `rgba(${flashRgb}, ${flashAlpha})`;
    engine.world.ctx.fillRect(0, 0, width, height);
  }
}
