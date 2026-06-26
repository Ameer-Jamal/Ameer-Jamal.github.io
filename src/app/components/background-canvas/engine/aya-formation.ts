import { getAyaLetterScale, getWorldLetterTargets } from '../models/aya-constellation';
import type { CosmicCanvasEngine } from './cosmic-canvas-engine';
import { endAyaDance } from './aya-easter-egg';
import { playSupernovaPop, stopBlackholeHum } from './audio';
import { spawnILoveYouMessage, spawnAyaConstellation } from './effects';
import { transitionTo } from './state-machine';

const PINK_COLORS = [
  'rgba(255, 100, 180,',
  'rgba(255, 140, 200,',
  'rgba(255, 120, 160,'
];

const FORMATION_SPRING = 0.14;
const FORMATION_DAMP = 0.8;
const FORMATION_LINK_DIST = 20;

export function beginAyaFormation(engine: CosmicCanvasEngine): void {
  stopBlackholeHum();
  const world = engine.world;
  const scale = getAyaLetterScale(world.canvasWidth, world.canvasHeight);
  const targets = getWorldLetterTargets(world.ayaFormationCenterX, world.ayaFormationCenterY, scale);
  const targetCount = targets.length;

  for (let i = 0; i < world.particles.length; i++) {
    const p = world.particles[i];
    const target = targets[i % targetCount];
    const isExtra = i >= targetCount;
    const jitter = isExtra ? 28 : 0;

    p.formationTx = target.x + (isExtra ? (Math.random() - 0.5) * jitter : 0);
    p.formationTy = target.y + (isExtra ? (Math.random() - 0.5) * jitter : 0);
    p.formationActive = true;
    p.colorPrefix = PINK_COLORS[i % PINK_COLORS.length];
    p.colorBlend = 1;
    p.birthProgress = 1;
    p.isDying = false;
    p.deathProgress = 0;
    p.radius = Math.max(p.baseRadius, 2.4);
  }

  const messageY = world.ayaFormationCenterY + scale * 0.58;
  spawnILoveYouMessage(engine, world.ayaFormationCenterX, messageY, scale * 0.72);
  spawnAyaConstellation(engine, world.ayaFormationCenterX, world.ayaFormationCenterY, scale);

  // Play supernova blast sound
  playSupernovaPop();

  transitionTo(engine, 'AYA_FORMATION');
  // Initially hold AYA_FORMATION for 2.5 seconds during constellation build-up and page explosion
  world.stateTimer = 150;
  world.screenFlash = 16;
}

export function restoreAyaConstellation(engine: CosmicCanvasEngine): void {
  const world = engine.world;
  const scale = getAyaLetterScale(world.canvasWidth, world.canvasHeight);
  const targets = getWorldLetterTargets(world.ayaFormationCenterX, world.ayaFormationCenterY, scale);
  const targetCount = targets.length;

  for (let i = 0; i < world.particles.length; i++) {
    const p = world.particles[i];
    const target = targets[i % targetCount];
    const isExtra = i >= targetCount;
    const jitter = isExtra ? 28 : 0;

    p.formationTx = target.x + (isExtra ? (Math.random() - 0.5) * jitter : 0);
    p.formationTy = target.y + (isExtra ? (Math.random() - 0.5) * jitter : 0);
    p.formationActive = true;
    p.colorPrefix = PINK_COLORS[i % PINK_COLORS.length];
    p.colorBlend = 1;
    p.birthProgress = 1;
    p.isDying = false;
    p.deathProgress = 0;
    p.radius = Math.max(p.baseRadius, 2.4);
  }
}

export function tickAyaFormation(engine: CosmicCanvasEngine): void {
  const world = engine.world;

  if (world.blackoutAlpha > 0.35) {
    world.blackoutAlpha = Math.max(0.35, world.blackoutAlpha - 0.008);
  }

  const time = Date.now() / 1000;

  for (const p of world.particles) {
    if (!p.formationActive || p.formationTx === undefined || p.formationTy === undefined) {
      continue;
    }

    // Add a gentle, organic floating/breathing wobble to keep the particles alive and dynamic when stationary
    const phaseX = (p.formationTx * 0.04) + time * 1.4;
    const phaseY = (p.formationTy * 0.04) + time * 1.1;
    const wobbleX = Math.sin(phaseX) * 1.6;
    const wobbleY = Math.cos(phaseY) * 1.6;

    const targetX = p.formationTx + wobbleX;
    const targetY = p.formationTy + wobbleY;

    const dx = targetX - p.x;
    const dy = targetY - p.y;
    p.vx += dx * FORMATION_SPRING;
    p.vy += dy * FORMATION_SPRING;
    p.vx *= FORMATION_DAMP;
    p.vy *= FORMATION_DAMP;

    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
    const maxSpeed = 8.0;
    if (speed > maxSpeed) {
      p.vx = (p.vx / speed) * maxSpeed;
      p.vy = (p.vy / speed) * maxSpeed;
    }

    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
      p.x += dx * 0.35;
      p.y += dy * 0.35;
    } else {
      p.x += p.vx;
      p.y += p.vy;
    }
  }
}

export function drawFormationLinks(engine: CosmicCanvasEngine): void {
  const ctx = engine.world.ctx;
  const particles = engine.world.particles.filter((p) => p.formationActive);
  const linkDistSq = FORMATION_LINK_DIST * FORMATION_LINK_DIST;

  for (let i = 0; i < particles.length; i++) {
    const p1 = particles[i];
    for (let j = i + 1; j < particles.length; j++) {
      const p2 = particles[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < linkDistSq) {
        const alpha = (1 - Math.sqrt(distSq) / FORMATION_LINK_DIST) * 0.65;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(255, 120, 180, ${alpha})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }
  }
}

export function endAyaFormation(engine: CosmicCanvasEngine): void {
  if ((engine.world as any).isHeartSwarmActive) {
    (engine.world as any).isHeartSwarmActive = false;
    
    if (typeof document !== 'undefined' && document.body.classList.contains('is-aya-message')) {
      restoreAyaConstellation(engine);
      transitionTo(engine, 'AYA_FORMATION');
      engine.world.stateTimer = 999999;
      return;
    }

    // Dissolve the heart swarm back to DRIFT state instead of restoring "AYA"
    for (const p of engine.world.particles) {
      p.formationActive = false;
      p.formationTx = undefined;
      p.formationTy = undefined;
      p.colorBlend = 0.4;
      p.colorPrefix = 'rgba(255, 255, 255,';
      p.vx *= 0.4;
      p.vy *= 0.4;
      p.radius = p.baseRadius;
    }

    engine.world.blackoutAlpha = 0;
    transitionTo(engine, 'DRIFT');
    return;
  }

  // If the 2.5-second initial admire/constellation formation timer finishes:
  if (typeof document !== 'undefined' && document.body.classList.contains('is-aya-message')) {
    // Restore the page UI so the user can interact with the menu
    endAyaDance(engine);

    // Keep the constellation target coordinates active and state locked in AYA_FORMATION
    transitionTo(engine, 'AYA_FORMATION');
    engine.world.stateTimer = 999999;
    return;
  }

  for (const p of engine.world.particles) {
    p.formationActive = false;
    p.formationTx = undefined;
    p.formationTy = undefined;
    p.colorBlend = 0.4;
    p.colorPrefix = 'rgba(255, 255, 255,';
    p.vx *= 0.4;
    p.vy *= 0.4;
    p.radius = p.baseRadius;
  }

  engine.world.blackoutAlpha = 0;
  transitionTo(engine, 'DRIFT');
  endAyaDance(engine);
}
