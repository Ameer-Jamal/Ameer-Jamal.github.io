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
  SandboxChargeTier,
  SandboxChronoWell,
  SandboxPlanet
} from '../models/cosmic.types';
import type { CosmicCanvasEngine } from './cosmic-canvas-engine';
import { getMaxNurseryStars, getMaxParticles, getScaledConnectionDistance } from './cosmic-world';

import { isSandboxPowerEngaged, blastParticlesAway, isSandboxPowerChannelActive } from './state-machine';
import { spawnNurseryStar, spawnStardustPuff, spawnMiniSupernova, findNearestParticleIndices, spawnStellarBirth } from './particle-system';
import {
  playSelectPowerSound,
  playToggleSandboxSound,
  playClearSound,
  playWormholeTeleportSound,
  playBlackHoleConsumeSound,
  playPowerReleaseSound,
  playSupernovaPop,
  updatePowerChargeAudio
} from './audio';

export function toggleSandboxBar(engine: CosmicCanvasEngine): void {
    engine.world.isSandboxOpen = !engine.world.isSandboxOpen;
    playToggleSandboxSound(engine.world.isSandboxOpen);
  }


export function toggleSandboxPin(engine: CosmicCanvasEngine): void {
    engine.world.isSandboxPinned = !engine.world.isSandboxPinned;
  }
  

export function selectPower(engine: CosmicCanvasEngine, power: MousePower): void {
    engine.world.activePower = power;
    playSelectPowerSound(power);
  }
  

export function clearSandboxElements(engine: CosmicCanvasEngine): void {
    playClearSound();
    engine.world.sandboxBlackholes = [];
    engine.world.sandboxChronoWells = [];
    engine.world.sandboxPlanets = [];
    engine.world.draggedPlanet = null;
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
      case 'PLANET':
        drawPlanetPreview(engine);
        break;
    }
  }


export function handleSandboxPowerRelease(engine: CosmicCanvasEngine): void {
    const tier = getSandboxChargeTier(engine);
    playPowerReleaseSound(engine.world.activePower, tier);
    updatePowerChargeAudio(engine.world.activePower, false, 0);

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
        spawnSandboxChronoWell(engine, engine.world.mouse.x, engine.world.mouse.y, tier);
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
      case 'PLANET':
        spawnSandboxPlanet(engine, engine.world.mouse.x, engine.world.mouse.y);
        break;
    }
  }


export function spawnSandboxBlackhole(engine: CosmicCanvasEngine, x: number, y: number, tier: SandboxChargeTier): void {
    const activeBHs = engine.world.sandboxBlackholes.filter(bh => !bh.isDying);
    if (activeBHs.length >= 3) {
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


export function spawnSandboxChronoWell(engine: CosmicCanvasEngine, x: number, y: number, tier: SandboxChargeTier): void {
    const activeWells = engine.world.sandboxChronoWells.filter(w => !w.isDying);
    if (activeWells.length >= 3) {
      activeWells[0].isDying = true;
    }

    const maxRadius = tier === 'tap'
      ? Math.random() * 8 + 68
      : tier === 'charged'
      ? Math.random() * 7 + 105
      : Math.random() * 15 + 140;

    const slowFactor = tier === 'tap' ? 0.65 : tier === 'charged' ? 0.35 : 0.15;
    
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
    if (tier === 'tap') {
      spawnNurseryStar(engine, engine.world.mouse.x, engine.world.mouse.y);
      return;
    }

    if (tier === 'charged') {
      const burst = 4;
      for (let i = 0; i < burst; i++) {
        const angle = (Math.PI * 2 * i) / burst;
        spawnNurseryStar(engine, 
          engine.world.mouse.x + Math.cos(angle) * 24,
          engine.world.mouse.y + Math.sin(angle) * 24
        );
      }
      return;
    }

    const burst = 10;
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
    playWormholeTeleportSound();
    return true;
  }


export function applyWormholeForcesToParticle(engine: CosmicCanvasEngine, p: Particle): void {
    if (p.isDying || p.birthProgress < 1.0 || engine.world.wormholes.length !== 2) {
      return;
    }

    const entry = engine.world.wormholes[0];
    const hypergateActive = engine.world.wormholeHypergateTimer > 0;
    
    // Noticeable gravity pull reach and strength
    const entryReach = 240 * (hypergateActive ? 1.8 : 1);
    const dx = entry.x - p.x;
    const dy = entry.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    if (dist < entryReach) {
      const force = (entryReach - dist) / entryReach;
      const pull = (hypergateActive ? 2.8 : 1.4) * force;
      
      // Pull towards the center of the blue wormhole
      p.vx += (dx / dist) * pull;
      p.vy += (dy / dist) * pull;
      
      // Spiraling orbit swirl into the portal
      p.vx += (-dy / dist) * pull * 0.35;
      p.vy += (dx / dist) * pull * 0.35;

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
          p.isNursery = false;
        }
        spawnMiniSupernova(engine, sbh.x, sbh.y, p.colorPrefix);
        playBlackHoleConsumeSound();
      }
    }
  }


