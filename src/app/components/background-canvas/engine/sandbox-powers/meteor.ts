import type { CosmicCanvasEngine } from '../cosmic-canvas-engine';
import { SandboxMeteor, Particle } from '../../models/cosmic.types';
import { spawnMiniSupernova, spawnStellarBirth, spawnStardustPuff } from '../particle-system';
import { playMeteorExplosion, playWormholeTeleportSound } from '../audio';
import { getSandboxChargeProgress } from './charge';
import { shatterPlanet } from './planet';

export function applySandboxMeteorForces(engine: CosmicCanvasEngine, p: Particle): void {
  for (const m of engine.world.sandboxMeteors) {
    if (m.exploded) continue;
    const dx = m.x - p.x;
    const dy = m.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const pullRadius = 100 + m.radius;
    if (dist < pullRadius) {
      const force = (pullRadius - dist) / pullRadius * (m.radius * 0.018);
      p.vx += (dx / dist) * force;
      p.vy += (dy / dist) * force;
      p.vx += (-dy / dist) * force * 0.08;
      p.vy += (dx / dist) * force * 0.08;

      // Close enough — the meteor rips through the star and destroys it
      const killRadius = 18 + m.radius * 0.4;
      if (dist < killRadius && !p.isDying && !p.formationActive && p.birthProgress >= 1.0) {
        p.isDying = true;
        spawnMiniSupernova(engine, p.x, p.y, p.colorPrefix);
      }
    }
  }
}

