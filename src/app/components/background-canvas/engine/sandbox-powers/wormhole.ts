import type { CosmicCanvasEngine } from '../cosmic-canvas-engine';
import { Particle, SandboxChargeTier } from '../../models/cosmic.types';
import { spawnStardustPuff } from '../particle-system';
import { playWormholeTeleportSound } from '../audio';

export function tryWormholeCapture(
  engine: CosmicCanvasEngine,
  p: Particle,
  opts?: { forceCapture?: boolean }
): boolean {
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
