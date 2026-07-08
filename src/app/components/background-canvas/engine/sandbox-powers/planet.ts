import type { CosmicCanvasEngine } from '../cosmic-canvas-engine';
import { Particle, SandboxPlanet } from '../../models/cosmic.types';
import { spawnMiniSupernova, spawnStardustPuff, spawnStellarBirth } from '../particle-system';
import { playSupernovaPop } from '../audio';

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
    baseRadius: radius,
    mass,
    color: JSON.stringify(theme),
    health: 20,
    damageFlash: 0,
    isFragment: false,
    isDying: false,
    deathTimer: 0
  });

  playSupernovaPop();
}

export function shatterPlanet(engine: CosmicCanvasEngine, pl: SandboxPlanet): void {
  if (pl.isDying) return;

  pl.health--;
  pl.damageFlash = 6;

  // Only destroy when health is fully depleted.
  // A full planet has 20 health; fragments have 10.
  if (pl.health > 0) {
    return;
  }

  pl.isDying = true;
  pl.deathTimer = 12; // quickly collapse parent representation

  let theme;
  try {
    theme = JSON.parse(pl.color);
  } catch (e) {
    theme = { sparkColor: 'rgba(0, 255, 140,' };
  }

  const minRadiusForSplit = 10;
  if (pl.radius > minRadiusForSplit && !pl.isFragment) {
    // Asteroids-like shatter: fragment count and size scale with planet radius.
    const numFragments = Math.max(3, Math.min(8, Math.floor(pl.radius * 0.1)));
    const fragmentRadius = pl.radius * 0.35;
    const fragmentMass = fragmentRadius * fragmentRadius * 0.3;

    const baseAngle = Math.random() * Math.PI * 2;
    for (let i = 0; i < numFragments; i++) {
      const angle = baseAngle + (Math.PI * 2 * i) / numFragments + (Math.random() - 0.5) * 0.35;
      const speed = 2.5 + Math.random() * 4.5;

      const fx = pl.x + Math.cos(angle) * (pl.radius * 0.45);
      const fy = pl.y + Math.sin(angle) * (pl.radius * 0.45);

      // Pre-compute a fixed irregular polygon shape (6-9 vertices)
      const vertCount = 6 + Math.floor(Math.random() * 4);
      const vertices: number[] = [];
      for (let v = 0; v < vertCount; v++) {
        vertices.push(0.65 + Math.random() * 0.35);
      }

      engine.world.sandboxPlanets.push({
        x: fx,
        y: fy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: fragmentRadius,
        baseRadius: fragmentRadius,
        mass: fragmentMass,
        color: '', // not used for fragments; shape is defined by vertices
        health: 10,
        damageFlash: 0,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.12,
        vertices,
        isFragment: true,
        isDying: false,
        deathTimer: 0
      });
    }

    // Also spawn some spark puffs
    spawnStardustPuff(engine, pl.x, pl.y, theme.sparkColor || 'rgba(0, 255, 140,');
  } else {
    // Too small to split further, breaks down into regular nursery stars (dust and particles)
    const numStars = Math.floor(Math.random() * 3) + 4; // 4 to 6 stars
    for (let i = 0; i < numStars; i++) {
      const angle = (Math.PI * 2 * i) / numStars + (Math.random() - 0.5) * 0.3;
      const speed = Math.random() * 2.5 + 1.8;

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