export function drawMeteorChargePreview(engine: CosmicCanvasEngine): void {
  const charge = getSandboxChargeProgress(engine);
  const ctx = engine.world.ctx;
  const mx = engine.world.mouse.x;
  const my = engine.world.mouse.y;
  const ax = engine.world.meteorAimX;
  const ay = engine.world.meteorAimY;

  // Slingshot: draw a band from aim-point to current cursor
  if (ax !== -1000) {
    const dx = mx - ax;
    const dy = my - ay;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Elastic band (two parallel arcs)
    if (dist > 4) {
      const nx = dy / dist;
      const ny = -dx / dist;
      const bandWidth = 6;

      ctx.strokeStyle = `rgba(255, 200, 80, ${0.55 + charge * 0.3})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ax + nx * bandWidth, ay + ny * bandWidth);
      ctx.quadraticCurveTo((ax + mx) / 2 + nx * 12, (ay + my) / 2 + ny * 12 - dist * 0.12, mx + nx * bandWidth, my + ny * bandWidth);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(ax - nx * bandWidth, ay - ny * bandWidth);
      ctx.quadraticCurveTo((ax + mx) / 2 - nx * 12, (ay + my) / 2 - ny * 12 - dist * 0.12, mx - nx * bandWidth, my - ny * bandWidth);
      ctx.stroke();
    }

    // Aim point anchor
    const anchorR = 6;
    ctx.fillStyle = `rgba(255, 220, 100, ${0.7 + charge * 0.2})`;
    ctx.beginPath();
    ctx.arc(ax, ay, anchorR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Meteor preview at cursor — grows with charge
  const r = 8 + charge * 30;
  const pulse = Math.sin(Date.now() / 40) * 2;

  const gradOuter = ctx.createRadialGradient(mx, my, r * 0.4, mx, my, r + pulse);
  gradOuter.addColorStop(0, `rgba(255, 180, 40, ${0.55 * charge})`);
  gradOuter.addColorStop(0.5, `rgba(255, 100, 20, ${0.35 * charge})`);
  gradOuter.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradOuter;
  ctx.beginPath();
  ctx.arc(mx, my, r + pulse, 0, Math.PI * 2);
  ctx.fill();

  const gradCore = ctx.createRadialGradient(mx, my, 0, mx, my, r * 0.6);
  gradCore.addColorStop(0, `rgba(255, 255, 200, ${0.9 * charge})`);
  gradCore.addColorStop(0.3, `rgba(255, 200, 50, ${0.8 * charge})`);
  gradCore.addColorStop(0.7, `rgba(255, 80, 10, ${0.5 * charge})`);
  gradCore.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradCore;
  ctx.beginPath();
  ctx.arc(mx, my, r, 0, Math.PI * 2);
  ctx.fill();
}

export function spawnSandboxMeteor(engine: CosmicCanvasEngine, x: number, y: number): void {
  // Limit active meteors to 6
  const active = engine.world.sandboxMeteors.filter(m => !m.exploded);
  if (active.length >= 6) {
    active[0].exploded = true;
    active[0].timer = 0;
  }

  const charge = getSandboxChargeProgress(engine);
  const radius = 8 + charge * 22;
  const baseSpeed = 4 + charge * 8;

  // Slingshot launch: direction from cursor toward the aim point (opposite of drag)
  // Power scales with drag distance.
  let angle: number;
  let speed: number;
  const ax = engine.world.meteorAimX;
  const ay = engine.world.meteorAimY;

  if (ax !== -1000) {
    const dx = ax - x;
    const dy = ay - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 5) {
      angle = Math.atan2(dy, dx);
      speed = Math.min(28, baseSpeed + dist * 0.35);
    } else {
      angle = Math.random() * Math.PI * 2;
      speed = baseSpeed;
    }
  } else {
    angle = Math.random() * Math.PI * 2;
    speed = baseSpeed;
  }

  // Reset aim state
  engine.world.meteorAimX = -1000;
  engine.world.meteorAimY = -1000;

  const meteor: SandboxMeteor = {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    timer: 720, // 12 seconds before auto-explode
    trail: [],
    exploded: false,
    wormholeCooldownFrames: 0
  };

  engine.world.sandboxMeteors.push(meteor);
}

export function explodeMeteor(engine: CosmicCanvasEngine, meteor: SandboxMeteor): void {
  if (meteor.exploded) return;
  meteor.exploded = true;
  meteor.timer = 0;

  const x = meteor.x;
  const y = meteor.y;
  const power = meteor.radius * 0.3;

  // Shockwave ring
  engine.world.shockwaves.push({
    x, y,
    radius: 0,
    maxRadius: 180 + power * 2,
    speed: 10 + power * 0.5,
    alpha: 1.0,
    color: '255, 160, 40'
  });

  // Secondary shockwave
  engine.world.shockwaves.push({
    x, y,
    radius: 0,
    maxRadius: 130 + power,
    speed: 7,
    alpha: 0.8,
    color: '255, 240, 120'
  });

  // Sparks explosion
  const sparkCount = Math.floor(25 + power * 1.5);
  for (let i = 0; i < sparkCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = Math.random() * 8 + 3;
    engine.world.sparks.push({
      x, y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      radius: Math.random() * 3 + 1.5,
      alpha: 1.0,
      color: i % 3 === 0 ? 'rgba(255, 200, 60,' : i % 3 === 1 ? 'rgba(255, 140, 20,' : 'rgba(255, 255, 150,'
    });
  }

  // Spawn stars at the explosion site and blast nearby particles
  for (let i = 0; i < 4; i++) {
    spawnStellarBirth(engine, x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30);
  }
  const blastRadius = 150 + power * 1.5;
  for (const p of engine.world.particles) {
    if (p.isDying) continue;
    const dx = p.x - x;
    const dy = p.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    if (dist < blastRadius) {
      const force = (blastRadius - dist) / blastRadius * (3 + power * 0.3);
      p.vx += (dx / dist) * force;
      p.vy += (dy / dist) * force;
      p.colorBlend = Math.max(p.colorBlend, 0.7);
    }
  }

  // Damage nearby planets and fragments
  for (const pl of engine.world.sandboxPlanets) {
    if (pl.isDying) continue;
    const dx = pl.x - x;
    const dy = pl.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 80 + power * 2) {
      const hits = Math.max(1, Math.floor((80 - dist) / 15));
      pl.health = Math.max(0, pl.health - hits);
      pl.damageFlash = 6;
      if (pl.health <= 0) shatterPlanet(engine, pl);
    }
  }

  playMeteorExplosion();
}

function tryWormholeCaptureMeteor(engine: CosmicCanvasEngine, m: SandboxMeteor): boolean {
  if (engine.world.wormholes.length !== 2 || m.exploded) {
    return false;
  }

  if ((m.wormholeCooldownFrames ?? 0) > 0) {
    return false;
  }

  const entry = engine.world.wormholes[0];
  const exit = engine.world.wormholes[1];
  const hypergateActive = engine.world.wormholeHypergateTimer > 0;
  const captureRadius = Math.max(
    entry.radius + m.radius * 0.85,
    entry.radius * (hypergateActive ? 1.9 : 1.15)
  );
  const dx = entry.x - m.x;
  const dy = entry.y - m.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const speed = Math.sqrt(m.vx * m.vx + m.vy * m.vy);

  if (dist >= captureRadius) {
    return false;
  }

  if (speed < 4 && dist > captureRadius * 0.7) {
    return false;
  }

  let dirX = m.vx;
  let dirY = m.vy;
  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);

  if (dirLen > 0.001) {
    dirX /= dirLen;
    dirY /= dirLen;
  } else {
    const exitDx = exit.x - entry.x;
    const exitDy = exit.y - entry.y;
    const exitLen = Math.sqrt(exitDx * exitDx + exitDy * exitDy) || 1;
    dirX = exitDx / exitLen;
    dirY = exitDy / exitLen;
  }

  const perpendicularX = -dirY;
  const perpendicularY = dirX;
  const launchSpeed = Math.max(speed * (hypergateActive ? 1.18 : 1.08), hypergateActive ? 13 : 9);
  const lateralOffset = (Math.random() - 0.5) * Math.min(12, m.radius * 0.5);
  const exitOffset = exit.radius + m.radius + 8;

  m.x = exit.x + dirX * exitOffset + perpendicularX * lateralOffset;
  m.y = exit.y + dirY * exitOffset + perpendicularY * lateralOffset;
  m.vx = dirX * launchSpeed + perpendicularX * launchSpeed * 0.18 * (Math.random() - 0.5);
  m.vy = dirY * launchSpeed + perpendicularY * launchSpeed * 0.18 * (Math.random() - 0.5);
  m.trail.length = 0;
  m.wormholeCooldownFrames = hypergateActive ? 16 : 10;

  spawnStardustPuff(engine, entry.x, entry.y, 'rgba(0, 240, 255,');
  spawnStardustPuff(engine, exit.x, exit.y, 'rgba(255, 100, 230,');
  playWormholeTeleportSound();
  return true;
}

export function updateAndDrawMeteors(engine: CosmicCanvasEngine, width: number, height: number): void {
  const ctx = engine.world.ctx;

  for (let i = engine.world.sandboxMeteors.length - 1; i >= 0; i--) {
    const m = engine.world.sandboxMeteors[i];

    if (m.exploded) {
      if (m.timer <= 0) {
        engine.world.sandboxMeteors.splice(i, 1);
      }
      m.timer--;
      continue;
    }

    m.timer--;
    if ((m.wormholeCooldownFrames ?? 0) > 0) {
      m.wormholeCooldownFrames!--;
    }

    // Update position
    m.x += m.vx;
    m.y += m.vy;

    m.vx *= 0.995;
    m.vy *= 0.995;

    // Detect screen-wrap before position correction.  If the meteor flew
    // off-screen we clear the trail so it doesn't draw a line across the
    // entire viewport.
    const offScreen = m.x < -m.radius || m.x > width + m.radius ||
                      m.y < -m.radius || m.y > height + m.radius;

    // Wrap around screen edges
    if (m.x < -m.radius) m.x = width + m.radius;
    else if (m.x > width + m.radius) m.x = -m.radius;
    if (m.y < -m.radius) m.y = height + m.radius;
    else if (m.y > height + m.radius) m.y = -m.radius;

    // Trail recording — if the meteor wrapped, clear the trail to avoid a smear
    if (offScreen) {
      m.trail.length = 0;
    }
    m.trail.push({ x: m.x, y: m.y });
    if (m.trail.length > 18) m.trail.shift();

    // Check collision with planets
    for (const pl of engine.world.sandboxPlanets) {
      if (pl.isDying) continue;
      const dx = pl.x - m.x;
      const dy = pl.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < pl.radius + m.radius) {
        explodeMeteor(engine, m);
        break;
      }
    }

    if (m.exploded) continue;

    // Check collision with sandbox black holes — use the black hole's visible
    // radius so the meteor gets caught before gravity slings it past.
    for (const sbh of engine.world.sandboxBlackholes) {
      if (sbh.isDying) continue;
      const dx = sbh.x - m.x;
      const dy = sbh.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const bhCollisionRadius = Math.max(25, sbh.radius + m.radius);
      if (dist < bhCollisionRadius) {
        explodeMeteor(engine, m);
        break;
      }
    }

    // Meteor-meteor collision — two meteors hitting each other both explode
    for (const other of engine.world.sandboxMeteors) {
      if (other === m || other.exploded) continue;
      const dx = other.x - m.x;
      const dy = other.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < m.radius + other.radius + 15) {
        explodeMeteor(engine, m);
        explodeMeteor(engine, other);
        break;
      }
    }

    if (m.exploded) continue;

    // Auto explode after timer
    if (m.timer <= 0) {
      explodeMeteor(engine, m);
      continue;
    }

    if (m.exploded) continue;

    // Apply external forces (black hole gravity, wormholes)
    for (const sbh of engine.world.sandboxBlackholes) {
      if (sbh.isDying) continue;
      const dx = sbh.x - m.x;
      const dy = sbh.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < sbh.pullRadius) {
        const force = (sbh.pullRadius - dist) / sbh.pullRadius * sbh.gravityStrength * 0.3;
        m.vx += (dx / dist) * force;
        m.vy += (dy / dist) * force;
      }
    }

    if (engine.world.wormholes.length === 2) {
      const entry = engine.world.wormholes[0];
      const hypergateActive = engine.world.wormholeHypergateTimer > 0;
      const captureRadius = Math.max(
        entry.radius + m.radius * 0.85,
        entry.radius * (hypergateActive ? 1.9 : 1.15)
      );
      const dx = entry.x - m.x;
      const dy = entry.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      if (tryWormholeCaptureMeteor(engine, m)) {
        // Reset the recorded trail so the next frame starts from the exit portal.
        m.trail.push({ x: m.x, y: m.y });
      } else {
        const entryReach = 340 * (hypergateActive ? 1.8 : 1);
        if (dist < entryReach) {
          const force = (entryReach - dist) / entryReach * (hypergateActive ? 2.8 : 1.4);
          m.vx += (dx / dist) * force;
          m.vy += (dy / dist) * force;
          m.vx += (-dy / dist) * force * 0.35;
          m.vy += (dx / dist) * force * 0.35;

          if (dist < captureRadius * 1.15) {
            tryWormholeCaptureMeteor(engine, m);
          }
        }
      }
    }

    // Planet gravity pulls meteors toward large planets
    for (const pl of engine.world.sandboxPlanets) {
      if (pl.isDying) continue;
      const dx = pl.x - m.x;
      const dy = pl.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < pl.radius * 4) {
        const force = (pl.radius * 4 - dist) / (pl.radius * 4) * 0.15;
        m.vx += (dx / dist) * force;
        m.vy += (dy / dist) * force;
      }
    }

    // Sandbox chrono wells — slow meteors at a gentler rate than stars so
    // they don't freeze in place.
    for (const cw of engine.world.sandboxChronoWells) {
      if (cw.isDying) continue;
      const dx = cw.x - m.x;
      const dy = cw.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const wellRadius = cw.maxRadius + 60;
      if (dist < wellRadius) {
        const scaleRatio = cw.maxRadius > 0 ? (cw.radius / cw.maxRadius) : 1;
        const depth = 1 - dist / wellRadius;
        const starSlow = cw.slowFactor + (1 - cw.slowFactor) * (1 - depth * scaleRatio);
        // Meteors use a blended version — never slower than 0.95 even at center
        const meteorSlow = Math.max(0.95, starSlow);
        m.vx *= meteorSlow;
        m.vy *= meteorSlow;
      }
    }

    // Time dilation cursor field — gently slow meteors near cursor
    if (
      engine.world.activePower === 'TIME_DILATION' &&
      engine.world.mouse.active &&
      engine.world.mouse.x !== -1000
    ) {
      const dx = engine.world.mouse.x - m.x;
      const dy = engine.world.mouse.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < 220) {
        const depth = 1 - dist / 220;
        const drag = 0.004 + depth * 0.012; // 0.4%–1.6% slow per frame
        m.vx *= (1 - drag);
        m.vy *= (1 - drag);
      }
    }

    // Nova strike shockwave blasts — push meteors away from explosions
    for (const s of engine.world.shockwaves) {
      const dx = m.x - s.x;
      const dy = m.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < s.radius && dist > s.radius - 80) {
        const force = (1 - dist / s.maxRadius) * 5;
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
        m.vx += Math.cos(angle) * force;
        m.vy += Math.sin(angle) * force;
      }
    }

    // --- RENDER TRAIL ---
    if (m.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(m.trail[0].x, m.trail[0].y);
      for (let t = 1; t < m.trail.length; t++) {
        ctx.lineTo(m.trail[t].x, m.trail[t].y);
      }
      ctx.lineTo(m.x, m.y);
      const trailGrad = ctx.createLinearGradient(
        m.trail[0].x, m.trail[0].y, m.x, m.y
      );
      trailGrad.addColorStop(0, 'rgba(255, 120, 20, 0)');
      trailGrad.addColorStop(0.5, 'rgba(255, 180, 40, 0.6)');
      trailGrad.addColorStop(1, 'rgba(255, 240, 120, 0.9)');
      ctx.strokeStyle = trailGrad;
      ctx.lineWidth = m.radius * 0.7;
      ctx.stroke();

      // Inner bright core trail
      ctx.beginPath();
      ctx.moveTo(m.trail[Math.floor(m.trail.length * 0.5)].x, m.trail[Math.floor(m.trail.length * 0.5)].y);
      ctx.lineTo(m.x, m.y);
      ctx.strokeStyle = 'rgba(255, 255, 200, 0.7)';
      ctx.lineWidth = m.radius * 0.3;
      ctx.stroke();
    }

    // --- RENDER METEOR BODY ---
    // Outer fiery halo
    const haloGrad = ctx.createRadialGradient(m.x, m.y, m.radius * 0.3, m.x, m.y, m.radius * 2);
    haloGrad.addColorStop(0, 'rgba(255, 200, 20, 0.6)');
    haloGrad.addColorStop(0.5, 'rgba(255, 100, 10, 0.3)');
    haloGrad.addColorStop(1, 'rgba(255, 40, 0, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius * 2, 0, Math.PI * 2);
    ctx.fill();

    // Core
    const coreGrad = ctx.createRadialGradient(m.x - m.radius * 0.2, m.y - m.radius * 0.2, 0, m.x, m.y, m.radius);
    coreGrad.addColorStop(0, 'rgba(255, 255, 220, 1)');
    coreGrad.addColorStop(0.35, 'rgba(255, 220, 60, 0.95)');
    coreGrad.addColorStop(0.7, 'rgba(255, 100, 20, 0.8)');
    coreGrad.addColorStop(1, 'rgba(200, 40, 0, 0.6)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
    ctx.fill();

    // Spark particles flying off the meteor
    if (Math.random() < 0.5) {
      const sa = Math.random() * Math.PI * 2;
      const sd = m.radius * (0.8 + Math.random() * 0.4);
      engine.world.sparks.push({
        x: m.x + Math.cos(sa) * sd,
        y: m.y + Math.sin(sa) * sd,
        vx: -m.vx * 0.3 + (Math.random() - 0.5) * 2,
        vy: -m.vy * 0.3 + (Math.random() - 0.5) * 2,
        radius: Math.random() * 1.5 + 0.5,
        alpha: 0.7,
        color: Math.random() > 0.5 ? 'rgba(255, 200, 50,' : 'rgba(255, 120, 20,'
      });
    }
  }
}
