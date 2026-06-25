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

import { tickFpsGovernor } from './fps-governor';
import { draw } from './draw-frame';

export function spawnStellarBirth(engine: CosmicCanvasEngine, x: number, y: number, options?: { nursery?: boolean; sprayAngle?: number }): boolean {
    const isNursery = options?.nursery === true;

    if (isNursery) {
      if (engine.world.nurseryStarCount >= getMaxNurseryStars(engine.world)) {
        // Recycle the oldest active nursery star to keep producing stars on hold
        const oldestNursery = engine.world.particles.find(p => p.isNursery && !p.isDying);
        if (oldestNursery) {
          oldestNursery.isDying = true;
          engine.world.nurseryStarCount = Math.max(0, engine.world.nurseryStarCount - 1);
          oldestNursery.isNursery = false;
        } else {
          return false;
        }
      }
    } else if (engine.world.particles.length >= getMaxParticles(engine.world) + 15) {
      return false;
    }

    const angle = options?.sprayAngle ?? Math.random() * Math.PI * 2;
    const speed = isNursery
      ? Math.random() * 3.5 + 1.5
      : Math.random() * 2.5 + 1.0;
    const baseRadius = Math.random() * 2.0 + 1.6;

    const colors = [
      'rgba(0, 240, 255,',
      'rgba(0, 240, 255,',
      'rgba(0, 240, 255,',
      'rgba(230, 100, 255,',
      'rgba(100, 180, 255,'
    ];
    const colorPrefix = isNursery || Math.random() < 0.12
      ? colors[Math.floor(Math.random() * colors.length)]
      : 'rgba(255, 255, 255,';
    const flockable = Math.random() < (isNursery ? 0.35 : 0.22);

    engine.world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      baseVx: Math.cos(angle) * 0.4,
      baseVy: Math.sin(angle) * 0.4,
      radius: baseRadius,
      baseRadius,
      colorBlend: isNursery ? 0.35 : 0.0,
      wobbleTimer: 0,
      colorPrefix,
      flockable,
      life: 1.0,
      birthProgress: isNursery ? 0.65 : 0.0,
      deathProgress: 0.0,
      isDying: false,
      behaviorState: 'CRUISE',
      behaviorTimer: Math.floor(Math.random() * 120) + 120,
      speedFactor: 1.0,
      isNursery
    });

    if (isNursery) {
      engine.world.nurseryStarCount++;
      spawnStardustPuff(engine, x, y, colorPrefix);
    }

    return true;
  }


export function spawnNurseryStar(engine: CosmicCanvasEngine, x: number, y: number): void {
    const sprayAngle = Math.random() * Math.PI * 2;
    const offset = Math.random() * 14;
    spawnStellarBirth(engine, 
      x + Math.cos(sprayAngle) * offset,
      y + Math.sin(sprayAngle) * offset,
      { nursery: true, sprayAngle }
    );
  }


export function spawnStardustPuff(engine: CosmicCanvasEngine, x: number, y: number, colorPrefix: string): void {
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 0.8 + 0.3;
      engine.world.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 1.5 + 0.8,
        alpha: 1.0,
        color: colorPrefix
      });
    }
  }


export function spawnMiniSupernova(engine: CosmicCanvasEngine, x: number, y: number, colorPrefix: string): void {
    const parts = colorPrefix.replace('rgba(', '').replace(')', '').split(',');
    const rgbStr = `${parts[0].trim()}, ${parts[1].trim()}, ${parts[2].trim()}`;

    engine.world.shockwaves.push({
      x,
      y,
      radius: 0,
      maxRadius: 75,
      speed: 2.2,
      alpha: 1.0,
      color: rgbStr
    });

    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2.0 + 0.8;
      engine.world.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 2.2 + 0.8,
        alpha: 1.0,
        color: colorPrefix
      });
    }
  }


