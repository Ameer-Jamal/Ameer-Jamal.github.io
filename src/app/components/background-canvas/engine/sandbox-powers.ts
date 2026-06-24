import {
  downgradeTier,
  getProfileForTier,
  PerformanceTier,
  resolvePerformanceProfile,
  upgradeTier
} from '../../../utils/performance-profile';
import { CONSTELLATION_TEMPLATES } from '../models/constellation-templates';
import { COSMIC_CONSTANTS } from '../models/cosmic.constants';
import {
  BackgroundGalaxy,
  GameState,
  MousePower,
  Particle,
  SandboxBlackhole,
  SandboxChargeTier
} from '../models/cosmic.types';
import type { CosmicCanvasEngine } from './cosmic-canvas-engine';
import { getMaxNurseryStars, getMaxParticles, getScaledConnectionDistance } from './cosmic-world';

import { isSandboxPowerEngaged, blastParticlesAway, isSandboxPowerChannelActive } from './state-machine';
import { spawnNurseryStar, spawnStardustPuff, spawnMiniSupernova, findNearestParticleIndices } from './particle-system';

export function toggleSandboxBar(engine: CosmicCanvasEngine): void {
    engine.world.isSandboxOpen = !engine.world.isSandboxOpen;
  }


export function toggleSandboxPin(engine: CosmicCanvasEngine): void {
    engine.world.isSandboxPinned = !engine.world.isSandboxPinned;
  }
  

export function selectPower(engine: CosmicCanvasEngine, power: MousePower): void {
    engine.world.activePower = power;
  }
  

export function clearSandboxElements(engine: CosmicCanvasEngine): void {
    engine.world.sandboxBlackholes = [];
    engine.world.wormholes = [];
    engine.world.wormholeHypergateTimer = 0;
    engine.world.inversionNovaTimer = 0;
    engine.world.particles = engine.world.particles.filter(p => !p.isNursery);
    engine.world.nurseryStarCount = 0;
    engine.world.paintHoldFrame = 0;
  }


export function getSandboxChargeProgress(engine: CosmicCanvasEngine): number {
    return Math.min(1, engine.world.chargeTime / 60);
  }


export function getSandboxChargeTier(engine: CosmicCanvasEngine): SandboxChargeTier {
    if (engine.world.chargeTime >= 60) {
      return 'super';
    }
    if (engine.world.chargeTime >= 12) {
      return 'charged';
    }
    return 'tap';
  }


export function isSandboxSuperCharged(engine: CosmicCanvasEngine): boolean {
    return engine.world.chargeTime >= 60;
  }


export function tickSandboxCharge(engine: CosmicCanvasEngine): void {
    if (engine.world.isMouseDown && engine.world.activePower !== 'DEFAULT') {
      engine.world.chargeTime++;
    }
  }


export function drawSandboxChargeAura(engine: CosmicCanvasEngine, 
    innerColor: string,
    midColor: string,
    outerColor: string,
    baseRadius = 35
  ): void {
    if (!engine.world.isMouseDown || engine.world.mouse.x === -1000) {
      return;
    }

    const chargeProgress = getSandboxChargeProgress(engine);
    const auroraRadius = baseRadius + chargeProgress * 95;
    const pulse = Math.sin(Date.now() / 60) * 10;

    const grad = engine.world.ctx.createRadialGradient(
      engine.world.mouse.x, engine.world.mouse.y, 8,
      engine.world.mouse.x, engine.world.mouse.y, auroraRadius + pulse
    );
    grad.addColorStop(0, innerColor.replace('ALPHA', String(0.45 * chargeProgress)));
    grad.addColorStop(0.35, midColor.replace('ALPHA', String(0.28 * chargeProgress)));
    grad.addColorStop(0.75, outerColor.replace('ALPHA', String(0.14 * chargeProgress)));
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

    engine.world.ctx.fillStyle = grad;
    engine.world.ctx.beginPath();
    engine.world.ctx.arc(engine.world.mouse.x, engine.world.mouse.y, auroraRadius + pulse, 0, Math.PI * 2);
    engine.world.ctx.fill();
  }


