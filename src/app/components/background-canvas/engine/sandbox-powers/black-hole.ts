import type { CosmicCanvasEngine } from '../cosmic-canvas-engine';
import { SandboxChargeTier, Particle, SandboxBlackhole } from '../../models/cosmic.types';
import { isSandboxPowerEngaged } from '../state-machine';
import { spawnMiniSupernova } from '../particle-system';
import { playBlackHoleConsumeSound } from '../audio';
import { getSandboxChargeProgress } from './charge';
import { tryWormholeCapture } from './wormhole';
import { drawCosmicBlackHole } from '../frame/shared';

export function spawnSandboxBlackhole(
  engine: CosmicCanvasEngine, 
  x: number, 
  y: number, 
  tier: SandboxChargeTier,
  chargeProgress: number
): void {
    const activeBHs = engine.world.sandboxBlackholes.filter(bh => !bh.isDying);
    if (activeBHs.length >= 4) {
      activeBHs[0].isDying = true;
    }

    let baseMaxRadius = 20;
    let pullRadius = 340;
    let gravityStrength = 1.2;

    if (tier === 'tap') {
      baseMaxRadius = 20;
      pullRadius = 340;
      gravityStrength = 1.2;
    } else if (tier === 'charged') {
      baseMaxRadius = 32;
      pullRadius = 460;
      gravityStrength = 2.4;
      engine.world.shakeTimer = Math.max(engine.world.shakeTimer, 8);
    } else {
      // tier === 'super'
      baseMaxRadius = 45;
      pullRadius = 560;
      gravityStrength = 3.5;
      engine.world.shakeTimer = 22;
    }

    let maxRadius = baseMaxRadius;

    // Bounded and dampened scale-up beyond normal limits if held longer
    if (chargeProgress > 1.0) {
      const multiplier = Math.min(2.0, 1.0 + (chargeProgress - 1.0) * 0.45);
      maxRadius *= multiplier;
      pullRadius *= multiplier;
      gravityStrength *= multiplier;
      engine.world.shakeTimer = Math.min(36, Math.max(engine.world.shakeTimer, Math.floor(22 * multiplier)));
    }

    engine.world.sandboxBlackholes.push({
      x,
      y,
      radius: 0,
      maxRadius,
      timer: 0,
      maxTimer: Math.max(900, Math.floor(900 * Math.min(2.5, chargeProgress))),
      pullRadius,
      gravityStrength
    });
  }

export function applyBlackHolePreviewGravity(engine: CosmicCanvasEngine): void {
    if (!isSandboxPowerEngaged(engine) || engine.world.activePower !== 'BLACK_HOLE' || engine.world.mouse.x === -1000) {
      return;
    }

    const charge = getSandboxChargeProgress(engine);
    const pullRadius = 280 + charge * 220;
    const gravity = 1.0 + charge * 2.2;

    for (const p of engine.world.particles) {
      if (p.isDying || p.birthProgress < 1.0) {
        continue;
      }

      const dx = engine.world.mouse.x - p.x;
      const dy = engine.world.mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      if (dist < pullRadius) {
        const force = (pullRadius - dist) / pullRadius;
        p.vx += (dx / dist) * force * gravity;
        p.vy += (dy / dist) * force * gravity;
        p.vx += (-dy / dist) * force * (gravity * 0.55);
        p.vy += (dx / dist) * force * (gravity * 0.55);
        p.colorBlend = Math.max(p.colorBlend, 0.45 + charge * 0.4);
      }
    }
  }

