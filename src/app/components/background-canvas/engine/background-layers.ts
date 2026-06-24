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

import { isSandboxPowerChannelActive } from './state-machine';

export function resizeCanvas(engine: CosmicCanvasEngine): void {
    const canvas = engine.world.canvas;
    const dprCap = engine.world.performanceProfile?.dprCap ?? 2;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    
    // Size physical resolution to match canvas layout bounds precisely
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    engine.world.ctx.scale(dpr, dpr);
    engine.world.canvasWidth = width;
    engine.world.canvasHeight = height;
  }


export function initNebulas(engine: CosmicCanvasEngine): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // Generate 5 colorful drifting nebulas in the background with detailed base colors and opacities
    engine.world.nebulas = [
      { x: width * 0.25, y: height * 0.35, baseX: width * 0.25, baseY: height * 0.35, radius: Math.min(width, height) * 0.60, colorBase: '0, 80, 255', maxOpacity: 0.05, phase: Math.random() * 100, scalePhase: Math.random() * 100 },
      { x: width * 0.75, y: height * 0.65, baseX: width * 0.75, baseY: height * 0.65, radius: Math.min(width, height) * 0.65, colorBase: '160, 40, 240', maxOpacity: 0.04, phase: Math.random() * 100, scalePhase: Math.random() * 100 },
      { x: width * 0.50, y: height * 0.15, baseX: width * 0.50, baseY: height * 0.15, radius: Math.min(width, height) * 0.50, colorBase: '0, 150, 200', maxOpacity: 0.03, phase: Math.random() * 100, scalePhase: Math.random() * 100 },
      { x: width * 0.85, y: height * 0.25, baseX: width * 0.85, baseY: height * 0.25, radius: Math.min(width, height) * 0.55, colorBase: '255, 80, 0', maxOpacity: 0.015, phase: Math.random() * 100, scalePhase: Math.random() * 100 },
      { x: width * 0.15, y: height * 0.80, baseX: width * 0.15, baseY: height * 0.80, radius: Math.min(width, height) * 0.45, colorBase: '255, 50, 150', maxOpacity: 0.02, phase: Math.random() * 100, scalePhase: Math.random() * 100 }
    ];
  }


export function initStars(engine: CosmicCanvasEngine): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const area = width * height;
    const starCount = Math.floor(area / engine.world.performanceProfile.backgroundStarDivisor); 

    const colorTints = [
      'rgba(255, 255, 255,',
      'rgba(220, 240, 255,',
      'rgba(255, 250, 210,',
      'rgba(240, 210, 255,'
    ];

    engine.world.backgroundStars = [];
    for (let i = 0; i < starCount; i++) {
      const isPulsar = Math.random() < 0.07; // 7% of stars are deep supergiants/pulsars
      let pulsarColor = 'rgba(0, 240, 255,';
      if (isPulsar) {
        const rand = Math.random();
        if (rand < 0.4) {
          pulsarColor = 'rgba(0, 240, 255,'; // cyan supergiant
        } else if (rand < 0.7) {
          pulsarColor = 'rgba(255, 80, 80,'; // red giant
        } else {
          pulsarColor = 'rgba(230, 100, 255,'; // magenta supergiant
        }
      }

      engine.world.backgroundStars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: isPulsar ? Math.random() * 1.5 + 1.2 : Math.random() * 1.0 + 0.3,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.016 + 0.005,
        color: isPulsar ? pulsarColor : colorTints[Math.floor(Math.random() * colorTints.length)],
        isPulsar,
        pulsarPhase: Math.random() * Math.PI * 2
      });
    }

    // Initialize parallax space dust (sweeping cosmic breeze)
    const dustCount = Math.floor(area / engine.world.performanceProfile.dustDivisor);
    engine.world.spaceDust = [];
    for (let i = 0; i < dustCount; i++) {
      engine.world.spaceDust.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: -0.06 - Math.random() * 0.08,
        vy: 0.02 + Math.random() * 0.04,
        radius: Math.random() * 1.6 + 0.7,
        opacity: Math.random() * 0.16 + 0.04
      });
    }
  }