export function drawSandboxPowerChargeAuras(engine: CosmicCanvasEngine): void {
    if (!engine.world.isMouseDown || engine.world.mouse.x === -1000) {
      return;
    }

    switch (engine.world.activePower) {
      case 'BLACK_HOLE':
        drawBlackHolePreview(engine);
        break;
      case 'TESLA_DISCHARGE':
        drawSandboxChargeAura(engine, 
          'rgba(180, 220, 255, ALPHA)',
          'rgba(120, 180, 255, ALPHA)',
          'rgba(80, 140, 255, ALPHA)'
        );
        break;
      case 'REPELLER':
        drawSandboxChargeAura(engine, 
          'rgba(255, 140, 200, ALPHA)',
          'rgba(255, 100, 170, ALPHA)',
          'rgba(255, 70, 130, ALPHA)'
        );
        break;
      case 'TIME_DILATION':
        drawSandboxChargeAura(engine, 
          'rgba(0, 240, 255, ALPHA)',
          'rgba(80, 200, 255, ALPHA)',
          'rgba(120, 160, 255, ALPHA)'
        );
        break;
      case 'NEBULAR_WIND':
        drawSandboxChargeAura(engine, 
          'rgba(120, 220, 255, ALPHA)',
          'rgba(80, 180, 255, ALPHA)',
          'rgba(60, 140, 255, ALPHA)',
          28
        );
        break;
      case 'PAINT_BRUSH':
        drawSandboxChargeAura(engine, 
          'rgba(255, 220, 180, ALPHA)',
          'rgba(255, 180, 140, ALPHA)',
          'rgba(255, 140, 120, ALPHA)',
          30
        );
        break;
      case 'WORMHOLE':
        drawSandboxChargeAura(engine, 
          'rgba(0, 240, 255, ALPHA)',
          'rgba(255, 100, 230, ALPHA)',
          'rgba(140, 120, 255, ALPHA)'
        );
        break;
    }
  }


export function handleSandboxPowerRelease(engine: CosmicCanvasEngine): void {
    const tier = getSandboxChargeTier(engine);

    switch (engine.world.activePower) {
      case 'BLACK_HOLE':
        spawnSandboxBlackhole(engine, engine.world.mouse.x, engine.world.mouse.y, tier);
        break;
      case 'TESLA_DISCHARGE':
        triggerTeslaDischargePower(engine, tier === 'tap' ? 'tap' : tier === 'charged' ? 'charged' : 'super');
        break;
      case 'REPELLER':
        releaseRepellerPower(engine, tier);
        break;
      case 'TIME_DILATION':
        releaseTimeDilationPower(engine, tier);
        break;
      case 'NEBULAR_WIND':
        releaseNebularWindPower(engine, tier);
        break;
      case 'PAINT_BRUSH':
        releasePaintBrushPower(engine, tier);
        break;
      case 'WORMHOLE':
        releaseWormholePower(engine, tier);
        break;
    }
  }


