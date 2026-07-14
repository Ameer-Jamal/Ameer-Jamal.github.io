import type { CosmicCanvasEngine } from '../cosmic-canvas-engine';
import type { Particle, SandboxChargeTier } from '../../models/cosmic.types';
import { blastParticlesAway } from '../state-machine';
import { findNearestParticleIndices } from '../particle-system';
import { getSandboxChargeProgress } from './charge';
import { shatterPlanet } from './planet';

type Point = { x: number; y: number };

interface TeslaConfig {
  maxTargets: number;
  radius: number;
  blast: number;
  chainLimit: number;
  steps: number;
  jitter: number;
  shake: number;
  sparkBurst: number;
  branchChance: number;
  coilNodes: number;
}

const TESLA_CONFIG: Record<SandboxChargeTier, TeslaConfig> = {
  tap: {
    maxTargets: 6,
    radius: 500,
    blast: 14,
    chainLimit: 0,
    steps: 4,
    jitter: 15,
    shake: 4,
    sparkBurst: 6,
    branchChance: 0.2,
    coilNodes: 3
  },
  charged: {
    maxTargets: 10,
    radius: 550,
    blast: 16,
    chainLimit: 5,
    steps: 5,
    jitter: 19,
    shake: 10,
    sparkBurst: 9,
    branchChance: 0.55,
    coilNodes: 5
  },
  super: {
    maxTargets: 25,
    radius: 600,
    blast: 18,
    chainLimit: 16,
    steps: 6,
    jitter: 22,
    shake: 25,
    sparkBurst: 14,
    branchChance: 0.85,
    coilNodes: 7
  }
};

function buildTeslaBoltSegments(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  steps: number,
  jitter: number
): Point[] {
  const segments: Point[] = [];
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;

  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const envelope = Math.sin(t * Math.PI);
    const sidewaysJitter = step === 0 || step === steps
      ? 0
      : (Math.random() - 0.5) * jitter * envelope;
    const travelJitter = step === 0 || step === steps
      ? 0
      : (Math.random() - 0.5) * jitter * 0.28;

    segments.push({
      x: startX + dx * t + normalX * sidewaysJitter + (dx / length) * travelJitter,
      y: startY + dy * t + normalY * sidewaysJitter + (dy / length) * travelJitter
    });
  }

  return segments;
}

function addTeslaBolt(
  engine: CosmicCanvasEngine,
  start: Point,
  end: Point,
  steps: number,
  jitter: number,
  alpha = 1
): Point[] {
  const segments = buildTeslaBoltSegments(start.x, start.y, end.x, end.y, steps, jitter);
  engine.world.lightnings.push({ segments, alpha });
  return segments;
}

function emitTeslaSparks(engine: CosmicCanvasEngine, x: number, y: number, burst: number, ring = false): void {
  const phase = Math.random() * Math.PI * 2;
  for (let i = 0; i < burst; i++) {
    const angle = ring
      ? phase + (i / burst) * Math.PI * 2 + (Math.random() - 0.5) * 0.18
      : Math.random() * Math.PI * 2;
    const speed = Math.random() * 2.8 + 1.2;
    engine.world.sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: Math.random() * 1.7 + 1,
      alpha: 0.9,
      color: i % 3 === 0 ? 'rgba(255, 110, 245,' : i % 2 === 0 ? 'rgba(110, 240, 255,' : 'rgba(255, 255, 255,'
    });
  }
}

function spawnTeslaBranchBolt(
  engine: CosmicCanvasEngine,
  segments: Point[],
  intensity: SandboxChargeTier
): void {
  if (segments.length < 4) {
    return;
  }

  const branchIndex = Math.max(1, Math.floor(segments.length * (0.3 + Math.random() * 0.35)));
  const branchFrom = segments[branchIndex];
  const tip = segments[segments.length - 1];
  const dx = tip.x - branchFrom.x;
  const dy = tip.y - branchFrom.y;
  const length = Math.hypot(dx, dy) || 1;
  const side = Math.random() < 0.5 ? -1 : 1;
  const branchLength = Math.min(length * (intensity === 'super' ? 0.38 : 0.26), intensity === 'super' ? 115 : 72);
  const end = {
    x: branchFrom.x + (dx / length) * branchLength * 0.35 - (dy / length) * branchLength * 0.9 * side,
    y: branchFrom.y + (dy / length) * branchLength * 0.35 + (dx / length) * branchLength * 0.9 * side
  };

  addTeslaBolt(engine, branchFrom, end, 3, intensity === 'super' ? 18 : 12, intensity === 'super' ? 0.68 : 0.52);
}

