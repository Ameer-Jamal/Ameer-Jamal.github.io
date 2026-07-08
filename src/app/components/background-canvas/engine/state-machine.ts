import { COSMIC_CONSTANTS } from '../models/cosmic.constants';
import {
  GameState,
} from '../models/cosmic.types';
import type { CosmicCanvasEngine } from './cosmic-canvas-engine';

import { spawnStellarBirth } from './particle-system';
import { spawnEasterEggConstellation } from './effects';
import { tryWormholeCapture } from './sandbox-powers';

export function isSandboxPowerEngaged(engine: CosmicCanvasEngine): boolean {
    return engine.world.activePower !== 'DEFAULT' && engine.world.isMouseDown;
  }

  /** True while a sandbox power may apply its field physics (hold or brief post-release buffer). */

export function isSandboxPowerChannelActive(engine: CosmicCanvasEngine): boolean {
    return engine.world.activePower !== 'DEFAULT' && (engine.world.isMouseDown || engine.world.mouseGravityPauseTimer > 0);
  }


export function isMouseGravityPaused(engine: CosmicCanvasEngine): boolean {
    return isSandboxPowerEngaged(engine) || engine.world.mouseGravityPauseTimer > 0;
  }


export function isMouseGravityActive(engine: CosmicCanvasEngine): boolean {
    return !isMouseGravityPaused(engine);
  }


export function pauseMouseGravity(engine: CosmicCanvasEngine, frames: number = COSMIC_CONSTANTS.MOUSE_GRAVITY_PAUSE_FRAMES): void {
    engine.world.mouseGravityPauseTimer = Math.max(engine.world.mouseGravityPauseTimer, frames);
  }

  /** Nova Strike-only CHARGING / shockwave mode. */

export function usesDefaultMouseGravity(engine: CosmicCanvasEngine): boolean {
    return engine.world.activePower === 'DEFAULT';
  }


export function transitionTo(engine: CosmicCanvasEngine, newState: GameState): void {
    engine.world.state = newState;
    (engine.world as any).lastStateTickTime = typeof performance === 'undefined' ? Date.now() : performance.now();

    if (newState === 'EXPLODING') {
      engine.world.stateTimer = 40; // Cooldown frames
    } else if (newState === 'SINGULARITY') {
      engine.world.stateTimer = 25; // Vortex Implosion timer
    } else if (newState === 'MOON_DANCE') {
      engine.world.stateTimer = 390; // Moon dance build-up (300f / 5s) + hyper-collapse (90f / 1.5s)
    } else if (newState === 'AYA_FORMATION') {
      engine.world.stateTimer = 240; // ~4s: form, admire, then hand back control
    } else if (newState === 'LOADING') {
      engine.world.stateTimer = 0;
    } else if (newState === 'DRIFT') {
      engine.world.flockEasingFactor = 0.0;
    }
  }


export function triggerRandomStopAction(engine: CosmicCanvasEngine): void {
    if (engine.world.activePower !== 'DEFAULT' || engine.world.isMouseDown) {
      return;
    }

    if (engine.world.mouse.x === -1000) {
      transitionTo(engine, 'DRIFT');
      return;
    }

    const eventTypes: ('supernova' | 'blackhole' | 'lightning' | 'nebula')[] = [
      'supernova',
      'blackhole',
      'lightning',
      'nebula'
    ];
    const chosen = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    if (chosen === 'blackhole') {
      engine.world.singularity.x = engine.world.mouse.x !== -1000 ? engine.world.mouse.x : window.innerWidth / 2;
      engine.world.singularity.y = engine.world.mouse.y !== -1000 ? engine.world.mouse.y : window.innerHeight / 2;
      engine.world.singularity.active = true;
      transitionTo(engine, 'SINGULARITY');
    } else {
      transitionTo(engine, 'EXPLODING');

      if (chosen === 'supernova') {
        triggerSupernovaBurst(engine);
      } else if (chosen === 'lightning') {
        triggerTeslaDischarge(engine);
      } else if (chosen === 'nebula') {
        triggerNebulaWave(engine);
      }
    }
  }

  // --- CLICK SHOCKWAVE ---

export function triggerNormalClickShockwave(engine: CosmicCanvasEngine): void {
    if (engine.world.shockwaves.length > 2) {
      engine.world.shockwaves.shift();
    }
    engine.world.shockwaves.push({
      x: engine.world.mouse.x,
      y: engine.world.mouse.y,
      radius: 0,
      maxRadius: 280,
      speed: 7.5,
      alpha: 1.0,
      color: '0, 240, 255'
    });

    spawnStellarBirth(engine, engine.world.mouse.x, engine.world.mouse.y);
  }

  // --- SUPER MOVE EXPLOSION ---