export function spawnSandboxBlackhole(engine: CosmicCanvasEngine, x: number, y: number, tier: SandboxChargeTier): void {
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


export function releaseRepellerPower(engine: CosmicCanvasEngine, tier: SandboxChargeTier): void {
    if (tier === 'tap') {
      engine.world.shockwaves.push({
        x: engine.world.mouse.x,
        y: engine.world.mouse.y,
        radius: 0,
        maxRadius: 180,
        speed: 9,
        alpha: 0.85,
        color: '255, 120, 190'
      });
      blastParticlesAway(engine, engine.world.mouse.x, engine.world.mouse.y, 8);
      return;
    }

    if (tier === 'charged') {
      engine.world.shockwaves.push({
        x: engine.world.mouse.x,
        y: engine.world.mouse.y,
        radius: 0,
        maxRadius: 280,
        speed: 8,
        alpha: 0.9,
        color: '255, 100, 210'
      });
      blastParticlesAway(engine, engine.world.mouse.x, engine.world.mouse.y, 14);
      return;
    }

    engine.world.inversionNovaTimer = 30;
    engine.world.shakeTimer = 18;
    blastParticlesAway(engine, engine.world.mouse.x, engine.world.mouse.y, 20);
    engine.world.shockwaves.push({
      x: engine.world.mouse.x,
      y: engine.world.mouse.y,
      radius: 0,
      maxRadius: 400,
      speed: 9.5,
      alpha: 1,
      color: '255, 100, 230'
    });
    engine.world.shockwaves.push({
      x: engine.world.mouse.x,
      y: engine.world.mouse.y,
      radius: 0,
      maxRadius: 320,
      speed: 7,
      alpha: 0.85,
      color: '255, 160, 220'
    });
  }


export function releaseTimeDilationPower(engine: CosmicCanvasEngine, tier: SandboxChargeTier): void {
    const radius = tier === 'tap' ? 180 : tier === 'charged' ? 280 : 360;
    const slowFactor = tier === 'tap' ? 0.78 : tier === 'charged' ? 0.42 : 0.12;

    for (const p of engine.world.particles) {
      if (p.isDying || p.birthProgress < 1.0) {
        continue;
      }

      const dx = p.x - engine.world.mouse.x;
      const dy = p.y - engine.world.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      if (dist < radius) {
        const depth = 1 - dist / radius;
        const damp = slowFactor - depth * (tier === 'super' ? 0.04 : 0.12);
        p.vx *= damp;
        p.vy *= damp;

        if (tier !== 'tap') {
          p.vx += (-dy / dist) * depth * (0.25 + (tier === 'super' ? 0.35 : 0.15));
          p.vy += (dx / dist) * depth * (0.25 + (tier === 'super' ? 0.35 : 0.15));
        }

        p.colorBlend = Math.max(p.colorBlend, 0.55 + depth * (tier === 'super' ? 0.45 : 0.3));
      }
    }

    if (tier === 'super') {
      engine.world.shockwaves.push({
        x: engine.world.mouse.x,
        y: engine.world.mouse.y,
        radius: 0,
        maxRadius: 260,
        speed: 3.5,
        alpha: 0.45,
        color: '0, 220, 255'
      });
    } else if (tier === 'charged') {
      engine.world.shockwaves.push({
        x: engine.world.mouse.x,
        y: engine.world.mouse.y,
        radius: 0,
        maxRadius: 190,
        speed: 2.8,
        alpha: 0.28,
        color: '0, 210, 255'
      });
    }
  }


export function releaseNebularWindPower(engine: CosmicCanvasEngine, tier: SandboxChargeTier): void {
    const speed = Math.sqrt(engine.world.mouseVelocity.x ** 2 + engine.world.mouseVelocity.y ** 2);
    const vxNorm = speed > 0.5 ? engine.world.mouseVelocity.x / speed : 1;
    const vyNorm = speed > 0.5 ? engine.world.mouseVelocity.y / speed : 0;
    const gustStrength = tier === 'tap' ? 6 : tier === 'charged' ? 11 : 18;

    for (const p of engine.world.particles) {
      const dx = p.x - engine.world.mouse.x;
      const dy = p.y - engine.world.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const reach = tier === 'super' ? 420 : tier === 'charged' ? 320 : 200;

      if (dist < reach) {
        const force = (reach - dist) / reach;
        p.vx += vxNorm * force * gustStrength;
        p.vy += vyNorm * force * gustStrength;
        p.colorBlend = Math.max(p.colorBlend, 0.55 + force * 0.35);
      }
    }

    if (tier === 'super') {
      engine.world.shakeTimer = 12;
      engine.world.shockwaves.push({
        x: engine.world.mouse.x,
        y: engine.world.mouse.y,
        radius: 0,
        maxRadius: 380,
        speed: 10,
        alpha: 0.95,
        color: '100, 200, 255'
      });
    }
  }


export function releasePaintBrushPower(engine: CosmicCanvasEngine, tier: SandboxChargeTier): void {
    const remaining = getMaxNurseryStars(engine.world) - engine.world.nurseryStarCount;
    if (remaining <= 0) {
      spawnStardustPuff(engine, engine.world.mouse.x, engine.world.mouse.y, 'rgba(255, 220, 180,');
      return;
    }

    if (tier === 'tap') {
      spawnNurseryStar(engine, engine.world.mouse.x, engine.world.mouse.y);
      return;
    }

    if (tier === 'charged') {
      const burst = Math.min(4, remaining);
      for (let i = 0; i < burst; i++) {
        const angle = (Math.PI * 2 * i) / burst;
        spawnNurseryStar(engine, 
          engine.world.mouse.x + Math.cos(angle) * 24,
          engine.world.mouse.y + Math.sin(angle) * 24
        );
      }
      return;
    }

    const burst = Math.min(10, remaining);
    for (let i = 0; i < burst; i++) {
      const angle = i * 0.85;
      const dist = 18 + i * 7;
      spawnNurseryStar(engine, 
        engine.world.mouse.x + Math.cos(angle) * dist,
        engine.world.mouse.y + Math.sin(angle) * dist
      );
    }
    engine.world.shockwaves.push({
      x: engine.world.mouse.x,
      y: engine.world.mouse.y,
      radius: 0,
      maxRadius: 160,
      speed: 5,
      alpha: 0.7,
      color: '255, 220, 180'
    });
  }


export function tryWormholeCapture(engine: CosmicCanvasEngine, p: Particle, opts?: { forceCapture?: boolean }): boolean {
    if (p.isDying || p.birthProgress < 1.0 || engine.world.wormholes.length !== 2) {
      return false;
    }

    const entry = engine.world.wormholes[0];
    const exit = engine.world.wormholes[1];
    const hypergateActive = engine.world.wormholeHypergateTimer > 0;
    const captureRadius = entry.radius * (hypergateActive ? 1.8 : 1);
    const dx = p.x - entry.x;
    const dy = p.y - entry.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);

    if (dist >= captureRadius) {
      return false;
    }

    if (!opts?.forceCapture && speed < 3.5 && dist > captureRadius * 0.55) {
      return false;
    }

    p.x = exit.x + (Math.random() - 0.5) * 8;
    p.y = exit.y + (Math.random() - 0.5) * 8;

    const launchSpeed = hypergateActive ? 12 : 8;
    const launchAngle = Math.random() * Math.PI * 2;
    const launch = Math.random() * launchSpeed + 5.5;
    p.vx = Math.cos(launchAngle) * launch;
    p.vy = Math.sin(launchAngle) * launch;
    p.colorBlend = 1.0;

    spawnStardustPuff(engine, entry.x, entry.y, 'rgba(0, 240, 255,');
    spawnStardustPuff(engine, exit.x, exit.y, 'rgba(255, 100, 230,');
    return true;
  }