function spawnTeslaCoilCrown(
  engine: CosmicCanvasEngine,
  center: Point,
  nodeCount: number,
  radius: number,
  intensity: SandboxChargeTier,
  alpha = 0.78
): void {
  const phase = Date.now() / 135 + Math.random() * 0.3;
  const nodes = Array.from({ length: nodeCount }, (_, index) => {
    const angle = phase + (index / nodeCount) * Math.PI * 2;
    const wobble = Math.sin(phase * 1.7 + index * 2.1) * 5;
    return {
      x: center.x + Math.cos(angle) * (radius + wobble),
      y: center.y + Math.sin(angle) * (radius + wobble)
    };
  });

  for (let i = 0; i < nodes.length; i++) {
    const next = nodes[(i + 1) % nodes.length];
    addTeslaBolt(engine, nodes[i], next, 2, intensity === 'super' ? 12 : 8, alpha);
  }

  const spokes = intensity === 'tap' ? 1 : intensity === 'charged' ? 2 : 3;
  for (let i = 0; i < spokes; i++) {
    const node = nodes[(i * 2 + Math.floor(Math.random() * nodes.length)) % nodes.length];
    addTeslaBolt(engine, center, node, 2, 8, alpha * 0.9);
  }
}

function spawnTeslaPulse(engine: CosmicCanvasEngine, intensity: SandboxChargeTier): void {
  if (intensity === 'tap') {
    return;
  }

  const isSuper = intensity === 'super';
  engine.world.shockwaves.push({
    x: engine.world.mouse.x,
    y: engine.world.mouse.y,
    radius: isSuper ? 12 : 8,
    maxRadius: isSuper ? 330 : 210,
    speed: isSuper ? 12 : 9,
    alpha: 1,
    color: '80, 235, 255'
  });
  if (isSuper) {
    engine.world.shockwaves.push({
      x: engine.world.mouse.x,
      y: engine.world.mouse.y,
      radius: 0,
      maxRadius: 285,
      speed: 8,
      alpha: 0.9,
      color: '255, 100, 235'
    });
  }
}

function connectTeslaChain(
  engine: CosmicCanvasEngine,
  struck: Particle[],
  config: TeslaConfig,
  intensity: SandboxChargeTier
): void {
  if (config.chainLimit === 0 || struck.length < 2) {
    return;
  }

  const unvisited = struck.slice(1);
  let current = struck[0];
  let links = 0;

  while (unvisited.length > 0 && links < config.chainLimit) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < unvisited.length; i++) {
      const distance = Math.hypot(unvisited[i].x - current.x, unvisited[i].y - current.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    const next = unvisited.splice(nearestIndex, 1)[0];
    const segments = addTeslaBolt(
      engine,
      current,
      next,
      intensity === 'super' ? 4 : 3,
      intensity === 'super' ? 20 : 14,
      0.88
    );
    if (intensity === 'super' && links % 2 === 0) {
      spawnTeslaBranchBolt(engine, segments, intensity);
    }
    current = next;
    links++;
  }
}