export function initParticles(engine: CosmicCanvasEngine): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const area = width * height;
    
    const targetCount = Math.min(getMaxParticles(engine.world), Math.floor(area / COSMIC_CONSTANTS.PARTICLE_DENSITY));
    const count = Math.max(35, targetCount);

    const colors = [
      'rgba(0, 240, 255,',   // Neon Cyan
      'rgba(0, 240, 255,',   // Neon Cyan (duplicate to prioritize cyan)
      'rgba(0, 240, 255,',   // Neon Cyan
      'rgba(230, 100, 255,', // Nebula Magenta
      'rgba(100, 180, 255,'  // Space Blue
    ];

    engine.world.particles = [];
    for (let i = 0; i < count; i++) {
      const baseRadius = Math.random() * 2.0 + 1.6;
      const baseVx = (Math.random() - 0.5) * 0.45;
      const baseVy = (Math.random() - 0.5) * 0.45;
      const colorPrefix = Math.random() < 0.12
        ? colors[Math.floor(Math.random() * colors.length)]
        : 'rgba(255, 255, 255,';
      const flockable = Math.random() < 0.22; // Only 22% group up

      engine.world.particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: baseVx,
        vy: baseVy,
        baseVx,
        baseVy,
        radius: baseRadius,
        baseRadius,
        colorBlend: 0.0,
        wobbleTimer: 0,
        colorPrefix,
        flockable,
        life: Math.random() * 0.6 + 0.4,
        birthProgress: 1.0,
        deathProgress: 0.0,
        isDying: false,
        behaviorState: Math.random() < 0.6 ? 'CRUISE' : (Math.random() < 0.5 ? 'DECELERATE' : 'BURST'),
        behaviorTimer: Math.floor(Math.random() * 120) + 60,
        speedFactor: 1.0
      });
    }
  }


/**
 * Gently reconcile the live particle count with the current tier's cap WITHOUT wiping the scene.
 * Excess stars fade out via the normal death animation; deficits are filled with a few births.
 * Used for FPS-governor tier changes so the field never visibly "resets".
 */
export function adjustParticlePopulation(engine: CosmicCanvasEngine): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const area = width * height;

    const targetCount = Math.min(getMaxParticles(engine.world), Math.floor(area / COSMIC_CONSTANTS.PARTICLE_DENSITY));
    const target = Math.max(35, targetCount);
    const current = engine.world.particles.length;

    if (current > target) {
      const excess = current - target;
      let marked = 0;
      for (let i = current - 1; i >= 0 && marked < excess; i--) {
        const p = engine.world.particles[i];
        if (p && !p.isDying && p.orbitAngle === undefined && !p.formationActive) {
          p.isDying = true;
          marked++;
        }
      }
    } else if (current < target) {
      const deficit = Math.min(target - current, 40);
      for (let i = 0; i < deficit; i++) {
        spawnStellarBirth(engine, Math.random() * width, Math.random() * height);
      }
    }
  }


export function isIntenseParticleMesh(engine: CosmicCanvasEngine): boolean {
    return engine.world.state === 'MOON_DANCE'
      || engine.world.state === 'AYA_FORMATION'
      || engine.world.state === 'LOADING'
      || engine.world.sandboxBlackholes.length > 0
      || engine.world.wormholes.length > 0
      || (engine.world.isSandboxOpen && engine.world.activePower !== 'DEFAULT');
  }


export function findRandomNearbyParticle(engine: CosmicCanvasEngine, cx: number, cy: number, maxDist: number): Particle | null {
    const maxDistSq = maxDist * maxDist;
    const len = engine.world.particles.length;
    if (len === 0) {
      return null;
    }

    const scanCount = Math.min(12, len);
    const start = Math.floor(Math.random() * len);
    let best: Particle | null = null;
    let bestDistSq = maxDistSq;

    for (let n = 0; n < scanCount; n++) {
      const p = engine.world.particles[(start + n) % len];
      const dx = p.x - cx;
      const dy = p.y - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = p;
      }
    }

    return best;
  }


export function findNearestParticleIndices(engine: CosmicCanvasEngine, cx: number, cy: number, count: number, maxDist: number): number[] {
    const maxDistSq = maxDist * maxDist;
    const nearest: { idx: number; distSq: number }[] = [];

    for (let i = 0; i < engine.world.particles.length; i++) {
      const p = engine.world.particles[i];
      const dx = p.x - cx;
      const dy = p.y - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq > maxDistSq) {
        continue;
      }

      if (nearest.length < count) {
        nearest.push({ idx: i, distSq });
        if (nearest.length === count) {
          nearest.sort((a, b) => a.distSq - b.distSq);
        }
      } else if (distSq < nearest[nearest.length - 1].distSq) {
        nearest[nearest.length - 1] = { idx: i, distSq };
        nearest.sort((a, b) => a.distSq - b.distSq);
      }
    }

    return nearest.map(entry => entry.idx);
  }