export function applyWormholeForcesToParticle(engine: CosmicCanvasEngine, p: Particle): void {
    if (p.isDying || p.birthProgress < 1.0 || engine.world.wormholes.length !== 2) {
      return;
    }

    const entry = engine.world.wormholes[0];
    const hypergateActive = engine.world.wormholeHypergateTimer > 0;
    const entryReach = entry.radius * (hypergateActive ? 2.2 : 1) + 10;
    const pullStrength = hypergateActive ? 1.35 : 0.65;

    const dx = entry.x - p.x;
    const dy = entry.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    if (dist < entryReach) {
      p.vx += (dx / dist) * pullStrength;
      p.vy += (dy / dist) * pullStrength;
      tryWormholeCapture(engine, p);
    }
  }


export function applySandboxBlackholeForces(engine: CosmicCanvasEngine, p: Particle, sbh: SandboxBlackhole): void {
    if (p.isDying || p.birthProgress < 1.0) {
      return;
    }

    const sbhRadius = sbh.radius;
    const dx = sbh.x - p.x;
    const dy = sbh.y - p.y;
    const distSq = dx * dx + dy * dy;
    const pullDist = sbh.pullRadius;
    const gravity = sbh.gravityStrength;

    if (distSq >= pullDist * pullDist) {
      return;
    }

    const dist = Math.sqrt(distSq) || 1;
    const force = (pullDist - dist) / pullDist;
    p.vx += (dx / dist) * force * gravity;
    p.vy += (dy / dist) * force * gravity;

    p.vx += (-dy / dist) * force * (gravity * 0.58);
    p.vy += (dx / dist) * force * (gravity * 0.58);

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
        }
        spawnMiniSupernova(engine, sbh.x, sbh.y, p.colorPrefix);
      }
    }
  }


