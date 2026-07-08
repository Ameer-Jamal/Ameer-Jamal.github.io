import type { CosmicCanvasEngine } from '../cosmic-canvas-engine';
import { Particle, SandboxChargeTier, SandboxChronoWell } from '../../models/cosmic.types';

export function spawnSandboxChronoWell(engine: CosmicCanvasEngine, x: number, y: number, tier: SandboxChargeTier): void {
    const activeWells = engine.world.sandboxChronoWells.filter(w => !w.isDying);
    if (activeWells.length >= 3) {
      activeWells[0].isDying = true;
    }

    const maxRadius = tier === 'tap'
      ? 75 + Math.random() * 10
      : tier === 'charged'
      ? 130 + Math.random() * 10
      : 180 + Math.random() * 20;

    const slowFactor = tier === 'tap' ? 0.6 : tier === 'charged' ? 0.32 : 0.12;

    engine.world.sandboxChronoWells.push({
      x,
      y,
      radius: 0,
      maxRadius,
      timer: 0,
      maxTimer: 900,
      slowFactor
    });

    if (tier === 'super') {
      engine.world.shakeTimer = 12;
      engine.world.shockwaves.push({
        x,
        y,
        radius: 0,
        maxRadius: maxRadius * 1.5,
        speed: 4,
        alpha: 0.6,
        color: '0, 240, 255'
      });
    }
  }

export function applySandboxChronoWellForces(engine: CosmicCanvasEngine, p: Particle, cw: SandboxChronoWell): void {
    if (p.isDying || p.birthProgress < 1.0) {
      return;
    }

    const dx = cw.x - p.x;
    const dy = cw.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const scaleRatio = cw.maxRadius > 0 ? (cw.radius / cw.maxRadius) : 1;
    const currentRadius = cw.maxRadius * scaleRatio;

    if (dist < currentRadius) {
      const depth = 1 - dist / currentRadius;
      const wellSlow = cw.slowFactor + (1 - cw.slowFactor) * (1 - depth * scaleRatio);
      p.vx *= wellSlow;
      p.vy *= wellSlow;

      const pullStrength = depth * 0.15 * scaleRatio;
      p.vx += (dx / dist) * pullStrength;
      p.vy += (dy / dist) * pullStrength;
    }
  }
