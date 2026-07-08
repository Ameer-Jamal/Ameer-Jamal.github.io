import type { CosmicCanvasEngine } from '../cosmic-canvas-engine';
import { SandboxChargeTier, Particle, SandboxBlackhole } from '../../models/cosmic.types';
import { isSandboxPowerEngaged } from '../state-machine';
import { spawnMiniSupernova } from '../particle-system';
import { playBlackHoleConsumeSound } from '../audio';
import { getSandboxChargeProgress } from './charge';
import { tryWormholeCapture } from './wormhole';

export function spawnSandboxBlackhole(engine: CosmicCanvasEngine, x: number, y: number, tier: SandboxChargeTier): void {
    const activeBHs = engine.world.sandboxBlackholes.filter(bh => !bh.isDying);
    if (activeBHs.length >= 4) {
      activeBHs[0].isDying = true;
    }

    if (tier === 'tap') {
      engine.world.sandboxBlackholes.push({
        x,
        y,
        radius: 0,
        maxRadius: Math.random() * 8 + 18,
        timer: 0,
        maxTimer: 600,
        pullRadius: 340,
        gravityStrength: 1.2
      });
      return;
    }

    if (tier === 'charged') {
      engine.world.sandboxBlackholes.push({
        x,
        y,
        radius: 0,
        maxRadius: Math.random() * 7 + 28,
        timer: 0,
        maxTimer: 720,
        pullRadius: 460,
        gravityStrength: 2.4
      });
      engine.world.shakeTimer = Math.max(engine.world.shakeTimer, 8);
      return;
    }

    engine.world.sandboxBlackholes.push({
      x,
      y,
      radius: 0,
      maxRadius: Math.random() * 15 + 40,
      timer: 0,
      maxTimer: 900,
      pullRadius: 560,
      gravityStrength: 3.5
    });
    engine.world.shakeTimer = 22;
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

    const charge = getSandboxChargeProgress(engine);
    const previewRadius = 14 + charge * 28;
    const pullRadius = 280 + charge * 220;
    const pulse = Math.sin(Date.now() / 80) * previewRadius * 0.15;

    engine.world.ctx.beginPath();
    engine.world.ctx.arc(engine.world.mouse.x, engine.world.mouse.y, pullRadius, 0, Math.PI * 2);
    engine.world.ctx.strokeStyle = `rgba(230, 100, 255, ${0.12 + charge * 0.22})`;
    engine.world.ctx.lineWidth = 1.5;
    engine.world.ctx.setLineDash([10, 14]);
    engine.world.ctx.stroke();
    engine.world.ctx.setLineDash([]);

    engine.world.ctx.beginPath();
    engine.world.ctx.arc(engine.world.mouse.x, engine.world.mouse.y, previewRadius + pulse, 0, Math.PI * 2);
    engine.world.ctx.fillStyle = `rgba(2, 4, 10, ${0.75 + charge * 0.2})`;
    engine.world.ctx.fill();

    engine.world.ctx.beginPath();
    engine.world.ctx.arc(engine.world.mouse.x, engine.world.mouse.y, previewRadius * 1.6 + pulse, 0, Math.PI * 2);
    engine.world.ctx.strokeStyle = `rgba(0, 240, 255, ${0.35 + charge * 0.45})`;
    engine.world.ctx.lineWidth = 2;
    engine.world.ctx.stroke();
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