export function drawBlackHolePreview(engine: CosmicCanvasEngine): void {
    if (!isSandboxPowerEngaged(engine) || engine.world.activePower !== 'BLACK_HOLE' || engine.world.mouse.x === -1000) {
      return;
    }

    const charge = engine.world.chargeTime / 60;
    
    // 1:1 Dimension tracking formula matching the final spawned elements
    let baseRadius = 20;
    let pullRadius = 340;
    if (charge >= 1.0) {
      baseRadius = 45;
      pullRadius = 560;
    } else if (charge >= 0.2) {
      baseRadius = 32;
      pullRadius = 460;
    } else {
      baseRadius = 20;
      pullRadius = 340;
    }

    let previewRadius = baseRadius;
    if (charge > 1.0) {
      const multiplier = Math.min(2.0, 1.0 + (charge - 1.0) * 0.45);
      previewRadius *= multiplier;
      pullRadius *= multiplier;
    } else {
      // Smooth interpolation during initial charging up to the base sizes
      if (charge < 0.2) {
        previewRadius = 14 + (charge / 0.2) * 6;
        pullRadius = 280 + (charge / 0.2) * 60;
      } else {
        previewRadius = 20 + ((charge - 0.2) / 0.8) * 25;
        pullRadius = 340 + ((charge - 0.2) / 0.8) * 220;
      }
    }

    engine.world.ctx.beginPath();
    engine.world.ctx.arc(engine.world.mouse.x, engine.world.mouse.y, pullRadius, 0, Math.PI * 2);
    engine.world.ctx.strokeStyle = `rgba(0, 240, 255, ${0.12 + Math.min(1.0, charge) * 0.22})`;
    engine.world.ctx.lineWidth = 1.5;
    engine.world.ctx.setLineDash([10, 14]);
    engine.world.ctx.stroke();
    engine.world.ctx.setLineDash([]);

    drawCosmicBlackHole(
      engine.world.ctx,
      engine.world.mouse.x,
      engine.world.mouse.y,
      previewRadius,
      Math.min(1.0, 0.75 + charge * 0.25)
    );
  }

export function applySandboxBlackholeForces(engine: CosmicCanvasEngine, p: Particle, sbh: SandboxBlackhole): void {
    if (p.isDying || p.birthProgress < 1.0) {
      return;
    }

    const sbhRadius = sbh.radius;
    const dx = sbh.x - p.x;
    const dy = sbh.y - p.y;
    const distSq = dx * dx + dy * dy;
    const scaleRatio = sbh.maxRadius > 0 ? (sbh.radius / sbh.maxRadius) : 1;
    const pullDist = sbh.pullRadius * scaleRatio;
    const gravity = sbh.gravityStrength * scaleRatio;

    if (distSq >= pullDist * pullDist) {
      return;
    }

    const dist = Math.sqrt(distSq) || 1;
    const force = (pullDist - dist) / pullDist;
    p.vx += (dx / dist) * force * gravity;
    p.vy += (dy / dist) * force * gravity;

    // Small tangential nudge — just enough for a gentle spiral, not enough to
    // slingshot stars past the black hole (which creates the "bounce" look).
    p.vx += (-dy / dist) * force * (gravity * 0.12);
    p.vy += (dx / dist) * force * (gravity * 0.12);

    if (dist < sbhRadius * 2.5) {
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const maxInward = 6 + gravity * 2.5;
      if (speed > maxInward) {
        p.vx = (p.vx / speed) * maxInward;
        p.vy = (p.vy / speed) * maxInward;
      }
    }

    if (dist < sbhRadius + 6) {
      if (engine.world.wormholes.length === 2) {
        const entry = engine.world.wormholes[0];
        const edx = entry.x - p.x;
        const edy = entry.y - p.y;
        const edist = Math.sqrt(edx * edx + edy * edy) || 1;
        p.vx += (edx / edist) * 3.5;
        p.vy += (edy / edist) * 3.5;
        tryWormholeCapture(engine, p, { forceCapture: true });
      } else {
        p.isDying = true;
        p.deathProgress = 1.0;
        if (p.isNursery) {
          engine.world.nurseryStarCount = Math.max(0, engine.world.nurseryStarCount - 1);
          p.isNursery = false;
        }
        spawnMiniSupernova(engine, sbh.x, sbh.y, p.colorPrefix);
        playBlackHoleConsumeSound();
      }
    }
  }