export function placeWormholePortal(engine: CosmicCanvasEngine): void {
    if (engine.world.wormholes.length < 2) {
      const type = engine.world.wormholes.length === 0 ? 'ENTRY' : 'EXIT';
      engine.world.wormholes.push({
        x: engine.world.mouse.x,
        y: engine.world.mouse.y,
        radius: 30,
        type,
        pulsePhase: Math.random() * Math.PI
      });
      return;
    }

    const first = engine.world.wormholes[0];
    const second = engine.world.wormholes[1];
    const dFirst = (engine.world.mouse.x - first.x) ** 2 + (engine.world.mouse.y - first.y) ** 2;
    const dSecond = (engine.world.mouse.x - second.x) ** 2 + (engine.world.mouse.y - second.y) ** 2;
    const nearest = dFirst <= dSecond ? first : second;
    nearest.x = engine.world.mouse.x;
    nearest.y = engine.world.mouse.y;
  }


export function releaseWormholePower(engine: CosmicCanvasEngine, tier: SandboxChargeTier): void {
    if (tier === 'super' && engine.world.wormholes.length === 2) {
      engine.world.wormholeHypergateTimer = 180;
      engine.world.shakeTimer = 14;
      return;
    }

    placeWormholePortal(engine);
  }


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


export function updateAndDrawSandboxElements(engine: CosmicCanvasEngine, width: number, height: number): void {
    const hypergateActive = engine.world.wormholeHypergateTimer > 0;

    // 1. Sandbox Black holes — persistent until CLEAR (spawn-in animation only)
    for (const sbh of engine.world.sandboxBlackholes) {
      sbh.timer++;
      if (sbh.timer < 60) {
        sbh.radius = sbh.maxRadius * (sbh.timer / 60);
      } else {
        sbh.radius = sbh.maxRadius;
      }

      const sbhRadius = sbh.radius;
      const pulse = Math.sin(Date.now() / 80 + sbh.x) * sbhRadius * 0.2;

      engine.world.ctx.beginPath();
      engine.world.ctx.arc(sbh.x, sbh.y, sbh.pullRadius, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(230, 100, 255, ${0.08 * (sbh.radius / sbh.maxRadius)})`;
      engine.world.ctx.lineWidth = 1;
      engine.world.ctx.setLineDash([6, 10]);
      engine.world.ctx.stroke();
      engine.world.ctx.setLineDash([]);

      engine.world.ctx.beginPath();
      engine.world.ctx.arc(sbh.x, sbh.y, sbhRadius, 0, Math.PI * 2);
      engine.world.ctx.fillStyle = 'rgba(2, 4, 10, 0.98)';
      engine.world.ctx.fill();

      engine.world.ctx.beginPath();
      engine.world.ctx.arc(sbh.x, sbh.y, sbhRadius * 1.45 + pulse, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(230, 100, 255, ${0.65 * (sbh.radius / sbh.maxRadius)})`;
      engine.world.ctx.lineWidth = 2.0;
      engine.world.ctx.stroke();

      engine.world.ctx.beginPath();
      engine.world.ctx.arc(sbh.x, sbh.y, sbhRadius * 1.2 + pulse * 0.5, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(0, 240, 255, ${0.45 * (sbh.radius / sbh.maxRadius)})`;
      engine.world.ctx.lineWidth = 1.0;
      engine.world.ctx.stroke();
    }
    
    // 2. Sandbox Wormholes
    const wLen = engine.world.wormholes.length;
    for (let i = 0; i < wLen; i++) {
      const wh = engine.world.wormholes[i];
      wh.pulsePhase += 0.05;
      
      const pulse = Math.sin(wh.pulsePhase) * 4;
      const radius = wh.radius + pulse;
      
      const grad = engine.world.ctx.createRadialGradient(wh.x, wh.y, 2, wh.x, wh.y, radius * 1.5);
      const colorStr = wh.type === 'ENTRY' ? '0, 240, 255' : '255, 100, 230';
      grad.addColorStop(0, `rgba(10, 15, 30, 0.9)`);
      grad.addColorStop(0.5, `rgba(${colorStr}, 0.5)`);
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      
      engine.world.ctx.fillStyle = grad;
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(wh.x, wh.y, radius * 1.5, 0, Math.PI * 2);
      engine.world.ctx.fill();
      
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(wh.x, wh.y, radius, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(${colorStr}, 0.85)`;
      engine.world.ctx.lineWidth = 2.5;
      engine.world.ctx.stroke();
      
      engine.world.ctx.beginPath();
      for (let j = 0; j < 4; j++) {
        const spiralAngle = wh.pulsePhase + (j * Math.PI) / 2;
        const sx = wh.x + Math.cos(spiralAngle) * (radius * 0.7);
        const sy = wh.y + Math.sin(spiralAngle) * (radius * 0.7);
        engine.world.ctx.moveTo(wh.x, wh.y);
        engine.world.ctx.quadraticCurveTo(wh.x + Math.sin(spiralAngle)*radius*0.4, wh.y + Math.cos(spiralAngle)*radius*0.4, sx, sy);
      }
      engine.world.ctx.strokeStyle = `rgba(${colorStr}, 0.45)`;
      engine.world.ctx.lineWidth = 1.0;
      engine.world.ctx.stroke();
    }
    
    if (engine.world.wormholes.length === 2 && hypergateActive) {
      const entry = engine.world.wormholes[0];
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(entry.x, entry.y, entry.radius * 2.2, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
      engine.world.ctx.lineWidth = 2;
      engine.world.ctx.setLineDash([8, 10]);
      engine.world.ctx.stroke();
      engine.world.ctx.setLineDash([]);
    }

    // 3. Anti-Gravity repulsion field visual (while gravity paused on click/hold)
    if (engine.world.activePower === 'REPELLER' && isSandboxPowerChannelActive(engine) && engine.world.mouse.active && engine.world.mouse.x !== -1000) {
      engine.world.ctx.save();
      const charge = engine.world.isMouseDown ? getSandboxChargeProgress(engine) : 0.2;
      const fieldRadius = 220 + charge * 220;
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(engine.world.mouse.x, engine.world.mouse.y, fieldRadius, 0, Math.PI * 2);
      const repelGrad = engine.world.ctx.createRadialGradient(engine.world.mouse.x, engine.world.mouse.y, 18, engine.world.mouse.x, engine.world.mouse.y, fieldRadius);
      repelGrad.addColorStop(0, 'rgba(255, 100, 180, 0.06)');
      repelGrad.addColorStop(0.55, 'rgba(255, 80, 120, 0.14)');
      repelGrad.addColorStop(1.0, 'rgba(255, 60, 100, 0.28)');
      engine.world.ctx.fillStyle = repelGrad;
      engine.world.ctx.fill();
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(engine.world.mouse.x, engine.world.mouse.y, fieldRadius, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = 'rgba(255, 120, 180, 0.35)';
      engine.world.ctx.lineWidth = 1.5;
      engine.world.ctx.setLineDash([6, 10]);
      engine.world.ctx.stroke();
      engine.world.ctx.setLineDash([]);
      engine.world.ctx.restore();
    }

    // 4. Chrono Well bubble visual (while gravity paused on click/hold)
    if (engine.world.activePower === 'TIME_DILATION' && isSandboxPowerChannelActive(engine) && engine.world.mouse.active && engine.world.mouse.x !== -1000) {
      engine.world.ctx.save();
      const charge = engine.world.isMouseDown ? getSandboxChargeProgress(engine) : 0.25;
      const bubbleRadius = 180 + charge * 180;
      
      // Draw glowing chrono bubble background
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(engine.world.mouse.x, engine.world.mouse.y, bubbleRadius, 0, Math.PI * 2);
      const radGrad = engine.world.ctx.createRadialGradient(engine.world.mouse.x, engine.world.mouse.y, 10, engine.world.mouse.x, engine.world.mouse.y, bubbleRadius);
      radGrad.addColorStop(0, 'rgba(0, 240, 255, 0.04)');
      radGrad.addColorStop(0.8, 'rgba(0, 240, 255, 0.10)');
      radGrad.addColorStop(1.0, 'rgba(0, 240, 255, 0.24)');
      engine.world.ctx.fillStyle = radGrad;
      engine.world.ctx.fill();
      
      // Draw outer rotating dashed clock ring
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(engine.world.mouse.x, engine.world.mouse.y, bubbleRadius, Date.now() / 1200, Date.now() / 1200 + Math.PI * 2);
      engine.world.ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      engine.world.ctx.lineWidth = 1.5;
      engine.world.ctx.setLineDash([8, 12]);
      engine.world.ctx.stroke();
      engine.world.ctx.setLineDash([]);
      
      // Draw inner sweeping radar time-line
      const sweepAngle = (Date.now() / 1500) % (Math.PI * 2);
      engine.world.ctx.beginPath();
      engine.world.ctx.moveTo(engine.world.mouse.x, engine.world.mouse.y);
      engine.world.ctx.lineTo(engine.world.mouse.x + Math.cos(sweepAngle) * bubbleRadius, engine.world.mouse.y + Math.sin(sweepAngle) * bubbleRadius);
      engine.world.ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
      engine.world.ctx.lineWidth = 2.0;
      engine.world.ctx.stroke();
      
      engine.world.ctx.restore();
    }

    // 5. Nebular Wind Visual (while gravity paused + mouse held)
    if (engine.world.activePower === 'NEBULAR_WIND' && isSandboxPowerChannelActive(engine) && engine.world.mouse.active && engine.world.mouse.x !== -1000 && engine.world.isMouseDown) {
      const windSpeedSq = engine.world.mouseVelocity.x * engine.world.mouseVelocity.x + engine.world.mouseVelocity.y * engine.world.mouseVelocity.y;
      if (windSpeedSq > 0.5) {
        engine.world.ctx.save();
        const count = 5;
        engine.world.ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
        engine.world.ctx.lineWidth = 1.0;
        
        const speed = Math.sqrt(windSpeedSq);
        const vxNorm = engine.world.mouseVelocity.x / speed;
        const vyNorm = engine.world.mouseVelocity.y / speed;
        
        for (let j = 0; j < count; j++) {
          const r = Math.random() * 80;
          const theta = Math.random() * Math.PI * 2;
          const ox = Math.cos(theta) * r;
          const oy = Math.sin(theta) * r;
          
          const startX = engine.world.mouse.x + ox - vxNorm * 100;
          const startY = engine.world.mouse.y + oy - vyNorm * 100;
          const endX = engine.world.mouse.x + ox + vxNorm * 120;
          const endY = engine.world.mouse.y + oy + vyNorm * 120;
          
          engine.world.ctx.beginPath();
          engine.world.ctx.moveTo(startX, startY);
          engine.world.ctx.bezierCurveTo(
            startX + vxNorm * 50 + (Math.random() - 0.5) * 30,
            startY + vyNorm * 50 + (Math.random() - 0.5) * 30,
            startX + vxNorm * 100 + (Math.random() - 0.5) * 30,
            startY + vyNorm * 100 + (Math.random() - 0.5) * 30,
            endX,
            endY
          );
          engine.world.ctx.stroke();
        }
        engine.world.ctx.restore();
      }
    }
  }