export function triggerTeslaDischargePower(
  engine: CosmicCanvasEngine,
  intensity: SandboxChargeTier = 'tap'
): void {
  const config = TESLA_CONFIG[intensity];
  const center = { x: engine.world.mouse.x, y: engine.world.mouse.y };
  const sorted = engine.world.particles
    .map(particle => ({ particle, distance: Math.hypot(particle.x - center.x, particle.y - center.y) }))
    .filter(({ distance }) => distance < config.radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, config.maxTargets);
  const struck: Particle[] = [];

  spawnTeslaCoilCrown(engine, center, config.coilNodes, intensity === 'super' ? 66 : intensity === 'charged' ? 52 : 38, intensity);

  sorted.forEach(({ particle, distance }, index) => {
    const dx = particle.x - center.x;
    const dy = particle.y - center.y;
    const radialAngle = Math.atan2(dy, dx);
    const pinwheel = intensity === 'tap' ? 0.08 : intensity === 'charged' ? 0.18 : 0.3;
    const spinDirection = index % 2 === 0 ? 1 : -1;
    const angle = radialAngle + pinwheel * spinDirection + (Math.random() - 0.5) * 0.18;
    const distanceScale = 0.82 + Math.min(0.18, distance / config.radius * 0.18);

    particle.vx = Math.cos(angle) * config.blast * distanceScale;
    particle.vy = Math.sin(angle) * config.blast * distanceScale;
    particle.colorBlend = 1;
    struck.push(particle);

    const segments = addTeslaBolt(engine, center, particle, config.steps, config.jitter);
    if (Math.random() < config.branchChance) {
      spawnTeslaBranchBolt(engine, segments, intensity);
    }
    emitTeslaSparks(engine, particle.x, particle.y, config.sparkBurst);
  });

  emitTeslaSparks(engine, center.x, center.y, config.sparkBurst + config.coilNodes, true);

  let planetHits = 0;
  for (const planet of engine.world.sandboxPlanets) {
    if (planet.isDying || Math.hypot(planet.x - center.x, planet.y - center.y) >= config.radius) {
      continue;
    }

    const segments = addTeslaBolt(engine, center, planet, 6, config.jitter + 2);
    if (Math.random() < config.branchChance) {
      spawnTeslaBranchBolt(engine, segments, intensity);
    }
    emitTeslaSparks(engine, planet.x, planet.y, config.sparkBurst + 3, true);
    planetHits++;
    shatterPlanet(engine, planet);
  }

  connectTeslaChain(engine, struck, config, intensity);

  if (struck.length === 0 && planetHits === 0) {
    const missAngle = Math.random() * Math.PI * 2;
    const missLength = intensity === 'super' ? 120 : intensity === 'charged' ? 88 : 62;
    const end = {
      x: center.x + Math.cos(missAngle) * missLength,
      y: center.y + Math.sin(missAngle) * missLength
    };
    const segments = addTeslaBolt(engine, center, end, 4, 15, 0.8);
    spawnTeslaBranchBolt(engine, segments, intensity);
    emitTeslaSparks(engine, end.x, end.y, Math.ceil(config.sparkBurst / 2));
  }

  spawnTeslaPulse(engine, intensity);
  engine.world.shakeTimer = Math.max(engine.world.shakeTimer, config.shake);
  if (intensity === 'super') {
    engine.world.screenFlash = 8;
    blastParticlesAway(engine, center.x, center.y, 18);
  } else if (intensity === 'charged') {
    engine.world.screenFlash = Math.max(engine.world.screenFlash, 3);
  }
}

export function tickTeslaHoldZaps(engine: CosmicCanvasEngine): void {
  if (!engine.world.isMouseDown || engine.world.activePower !== 'TESLA_DISCHARGE' || engine.world.mouse.x === -1000) {
    return;
  }

  engine.world.teslaHoldZapTimer++;
  const charge = getSandboxChargeProgress(engine);
  const cadence = charge > 0.8 ? 4 : charge > 0.35 ? 6 : 8;
  if (engine.world.teslaHoldZapTimer % cadence !== 0) {
    return;
  }

  const center = { x: engine.world.mouse.x, y: engine.world.mouse.y };
  const holdTier: SandboxChargeTier = charge >= 1 ? 'super' : charge >= 0.2 ? 'charged' : 'tap';
  const nodeCount = charge >= 0.8 ? 5 : charge >= 0.35 ? 4 : 3;
  spawnTeslaCoilCrown(engine, center, nodeCount, 27 + charge * 34, holdTier, 0.48 + charge * 0.24);

  for (const planet of engine.world.sandboxPlanets) {
    if (planet.isDying || Math.hypot(planet.x - center.x, planet.y - center.y) >= 420 || Math.random() >= 0.22) {
      continue;
    }

    addTeslaBolt(engine, center, planet, 4, 14 + charge * 8, 0.85);
    emitTeslaSparks(engine, planet.x, planet.y, 4);
    shatterPlanet(engine, planet);
  }

  const zapCount = Math.max(1, Math.floor((2 + Math.floor(charge * 3)) * engine.world.performanceProfile.effectScale));
  const zapIndices = findNearestParticleIndices(engine, center.x, center.y, zapCount, 420);

  for (const index of zapIndices) {
    const particle = engine.world.particles[index];
    if (!particle) {
      continue;
    }

    const angle = Math.atan2(particle.y - center.y, particle.x - center.x) + (Math.random() - 0.5) * 0.35;
    particle.vx += Math.cos(angle) * (4 + charge * 2.5);
    particle.vy += Math.sin(angle) * (4 + charge * 2.5);
    particle.colorBlend = Math.max(particle.colorBlend, 0.75 + charge * 0.25);

    const segments = addTeslaBolt(engine, center, particle, 3 + Math.floor(charge * 2), 12 + charge * 8, 0.72 + charge * 0.18);
    if (charge > 0.65 && Math.random() < 0.35) {
      spawnTeslaBranchBolt(engine, segments, holdTier);
    }
  }

  if (engine.world.teslaHoldZapTimer % (cadence * 2) === 0) {
    emitTeslaSparks(engine, center.x, center.y, 3 + Math.floor(charge * 5), true);
  }
}
