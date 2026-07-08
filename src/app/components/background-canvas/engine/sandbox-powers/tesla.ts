import type { CosmicCanvasEngine } from '../cosmic-canvas-engine';
import { Particle } from '../../models/cosmic.types';
import { blastParticlesAway } from '../state-machine';
import { findNearestParticleIndices } from '../particle-system';
import { getSandboxChargeProgress } from './charge';
import { shatterPlanet } from './planet';

export function triggerTeslaDischargePower(engine: CosmicCanvasEngine, intensity: 'tap' | 'charged' | 'super' = 'tap'): void {
    const config = {
      tap: { maxTargets: 6, radius: 500, blast: 14, chain: false },
      charged: { maxTargets: 10, radius: 550, blast: 16, chain: false },
      super: { maxTargets: 25, radius: 600, blast: 18, chain: true }
    }[intensity];

    const sorted = [...engine.world.particles]
      .map(p => {
        const dx = p.x - engine.world.mouse.x;
        const dy = p.y - engine.world.mouse.y;
        return { particle: p, dist: Math.sqrt(dx * dx + dy * dy) };
      })
      .sort((a, b) => a.dist - b.dist);

    const targetCount = Math.min(config.maxTargets, sorted.length);
    const struck: Particle[] = [];

    for (let i = 0; i < targetCount; i++) {
      const p = sorted[i].particle;
      const dx = p.x - engine.world.mouse.x;
      const dy = p.y - engine.world.mouse.y;
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
            x: engine.world.mouse.x + (p.x - engine.world.mouse.x) * t + ox,
            y: engine.world.mouse.y + (p.y - engine.world.mouse.y) * t + oy
          });
        }
        engine.world.lightnings.push({ segments, alpha: 1.0 });
      }
    }

    // Zap and shatter planets in range during Tesla Discharge!
    for (const pl of engine.world.sandboxPlanets) {
      if (pl.isDying) continue;
      const dx = pl.x - engine.world.mouse.x;
      const dy = pl.y - engine.world.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < config.radius) {
        const segments = [];
        const steps = 6;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const baseOffset = 18 * (1 - t);
          const ox = (s === 0 || s === steps) ? 0 : (Math.random() - 0.5) * baseOffset;
          const oy = (s === 0 || s === steps) ? 0 : (Math.random() - 0.5) * baseOffset;
          segments.push({
            x: engine.world.mouse.x + (pl.x - engine.world.mouse.x) * t + ox,
            y: engine.world.mouse.y + (pl.y - engine.world.mouse.y) * t + oy
          });
        }
        engine.world.lightnings.push({ segments, alpha: 1.0 });

        shatterPlanet(engine, pl);
      }
    }

    if (config.chain && struck.length > 1) {
      for (let i = 0; i < struck.length - 1 && i < 14; i++) {
        const a = struck[i];
        const b = struck[i + 1];
        engine.world.lightnings.push({
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
      engine.world.shakeTimer = 25;
      engine.world.screenFlash = 8;
      blastParticlesAway(engine, engine.world.mouse.x, engine.world.mouse.y, 18);
    }
  }

export function tickTeslaHoldZaps(engine: CosmicCanvasEngine): void {
    if (!engine.world.isMouseDown || engine.world.activePower !== 'TESLA_DISCHARGE' || engine.world.mouse.x === -1000) {
      return;
    }

    engine.world.teslaHoldZapTimer++;
    if (engine.world.teslaHoldZapTimer % 8 !== 0) {
      return;
    }

    // Also zap and shatter planets occasionally if mouse is held near them
    for (const pl of engine.world.sandboxPlanets) {
      if (pl.isDying) continue;
      const dx = pl.x - engine.world.mouse.x;
      const dy = pl.y - engine.world.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 420 && Math.random() < 0.22) {
        engine.world.lightnings.push({
          segments: [
            { x: engine.world.mouse.x, y: engine.world.mouse.y },
            { x: engine.world.mouse.x + (pl.x - engine.world.mouse.x) * 0.5 + (Math.random() - 0.5) * 12, y: engine.world.mouse.y + (pl.y - engine.world.mouse.y) * 0.5 + (Math.random() - 0.5) * 12 },
            { x: pl.x, y: pl.y }
          ],
          alpha: 0.85
        });
        shatterPlanet(engine, pl);
      }
    }

    const charge = getSandboxChargeProgress(engine);
    const zapCount = Math.max(1, Math.floor((2 + Math.floor(charge * 3)) * engine.world.performanceProfile.effectScale));
    const zapIndices = findNearestParticleIndices(engine, engine.world.mouse.x, engine.world.mouse.y, zapCount, 420);

    for (const idx of zapIndices) {
      const p = engine.world.particles[idx];
      if (!p) {
        continue;
      }

      const dx = p.x - engine.world.mouse.x;
      const dy = p.y - engine.world.mouse.y;
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.35;
      p.vx += Math.cos(angle) * 4.5;
      p.vy += Math.sin(angle) * 4.5;
      p.colorBlend = Math.max(p.colorBlend, 0.75);

      engine.world.lightnings.push({
        segments: [
          { x: engine.world.mouse.x, y: engine.world.mouse.y },
          { x: engine.world.mouse.x + (p.x - engine.world.mouse.x) * 0.5 + (Math.random() - 0.5) * 12, y: engine.world.mouse.y + (p.y - engine.world.mouse.y) * 0.5 + (Math.random() - 0.5) * 12 },
          { x: p.x, y: p.y }
        ],
        alpha: 0.75
      });
    }
  }