export function initGalaxies(engine: CosmicCanvasEngine): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    const galaxyMult = engine.world.performanceProfile.galaxyStarMultiplier;
    const scaleGalaxyStars = (base: number) => Math.max(20, Math.floor(base * galaxyMult));

    engine.world.backgroundGalaxies = [
      {
        x: width * 0.20,
        y: height * 0.28,
        size: Math.min(width, height) * 0.38,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: 0.00025,
        color: '140, 90, 255', // violet galaxy
        arms: 2,
        starCount: scaleGalaxyStars(180),
        seed: Math.random() * 1000
      },
      {
        x: width * 0.80,
        y: height * 0.70,
        size: Math.min(width, height) * 0.44,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: -0.00018,
        color: '0, 190, 255', // cyan galaxy
        arms: 3,
        starCount: scaleGalaxyStars(240),
        seed: Math.random() * 1000
      },
      {
        x: width * 0.60,
        y: height * 0.82,
        size: Math.min(width, height) * 0.26,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: 0.00035,
        color: '255, 130, 0', // space orange galaxy
        arms: 2,
        starCount: scaleGalaxyStars(120),
        seed: Math.random() * 1000
      }
    ];
  }


export function drawGalaxy(engine: CosmicCanvasEngine, g: BackgroundGalaxy): void {
    // Core glow (radial gradient)
    const lensedCore = getLensedCoords(engine, g.x, g.y);
    const coreGrad = engine.world.ctx.createRadialGradient(lensedCore.x, lensedCore.y, 0, lensedCore.x, lensedCore.y, g.size * 0.35);
    coreGrad.addColorStop(0, `rgba(${g.color}, 0.08)`);
    coreGrad.addColorStop(0.4, `rgba(${g.color}, 0.035)`);
    coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    engine.world.ctx.fillStyle = coreGrad;
    engine.world.ctx.beginPath();
    engine.world.ctx.arc(lensedCore.x, lensedCore.y, g.size * 0.35, 0, Math.PI * 2);
    engine.world.ctx.fill();

    // Spiral arms of tiny stars (single batched path)
    engine.world.ctx.fillStyle = `rgba(${g.color}, 0.28)`;
    engine.world.ctx.beginPath();
    for (let i = 0; i < g.starCount; i++) {
      // Deterministic offset calculations based on indices so they don't flicker
      const t = i / g.starCount; // normalized radius offset
      const armIndex = i % g.arms;
      const armAngle = (armIndex * (Math.PI * 2)) / g.arms;
      
      // Logarithmic spiral approximation: angle shifts proportional to distance
      const theta = t * Math.PI * 2.8 + armAngle + g.rotation;
      const r = t * g.size * 0.5;
      
      // Fluffy stellar distribution: add deterministic wave dispersion
      const noiseSeed = i * 23.456 + g.seed;
      const dispersion = g.size * 0.075 * (Math.sin(noiseSeed) * 0.5);
      const dispAngle = noiseSeed * 1.5;
      
      const rawX = g.x + Math.cos(theta) * r + Math.cos(dispAngle) * dispersion;
      const rawY = g.y + Math.sin(theta) * r + Math.sin(dispAngle) * dispersion;
      
      const pt = getLensedCoords(engine, rawX, rawY);
      
      // Star dimensions shrink outward
      const radius = (1.0 - t) * 1.1 + 0.35;

      engine.world.ctx.moveTo(pt.x + radius, pt.y);
      engine.world.ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    }
    engine.world.ctx.fill();
  }