export function triggerSuperMoveExplosion(engine: CosmicCanvasEngine): void {
    transitionTo(engine, 'EXPLODING');
    engine.world.stateTimer = 75;
    engine.world.shakeTimer = 30; // 30 frames screen shake

    // Blast all particles away with massive kinetic power and scatter angles
    blastParticlesAway(engine, engine.world.mouse.x, engine.world.mouse.y, 25.0);

    // Cyan, Magenta, Space Blue Rings
    engine.world.shockwaves.push({ x: engine.world.mouse.x, y: engine.world.mouse.y, radius: 0, maxRadius: 380, speed: 9.0, alpha: 1.0, color: '0, 240, 255' });
    engine.world.shockwaves.push({ x: engine.world.mouse.x, y: engine.world.mouse.y, radius: 0, maxRadius: 350, speed: 7.5, alpha: 0.95, color: '255, 100, 230' });
    engine.world.shockwaves.push({ x: engine.world.mouse.x, y: engine.world.mouse.y, radius: 0, maxRadius: 320, speed: 6.0, alpha: 0.85, color: '100, 180, 255' });

    for (let k = 0; k < 55; k++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 7.5 + 3.0;
      engine.world.sparks.push({
        x: engine.world.mouse.x,
        y: engine.world.mouse.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 2.4 + 1.4,
        alpha: 1.0,
        color: k % 3 === 0 ? 'rgba(0, 240, 255,' : k % 3 === 1 ? 'rgba(255, 100, 230,' : 'rgba(100, 180, 255,'
      });
    }

    // Stellar genesis: Super Move births 3 young stars shooting off
    for (let i = 0; i < 3; i++) {
      spawnStellarBirth(engine, engine.world.mouse.x, engine.world.mouse.y);
    }

    // Spawn a beautiful constellation easter egg at the mouse position!
    spawnEasterEggConstellation(engine, engine.world.mouse.x, engine.world.mouse.y);
  }

  // --- STOP EVENTS ---

export function triggerSupernovaBurst(engine: CosmicCanvasEngine): void {
    blastParticlesAway(engine, engine.world.mouse.x, engine.world.mouse.y, 14.0);

    engine.world.shockwaves.push({ x: engine.world.mouse.x, y: engine.world.mouse.y, radius: 0, maxRadius: 280, speed: 8.0, alpha: 1.0, color: '0, 230, 255' });

    for (let k = 0; k < 35; k++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5.0 + 2.0;
      engine.world.sparks.push({
        x: engine.world.mouse.x,
        y: engine.world.mouse.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 2.0 + 1.2,
        alpha: 1.0,
        color: Math.random() > 0.5 ? 'rgba(0, 240, 255,' : 'rgba(230, 100, 255,'
      });
    }
  }


export function triggerTeslaDischarge(engine: CosmicCanvasEngine): void {
    const sorted = [...engine.world.particles]
      .map(p => {
        const dx = p.x - engine.world.mouse.x;
        const dy = p.y - engine.world.mouse.y;
        return { particle: p, dist: Math.sqrt(dx * dx + dy * dy) };
      })
      .sort((a, b) => a.dist - b.dist);

    const targetCount = Math.min(5, sorted.length);
    for (let i = 0; i < targetCount; i++) {
      const p = sorted[i].particle;
      const dx = p.x - engine.world.mouse.x;
      const dy = p.y - engine.world.mouse.y;
      const dist = sorted[i].dist || 1;

      // Electric kick with chaotic deflection angle and speed
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.8;
      const speed = 12.0 * (Math.random() * 0.4 + 0.8);
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.colorBlend = 1.0;

      const segments: { x: number; y: number }[] = [];
      const steps = 4;
      const cx = engine.world.mouse.x;
      const cy = engine.world.mouse.y;

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const baseOffset = 18;
        const ox = (s === 0 || s === steps) ? 0 : (Math.random() - 0.5) * baseOffset;
        const oy = (s === 0 || s === steps) ? 0 : (Math.random() - 0.5) * baseOffset;
        segments.push({ x: cx + (p.x - cx) * t + ox, y: cy + (p.y - cy) * t + oy });
      }
      engine.world.lightnings.push({ segments, alpha: 1.0 });
    }
  }


export function triggerNebulaWave(engine: CosmicCanvasEngine): void {
    engine.world.shockwaves.push({ x: engine.world.mouse.x, y: engine.world.mouse.y, radius: 0, maxRadius: 300, speed: 7.0, alpha: 1.0, color: '0, 240, 255' });
    engine.world.shockwaves.push({ x: engine.world.mouse.x, y: engine.world.mouse.y, radius: 0, maxRadius: 280, speed: 6.0, alpha: 0.9, color: '255, 100, 230' });

    for (const p of engine.world.particles) {
      const dx = p.x - engine.world.mouse.x;
      const dy = p.y - engine.world.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 260) {
        p.wobbleTimer = 45;
      }
    }
  }


export function blastParticlesAway(engine: CosmicCanvasEngine, x: number, y: number, multiplier: number): void {
    for (const p of engine.world.particles) {
      const dx = p.x - x;
      const dy = p.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      if (dist < COSMIC_CONSTANTS.EXPLOSION_RADIUS) {
        const force = (COSMIC_CONSTANTS.EXPLOSION_RADIUS - dist) / COSMIC_CONSTANTS.EXPLOSION_RADIUS;

        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 3.6;
        const speed = force * multiplier * (Math.random() * 1.5 + 0.3);

        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.colorBlend = 1.0;

        if (Math.random() < 0.50) {
          p.wobbleTimer = Math.floor(Math.random() * 45) + 20;
        }

        tryWormholeCapture(engine, p, { forceCapture: true });
      }
    }
  }

  // --- STELLAR NURSERY & LIFE CYCLE SYSTEM ---
