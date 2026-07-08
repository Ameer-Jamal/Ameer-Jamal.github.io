import type { CosmicCanvasEngine } from '../cosmic-canvas-engine';
import { SandboxChargeTier } from '../../models/cosmic.types';
import { blastParticlesAway } from '../state-machine';
import { spawnNurseryStar } from '../particle-system';

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