export function updateAndDrawComets(engine: CosmicCanvasEngine, width: number, height: number): void {
    // Comet spawn check (very rare)
    if (engine.world.comets.length < 2 && Math.random() < 0.0003) {
      const startFromLeft = Math.random() > 0.5;
      const x = startFromLeft ? -100 : width + 100;
      const y = Math.random() * height * 0.35; // top third
      const angle = startFromLeft 
        ? (Math.random() * 0.35 + 0.08) * Math.PI 
        : (Math.random() * 0.35 + 0.57) * Math.PI;
      const speed = Math.random() * 1.2 + 0.6;
      
      engine.world.comets.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3.0 + 2.0,
        alpha: 0,
        active: true,
        speed,
        color: '0, 190, 255'
      });
    }

    for (let i = engine.world.comets.length - 1; i >= 0; i--) {
      const c = engine.world.comets[i];
      c.x += c.vx;
      c.y += c.vy;

      // check boundaries
      if (c.x < -250 || c.x > width + 250 || c.y > height + 250) {
        engine.world.comets.splice(i, 1);
        continue;
      }

      if (c.alpha < 1.0) {
        c.alpha += 0.015;
      }

      // Draw trails (Ion + Dust)
      const speedVal = Math.sqrt(c.vx * c.vx + c.vy * c.vy) || 1;
      const dx = -c.vx / speedVal;
      const dy = -c.vy / speedVal;

      // Ion Tail (straight, blue-ish gradient)
      const ionGrad = engine.world.ctx.createLinearGradient(c.x, c.y, c.x + dx * 140, c.y + dy * 140);
      ionGrad.addColorStop(0, `rgba(0, 180, 255, ${c.alpha * 0.4})`);
      ionGrad.addColorStop(0.3, `rgba(0, 100, 255, ${c.alpha * 0.15})`);
      ionGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      engine.world.ctx.strokeStyle = ionGrad;
      engine.world.ctx.lineWidth = c.size * 0.85;
      engine.world.ctx.beginPath();
      engine.world.ctx.moveTo(c.x, c.y);
      engine.world.ctx.lineTo(c.x + dx * 140, c.y + dy * 140);
      engine.world.ctx.stroke();

      // Dust Tail (slightly curved, wider, warm golden/white gradient)
      const px = -dy; 
      const py = dx;
      const dustGrad = engine.world.ctx.createLinearGradient(c.x, c.y, c.x + dx * 190 + px * 22, c.y + dy * 190 + py * 22);
      dustGrad.addColorStop(0, `rgba(240, 230, 200, ${c.alpha * 0.3})`);
      dustGrad.addColorStop(0.4, `rgba(210, 190, 170, ${c.alpha * 0.12})`);
      dustGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      engine.world.ctx.fillStyle = dustGrad;
      engine.world.ctx.beginPath();
      engine.world.ctx.moveTo(c.x, c.y);
      engine.world.ctx.lineTo(c.x + dx * 190 - px * 14, c.y + dy * 190 - py * 14);
      engine.world.ctx.lineTo(c.x + dx * 190 + px * 24, c.y + dy * 190 + py * 24);
      engine.world.ctx.closePath();
      engine.world.ctx.fill();

      // Nucleus
      const nucGrad = engine.world.ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.size);
      nucGrad.addColorStop(0, `rgba(255, 255, 255, ${c.alpha})`);
      nucGrad.addColorStop(0.4, `rgba(0, 240, 255, ${c.alpha * 0.75})`);
      nucGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      engine.world.ctx.fillStyle = nucGrad;
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
      engine.world.ctx.fill();
    }
  }


export function getLensedCoords(engine: CosmicCanvasEngine, x: number, y: number): { x: number; y: number } {
    if (!engine.world.mouse.active || engine.world.mouse.x === -1000 || engine.world.state === 'SINGULARITY') {
      return { x, y };
    }

    // Sandbox powers use their own field visuals — skip lensing while a power click is active
    if (isSandboxPowerChannelActive(engine) && engine.world.activePower !== 'DEFAULT') {
      return { x, y };
    }

    const dx = x - engine.world.mouse.x;
    const dy = y - engine.world.mouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    
    const lensRadius = 320;
    if (dist < lensRadius) {
      // Einstein Ring approximation: maximum displacement at mid-radius, tapering to 0 at boundaries
      const force = (lensRadius - dist) / lensRadius;
      const factor = Math.sin(force * Math.PI) * 45; // up to 45px lensing distortion
      
      return {
        x: x + (dx / dist) * factor,
        y: y + (dy / dist) * factor
      };
    }
    
    return { x, y };
  }



export function updateUIAnchors(engine: CosmicCanvasEngine): void {
    if (typeof document === 'undefined') return;
    const now = Date.now();
    if (now - engine.world.lastAnchorUpdate < 750) return; // limit querying bounds
    engine.world.lastAnchorUpdate = now;

    const canvas = engine.world.canvas;
    const rect = canvas.getBoundingClientRect();

    const targets = document.querySelectorAll('h1, h2, .logo, nav ul li a, .button');
    const temp: { x: number; y: number }[] = [];

    targets.forEach(t => {
      const r = t.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0) {
        temp.push({
          x: r.left + r.width / 2 - rect.left,
          y: r.top + r.height / 2 - rect.top
        });
      }
    });

    engine.world.uiAnchors = temp;
  }

