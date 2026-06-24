import {
  downgradeTier,
  getProfileForTier,
  PerformanceTier,
  resolvePerformanceProfile,
  upgradeTier
} from '../../../utils/performance-profile';
import { CONSTELLATION_TEMPLATES } from '../models/constellation-templates';
import { ILOVEYOU_CONSTELLATION } from '../models/aya-constellation';
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

import { getLensedCoords } from './background-layers';

export function drawMiniChargeArc(engine: CosmicCanvasEngine, x1: number, y1: number, x2: number, y2: number): void {
    const segments = 3;
    engine.world.ctx.beginPath();
    engine.world.ctx.moveTo(x1, y1);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const baseOffset = 8;
      const ox = (Math.random() - 0.5) * baseOffset;
      const oy = (Math.random() - 0.5) * baseOffset;
      engine.world.ctx.lineTo(x1 + (x2 - x1) * t + ox, y1 + (y2 - y1) * t + oy);
    }
    engine.world.ctx.lineTo(x2, y2);
    engine.world.ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    engine.world.ctx.lineWidth = 0.9;
    engine.world.ctx.stroke();
  }


export function spawnEasterEggConstellation(engine: CosmicCanvasEngine, x: number, y: number): void {
    const template = CONSTELLATION_TEMPLATES[Math.floor(Math.random() * CONSTELLATION_TEMPLATES.length)];
    engine.world.easterEggs.push({
      x,
      y,
      scale: Math.random() * 50 + 95, // 95px to 145px
      alpha: 1.0,
      points: template.points,
      connections: template.connections
    });
  }


const ILOVEYOU_HOLD_FADE = 0.00165;

export function spawnILoveYouMessage(
  engine: CosmicCanvasEngine,
  x: number,
  y: number,
  scale: number
): void {
  engine.world.easterEggs.push({
    x,
    y,
    scale,
    alpha: 1,
    points: ILOVEYOU_CONSTELLATION.points,
    connections: ILOVEYOU_CONSTELLATION.connections,
    fadeRate: ILOVEYOU_HOLD_FADE,
    palette: 'pink'
  });
}


export function drawEasterEggs(engine: CosmicCanvasEngine): void {
    for (let i = engine.world.easterEggs.length - 1; i >= 0; i--) {
      const egg = engine.world.easterEggs[i];
      const fadeRate = egg.fadeRate ?? 0.0035;
      egg.alpha -= fadeRate;

      if (egg.alpha <= 0) {
        engine.world.easterEggs.splice(i, 1);
        continue;
      }

      const isPink = egg.palette === 'pink';
      const isWarm = egg.palette === 'warm' || isPink;
      const lineColor = isPink ? '255, 120, 180' : isWarm ? '255, 160, 120' : '0, 240, 255';
      const haloColor = isPink ? '255, 80, 160' : isWarm ? '255, 120, 160' : '255, 100, 230';

      // Draw connections
      engine.world.ctx.beginPath();
      for (const conn of egg.connections) {
        const p1 = egg.points[conn[0]];
        const p2 = egg.points[conn[1]];
        
        const pt1 = getLensedCoords(engine, egg.x + p1.x * egg.scale, egg.y + p1.y * egg.scale);
        const pt2 = getLensedCoords(engine, egg.x + p2.x * egg.scale, egg.y + p2.y * egg.scale);

        engine.world.ctx.moveTo(pt1.x, pt1.y);
        engine.world.ctx.lineTo(pt2.x, pt2.y);
      }
      
      engine.world.ctx.strokeStyle = `rgba(${lineColor}, ${egg.alpha * (isPink ? 0.72 : isWarm ? 0.55 : 0.28)})`;
      engine.world.ctx.lineWidth = isPink ? 1.8 : isWarm ? 1.4 : 0.9;
      engine.world.ctx.stroke();

      // Draw constellation nodes
      for (const p of egg.points) {
        const pt = getLensedCoords(engine, egg.x + p.x * egg.scale, egg.y + p.y * egg.scale);

        const coreRadius = isPink ? 2.8 : isWarm ? 2.6 : 1.8;
        const haloRadius = isPink ? 8 : isWarm ? 7.5 : 4.5;

        // Core star
        engine.world.ctx.beginPath();
        engine.world.ctx.arc(pt.x, pt.y, coreRadius, 0, Math.PI * 2);
        engine.world.ctx.fillStyle = `rgba(255, 255, 255, ${egg.alpha * 0.95})`;
        engine.world.ctx.fill();

        // Outer glow halo
        engine.world.ctx.beginPath();
        engine.world.ctx.arc(pt.x, pt.y, haloRadius, 0, Math.PI * 2);
        engine.world.ctx.fillStyle = `rgba(${haloColor}, ${egg.alpha * (isWarm ? 0.5 : 0.35)})`;
        engine.world.ctx.fill();
      }
    }
  }