export function drawPlanetPreview(engine: CosmicCanvasEngine): void {
  if (!engine.world.isMouseDown || engine.world.mouse.x === -1000) {
    return;
  }
  const previewRadius = Math.min(80, 12 + engine.world.chargeTime * 0.8);
  const ctx = engine.world.ctx;
  const x = engine.world.mouse.x;
  const y = engine.world.mouse.y;

  // Draw atmosphere glow
  ctx.beginPath();
  ctx.arc(x, y, previewRadius + 12, 0, Math.PI * 2);
  const glowGrad = ctx.createRadialGradient(x, y, previewRadius - 4, x, y, previewRadius + 12);
  glowGrad.addColorStop(0, 'rgba(0, 255, 140, 0.4)');
  glowGrad.addColorStop(1, 'rgba(0, 255, 140, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fill();

  // Draw dashed outline
  ctx.beginPath();
  ctx.arc(x, y, previewRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 255, 180, 0.65)';
  ctx.lineWidth = 1.8;
  ctx.setLineDash([5, 8]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw translucent body preview
  ctx.beginPath();
  ctx.arc(x, y, previewRadius, 0, Math.PI * 2);
  const planetGrad = ctx.createRadialGradient(x - previewRadius * 0.3, y - previewRadius * 0.3, previewRadius * 0.1, x, y, previewRadius);
  planetGrad.addColorStop(0, 'rgba(100, 255, 180, 0.55)');
  planetGrad.addColorStop(0.7, 'rgba(20, 160, 120, 0.4)');
  planetGrad.addColorStop(1.0, 'rgba(10, 50, 40, 0.7)');
  ctx.fillStyle = planetGrad;
  ctx.fill();
}

export function spawnSandboxPlanet(engine: CosmicCanvasEngine, x: number, y: number): void {
  const activePlanets = engine.world.sandboxPlanets.filter(p => !p.isDying);
  if (activePlanets.length >= 4) {
    activePlanets[0].isDying = true;
    activePlanets[0].deathTimer = 30;
  }

  const radius = Math.min(80, 12 + engine.world.chargeTime * 0.8);
  const mass = radius * radius * 0.6;

  const themes = [
    {
      name: 'emerald',
      inner: 'rgba(100, 255, 180, 1)',
      mid: 'rgba(20, 180, 120, 1)',
      outer: 'rgba(5, 50, 35, 1)',
      glow: 'rgba(0, 255, 140, 0.45)',
      sparkColor: 'rgba(50, 255, 180,'
    },
    {
      name: 'sapphire',
      inner: 'rgba(120, 200, 255, 1)',
      mid: 'rgba(30, 100, 240, 1)',
      outer: 'rgba(5, 20, 70, 1)',
      glow: 'rgba(0, 150, 255, 0.45)',
      sparkColor: 'rgba(100, 180, 255,'
    },
    {
      name: 'ruby',
      inner: 'rgba(255, 160, 120, 1)',
      mid: 'rgba(230, 60, 40, 1)',
      outer: 'rgba(60, 10, 10, 1)',
      glow: 'rgba(255, 80, 40, 0.45)',
      sparkColor: 'rgba(255, 140, 80,'
    },
    {
      name: 'amethyst',
      inner: 'rgba(230, 160, 255, 1)',
      mid: 'rgba(160, 50, 230, 1)',
      outer: 'rgba(40, 10, 70, 1)',
      glow: 'rgba(200, 80, 255, 0.45)',
      sparkColor: 'rgba(200, 120, 255,'
    }
  ];

  const theme = themes[Math.floor(Math.random() * themes.length)];

  engine.world.sandboxPlanets.push({
    x,
    y,
    radius,
    mass,
    color: JSON.stringify(theme),
    isDying: false,
    deathTimer: 0
  });

  playSupernovaPop();
}

export function shatterPlanet(engine: CosmicCanvasEngine, pl: SandboxPlanet): void {
  if (pl.isDying) return;
  pl.isDying = true;
  pl.deathTimer = 25;

  let theme;
  try {
    theme = JSON.parse(pl.color);
  } catch (e) {
    theme = { sparkColor: 'rgba(0, 255, 140,' };
  }

  const numStars = Math.floor(Math.random() * 5) + 8;
  for (let i = 0; i < numStars; i++) {
    const angle = (Math.PI * 2 * i) / numStars + (Math.random() - 0.5) * 0.25;
    const speed = Math.random() * 3.5 + 2.5;
    
    const sx = pl.x + Math.cos(angle) * (pl.radius * 0.4);
    const sy = pl.y + Math.sin(angle) * (pl.radius * 0.4);
    
    const spawned = spawnStellarBirth(engine, sx, sy, { nursery: true, sprayAngle: angle });
    if (spawned) {
      const p = engine.world.particles[engine.world.particles.length - 1];
      if (p) {
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
      }
    }
  }

  spawnMiniSupernova(engine, pl.x, pl.y, theme.sparkColor || 'rgba(0, 255, 140,');
  playSupernovaPop();
}

export function applySandboxPlanetForces(engine: CosmicCanvasEngine, p: Particle, pl: SandboxPlanet): void {
  if (pl.isDying || pl.radius <= 0) {
    return;
  }

  const dx = pl.x - p.x;
  const dy = pl.y - p.y;
  const distSq = dx * dx + dy * dy;
  const dist = Math.sqrt(distSq) || 1;

  if (dist < pl.radius) {
    const overlap = pl.radius - dist;
    p.x -= (dx / dist) * overlap;
    p.y -= (dy / dist) * overlap;

    const nx = dx / dist;
    const ny = dy / dist;
    const dot = p.vx * nx + p.vy * ny;
    p.vx = (p.vx - 2 * dot * nx) * 0.65;
    p.vy = (p.vy - 2 * dot * ny) * 0.65;
    
    p.vx += (-ny) * 0.2;
    p.vy += (nx) * 0.2;
    return;
  }

  const gravityRange = pl.radius + 250;
  if (dist < gravityRange) {
    const orbitDistance = pl.radius + 45;
    const forceFactor = (gravityRange - dist) / gravityRange;
    
    let pull = 0;
    if (dist > orbitDistance) {
      pull = (pl.mass * 0.3) / (distSq + 200);
    } else {
      const repelStrength = ((orbitDistance - dist) / (orbitDistance - pl.radius)) * 1.5;
      pull = -repelStrength;
    }
    
    p.vx += (dx / dist) * pull * forceFactor;
    p.vy += (dy / dist) * pull * forceFactor;

    const spinSpeed = Math.sqrt(pl.mass * 0.25) * (1 / (dist + 30)) * 2.2 * forceFactor;
    p.vx += (-dy / dist) * spinSpeed;
    p.vy += (dx / dist) * spinSpeed;
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


export function updateAndDrawSandboxElements(engine: CosmicCanvasEngine, width: number, height: number): void {
    const hypergateActive = engine.world.wormholeHypergateTimer > 0;

    // Clean up completely collapsed black holes
    engine.world.sandboxBlackholes = engine.world.sandboxBlackholes.filter(
      sbh => !sbh.isDying || sbh.radius > 0
    );

    // 1. Sandbox Black holes — persistent until CLEAR or replaced
    for (const sbh of engine.world.sandboxBlackholes) {
      if (sbh.isDying) {
        sbh.radius -= sbh.maxRadius / 30; // Collapse to 0 over 30 frames (0.5s)
        if (sbh.radius < 0) {
          sbh.radius = 0;
        }
      } else {
        sbh.timer++;
        if (sbh.timer < 60) {
          sbh.radius = sbh.maxRadius * (sbh.timer / 60);
        } else {
          sbh.radius = sbh.maxRadius;
        }
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
    
    // 1.5. Sandbox Chrono Wells
    engine.world.sandboxChronoWells = engine.world.sandboxChronoWells.filter(
      cw => !cw.isDying || cw.radius > 0
    );

    for (const cw of engine.world.sandboxChronoWells) {
      if (cw.isDying) {
        cw.radius -= cw.maxRadius / 30; // Collapse to 0 over 30 frames (0.5s)
        if (cw.radius < 0) {
          cw.radius = 0;
        }
      } else {
        cw.timer++;
        if (cw.timer < 60) {
          cw.radius = cw.maxRadius * (cw.timer / 60);
        } else {
          cw.radius = cw.maxRadius;
        }
      }

      const pulse = Math.sin(Date.now() / 80 + cw.x) * cw.radius * 0.08;
      const radius = cw.radius + pulse;
      
      // Draw glowing chrono bubble fill
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(cw.x, cw.y, radius, 0, Math.PI * 2);
      const radGrad = engine.world.ctx.createRadialGradient(cw.x, cw.y, 8, cw.x, cw.y, radius);
      radGrad.addColorStop(0, 'rgba(0, 240, 255, 0.04)');
      radGrad.addColorStop(0.8, 'rgba(0, 240, 255, 0.08)');
      radGrad.addColorStop(1.0, `rgba(0, 240, 255, ${0.2 * (cw.radius / cw.maxRadius)})`);
      engine.world.ctx.fillStyle = radGrad;
      engine.world.ctx.fill();
      
      // Draw rotating dashed clock ring
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(cw.x, cw.y, radius, Date.now() / 1500 + cw.x, Date.now() / 1500 + cw.x + Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(0, 240, 255, ${0.45 * (cw.radius / cw.maxRadius)})`;
      engine.world.ctx.lineWidth = 1.5;
      engine.world.ctx.setLineDash([6, 10]);
      engine.world.ctx.stroke();
      engine.world.ctx.setLineDash([]);

      // Draw sweeping clock hand
      const sweepAngle = ((Date.now() / 1000) + cw.x) % (Math.PI * 2);
      engine.world.ctx.beginPath();
      engine.world.ctx.moveTo(cw.x, cw.y);
      engine.world.ctx.lineTo(cw.x + Math.cos(sweepAngle) * radius, cw.y + Math.sin(sweepAngle) * radius);
      engine.world.ctx.strokeStyle = `rgba(0, 240, 255, ${0.22 * (cw.radius / cw.maxRadius)})`;
      engine.world.ctx.lineWidth = 1.5;
      engine.world.ctx.stroke();
    }
    
    // 1.7. Sandbox Planets
    engine.world.sandboxPlanets = engine.world.sandboxPlanets.filter(
      pl => !pl.isDying || (pl.deathTimer !== undefined && pl.deathTimer > 0)
    );

    for (const pl of engine.world.sandboxPlanets) {
      if (pl.isDying) {
        if (pl.deathTimer === undefined) pl.deathTimer = 30;
        pl.deathTimer--;
        pl.radius -= pl.radius / 10;
        if (pl.radius < 0.5) pl.radius = 0;
      }

      const radius = pl.radius;
      if (radius <= 0) continue;

      let theme;
      try {
        theme = JSON.parse(pl.color);
      } catch (e) {
        theme = {
          name: 'emerald',
          inner: 'rgba(100, 255, 180, 1)',
          mid: 'rgba(20, 180, 120, 1)',
          outer: 'rgba(5, 50, 35, 1)',
          glow: 'rgba(0, 255, 140, 0.45)',
          sparkColor: 'rgba(50, 255, 180,'
        };
      }

      // Draw planet atmosphere glow (with safe non-negative radii to prevent Canvas DOM Exceptions)
      const rGlow0 = Math.max(0.1, radius - 4);
      const rGlow1 = Math.max(0.1, radius + 12);
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(pl.x, pl.y, rGlow1, 0, Math.PI * 2);
      const glowGrad = engine.world.ctx.createRadialGradient(pl.x, pl.y, rGlow0, pl.x, pl.y, rGlow1);
      glowGrad.addColorStop(0, theme.glow);
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      engine.world.ctx.fillStyle = glowGrad;
      engine.world.ctx.fill();

      // Draw the planet body (with safe non-negative radii)
      const rBody0 = Math.max(0.1, radius * 0.1);
      const rBody1 = Math.max(0.1, radius);
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(pl.x, pl.y, rBody1, 0, Math.PI * 2);
      const planetGrad = engine.world.ctx.createRadialGradient(pl.x - radius * 0.3, pl.y - radius * 0.3, rBody0, pl.x, pl.y, rBody1);
      planetGrad.addColorStop(0, theme.inner);
      planetGrad.addColorStop(0.65, theme.mid);
      planetGrad.addColorStop(1.0, theme.outer);
      engine.world.ctx.fillStyle = planetGrad;
      engine.world.ctx.fill();

      // Draw thin elegant ring system if it is sapphire or ruby theme
      if (theme.name === 'sapphire' || theme.name === 'ruby') {
        engine.world.ctx.save();
        engine.world.ctx.translate(pl.x, pl.y);
        engine.world.ctx.rotate(-Math.PI / 6);
        engine.world.ctx.scale(1.8, 0.35);
        engine.world.ctx.beginPath();
        engine.world.ctx.arc(0, 0, Math.max(0.1, radius * 1.05), 0, Math.PI * 2);
        engine.world.ctx.strokeStyle = theme.name === 'sapphire' ? 'rgba(120, 200, 255, 0.45)' : 'rgba(255, 160, 120, 0.45)';
        engine.world.ctx.lineWidth = 3.0;
        engine.world.ctx.stroke();
        engine.world.ctx.restore();
      }

      // Draw a subtle orbit gravity range indicator ring (faded dotted line at pl.radius + 250)
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(pl.x, pl.y, radius + 250, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(255, 255, 255, 0.04)`;
      engine.world.ctx.lineWidth = 0.8;
      engine.world.ctx.setLineDash([4, 12]);
      engine.world.ctx.stroke();
      engine.world.ctx.setLineDash([]);
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

    // 4. Chrono Well bubble visual (always active around mouse cursor when selected)
    if (engine.world.activePower === 'TIME_DILATION' && engine.world.mouse.active && engine.world.mouse.x !== -1000) {
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
