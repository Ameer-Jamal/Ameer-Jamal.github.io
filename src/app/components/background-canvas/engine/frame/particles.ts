import { COSMIC_CONSTANTS } from '../../models/cosmic.constants';
import type { Particle } from '../../models/cosmic.types';
import type { CosmicCanvasEngine } from '../cosmic-canvas-engine';
import { getMaxParticles, getScaledConnectionDistance } from '../cosmic-world';
import { isSandboxPowerChannelActive, isMouseGravityActive, isMouseGravityPaused, usesDefaultMouseGravity, transitionTo, blastParticlesAway } from '../state-machine';
import { spawnStellarBirth, spawnNurseryStar, spawnStardustPuff, spawnMiniSupernova, isIntenseParticleMesh, findRandomNearbyParticle } from '../particle-system';
import { drawMiniChargeArc, spawnEasterEggConstellation, drawEasterEggs } from '../effects';
import { drawGalaxy, updateAndDrawComets, getLensedCoords, updateUIAnchors } from '../background-layers';
import { endLogoBlackhole } from '../logo-easter-egg';
import { beginAyaFormation, drawFormationLinks, endAyaFormation, tickAyaFormation } from '../aya-formation';
import { drawLoadingRingLinks, tickLoadingSpinner, tryCompleteLoading } from '../loading-spinner';
import { applyPageExplodeFrame, collectPageExplodeElements } from '../page-explode-targets';
import { playSupernovaPop, stopBlackholeHum, updatePowerChargeAudio, playWormholeTeleportSound } from '../audio';
import { getSandboxChargeProgress, tickSandboxCharge, drawSandboxPowerChargeAuras, applyBlackHolePreviewGravity, tryWormholeCapture, applyWormholeForcesToParticle, applySandboxBlackholeForces, applySandboxChronoWellForces, tickTeslaHoldZaps, updateAndDrawSandboxElements, applySandboxPlanetForces, applySandboxMeteorForces, shatterPlanet, updateAndDrawMeteors, explodeMeteor } from '../sandbox-powers';
import { drawHeart } from './shared';

export function updateAndRenderParticles(engine: CosmicCanvasEngine, width: number, height: number, chargeProgress: number): void {
    // 10. Stellar nursery: Random births if particle count drops (maintain ecosystem)
    if (engine.world.particles.length < getMaxParticles(engine.world) && engine.world.state !== 'AYA_FORMATION' && engine.world.state !== 'LOADING' && Math.random() < 0.045) {
      spawnStellarBirth(engine, Math.random() * width, Math.random() * height);
    }

    // Spawn painted stars during drag if paint brush is active
    if (engine.world.isMouseDown && engine.world.activePower === 'PAINT_BRUSH' && engine.world.mouse.x !== -1000) {
      engine.world.paintHoldFrame++;
      if (engine.world.paintHoldFrame % 2 === 0) {
        spawnNurseryStar(engine, engine.world.mouse.x, engine.world.mouse.y);
      }
    } else {
      engine.world.paintHoldFrame = 0;
    }

    // --- FRAGMENT (ASTEROID) PHYSICS ---
    // Apply gravity wells, wormholes, chrono wells, and mouse pull to
    // planet fragments so they drift and behave like dynamic objects instead
    // of sitting still.
    for (const frag of engine.world.sandboxPlanets) {
      if (frag.isDying || !frag.isFragment || !frag.vx || !frag.vy) continue;

      // 1. Sandbox black hole gravity
      for (const sbh of engine.world.sandboxBlackholes) {
        if (sbh.isDying) continue;
        const dx = sbh.x - frag.x;
        const dy = sbh.y - frag.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const pullRadius = 280 + (engine.world.isMouseDown ? 120 : 0);
        if (dist < pullRadius) {
          const force = (pullRadius - dist) / pullRadius * 0.35;
          frag.vx += (dx / dist) * force;
          frag.vy += (dy / dist) * force;
          frag.vx += (-dy / dist) * force * 0.25;
          frag.vy += (dx / dist) * force * 0.25;
        }
      }

      // 2. Sandbox chrono well slow-down
      for (const cw of engine.world.sandboxChronoWells) {
        if (cw.isDying) continue;
        const dx = cw.x - frag.x;
        const dy = cw.y - frag.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 180) {
          const depth = 1 - dist / 180;
          frag.vx *= 0.65 - depth * 0.3;
          frag.vy *= 0.65 - depth * 0.3;
        }
      }

      // 3. Wormhole teleport pull
      for (const wh of engine.world.wormholes) {
        if (wh.type !== 'ENTRY') continue;
        const dx = wh.x - frag.x;
        const dy = wh.y - frag.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 80) {
          const force = (80 - dist) / 80 * 2.2;
          frag.vx += (dx / dist) * force;
          frag.vy += (dy / dist) * force;
        }
      }

      // 4. Mouse swarm gravity — fragments follow the cursor like stars
      if (
        !isMouseGravityPaused(engine) &&
        engine.world.mouse.active &&
        engine.world.mouse.x !== -1000 &&
        (engine.world.state === 'SWARM' || engine.world.state === 'DRIFT')
      ) {
        const dx = engine.world.mouse.x - frag.x;
        const dy = engine.world.mouse.y - frag.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < COSMIC_CONSTANTS.MOUSE_ATTRACT_DISTANCE) {
          const pullStrength = (COSMIC_CONSTANTS.MOUSE_ATTRACT_DISTANCE - dist) / COSMIC_CONSTANTS.MOUSE_ATTRACT_DISTANCE;
          frag.vx += (dx / dist) * pullStrength * 0.35;
          frag.vy += (dy / dist) * pullStrength * 0.35;
        }
      }

      // 5. Background black hole gravity
      for (const bh of engine.world.backgroundBlackholes) {
        const dx = bh.x - frag.x;
        const dy = bh.y - frag.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 180) {
          const force = (180 - dist) / 180 * 0.25;
          frag.vx += (dx / dist) * force;
          frag.vy += (dy / dist) * force;
        }
      }

      // 6. Fragment-fragment avoidance (don't stack on each other)
      for (const other of engine.world.sandboxPlanets) {
        if (other === frag || other.isDying || !other.isFragment) continue;
        const dx = frag.x - other.x;
        const dy = frag.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = frag.radius + other.radius + 8;
        if (dist < minDist && dist > 0) {
          const push = (minDist - dist) / minDist * 0.6;
          frag.vx += (dx / dist) * push;
          frag.vy += (dy / dist) * push;
        }
      }

      // 7. Nova strike shockwave blasts — push fragments away from explosions
      for (const s of engine.world.shockwaves) {
        const dx = frag.x - s.x;
        const dy = frag.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < s.radius && dist > s.radius - 80) {
          const force = (1 - dist / s.maxRadius) * 6.5;
          const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.7;
          frag.vx += Math.cos(angle) * force;
          frag.vy += Math.sin(angle) * force;
        }
      }

      // 8. Repeller anti-gravity — push fragments away from cursor
      if (
        engine.world.activePower === 'REPELLER' &&
        isSandboxPowerChannelActive(engine) &&
        engine.world.mouse.active &&
        engine.world.mouse.x !== -1000
      ) {
        const dx = frag.x - engine.world.mouse.x;
        const dy = frag.y - engine.world.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const fieldRadius = 220;
        if (dist < fieldRadius) {
          const force = (fieldRadius - dist) / fieldRadius;
          frag.vx += (dx / dist) * force * 1.5;
          frag.vy += (dy / dist) * force * 1.5;
        }
      }

      // 9. Nebular wind — blow fragments with the wind current
      if (
        engine.world.activePower === 'NEBULAR_WIND' &&
        isSandboxPowerChannelActive(engine) &&
        engine.world.mouse.active &&
        engine.world.mouse.x !== -1000
      ) {
        const dx = frag.x - engine.world.mouse.x;
        const dy = frag.y - engine.world.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 280) {
          const force = (280 - dist) / 280;
          frag.vx += engine.world.mouseVelocity.x * force * 0.3;
          frag.vy += engine.world.mouseVelocity.y * force * 0.3;
        }
      }

      // 10. Time dilation cursor field — slow fragments near cursor
      if (
        engine.world.activePower === 'TIME_DILATION' &&
        engine.world.mouse.active &&
        engine.world.mouse.x !== -1000
      ) {
        const dx = engine.world.mouse.x - frag.x;
        const dy = engine.world.mouse.y - frag.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 220) {
          const depth = 1 - dist / 220;
          frag.vx *= 0.55 - depth * 0.3;
          frag.vy *= 0.55 - depth * 0.3;
        }
      }

      // 11. Inversion nova — blast fragments away from cursor
      if (engine.world.inversionNovaTimer > 0 && engine.world.mouse.x !== -1000) {
        const dx = frag.x - engine.world.mouse.x;
        const dy = frag.y - engine.world.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 360) {
          const force = (360 - dist) / 360;
          frag.vx += (dx / dist) * force * 2.0;
          frag.vy += (dy / dist) * force * 2.0;
        }
      }

      // 12. Nova Strike charging pull — fragments orbit toward cursor on hold
      if (
        engine.world.state === 'CHARGING' &&
        usesDefaultMouseGravity(engine) &&
        engine.world.mouse.active &&
        engine.world.mouse.x !== -1000
      ) {
        const dx = engine.world.mouse.x - frag.x;
        const dy = engine.world.mouse.y - frag.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const activeAttractDist = COSMIC_CONSTANTS.MOUSE_ATTRACT_DISTANCE + chargeProgress * 240;
        if (dist < activeAttractDist) {
          const pullStrength = (activeAttractDist - dist) / activeAttractDist;
          const forceMultiplier = 0.78 + chargeProgress * 1.5;
          frag.vx += (dx / dist) * pullStrength * forceMultiplier;
          frag.vy += (dy / dist) * pullStrength * forceMultiplier;
          frag.vx += (-dy / dist) * pullStrength * 0.15;
          frag.vy += (dx / dist) * pullStrength * 0.15;
          const speed = Math.sqrt(frag.vx * frag.vx + frag.vy * frag.vy);
          const maxSpeed = 8.0 + chargeProgress * 4.0;
          if (speed > maxSpeed) {
            frag.vx = (frag.vx / speed) * maxSpeed;
            frag.vy = (frag.vy / speed) * maxSpeed;
          }
        }
      }
    }

    // 11. Update & Render main interactive constellation particles
    const pLength = engine.world.particles.length;
    const glowAmplitude = 0.15 + (Math.sin(Date.now() / 400) + 1.0) * 0.5 * 0.25;

    engine.world.particleSpatialHash.clear();
    for (let h = 0; h < pLength; h++) {
      const ph = engine.world.particles[h];
      engine.world.particleSpatialHash.insert(h, ph.x, ph.y);
    }

    const intenseMesh = isIntenseParticleMesh(engine);
    const meshConnectionDist = engine.world.state === 'DRIFT'
      ? getScaledConnectionDistance(engine.world) * 0.78
      : (engine.world.state === 'MOON_DANCE' || engine.world.state === 'AYA_FORMATION' || engine.world.state === 'LOADING'
        ? getScaledConnectionDistance(engine.world) * 1.35
        : getScaledConnectionDistance(engine.world));
    const meshLimitSq = meshConnectionDist * meshConnectionDist;
    const flockRange = 180;
    const breedingRange = 18;

    for (let i = pLength - 1; i >= 0; i--) {
      const p = engine.world.particles[i];
      p.isLassoed = false;

      // A. Star Life Cycle Logic
      if (p.birthProgress < 1.0 && engine.world.state !== 'MOON_DANCE' && engine.world.state !== 'AYA_FORMATION' && engine.world.state !== 'LOADING') {
        p.birthProgress += p.isNursery ? 0.08 : 0.025;
      }

      if (engine.world.state !== 'MOON_DANCE' && engine.world.state !== 'AYA_FORMATION' && engine.world.state !== 'LOADING') {
        if (!p.isDying) {
          p.life -= Math.random() * 0.00007 + 0.00002;
          if (p.life <= 0.12) {
            p.isDying = true;
          }
        } else {
          p.deathProgress += 0.015;
          if (p.deathProgress >= 1.0) {
            if (p.isNursery) {
              engine.world.nurseryStarCount = Math.max(0, engine.world.nurseryStarCount - 1);
            }
            spawnMiniSupernova(engine, p.x, p.y, p.colorPrefix);
            engine.world.particles.splice(i, 1);
            continue;
          }
        }
      }

      const inLoadingRing = engine.world.state === 'LOADING' && p.orbitAngle !== undefined;
      const inFormation = p.formationActive && engine.world.state === 'AYA_FORMATION';

      // B. Singularity / Moon Dance pull physics (Vortex Black-Hole or Orbit Dance)
      if (!inFormation && !inLoadingRing && engine.world.state === 'SINGULARITY') {
        const dx = engine.world.singularity.x - p.x;
        const dy = engine.world.singularity.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < 400) {
          const force = (400 - dist) / 400;
          p.vx += (dx / dist) * force * 1.55;
          p.vy += (dy / dist) * force * 1.55;

          p.vx += (-dy / dist) * force * 0.85;
          p.vy += (dx / dist) * force * 0.85;

          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          const maxSpeed = 10.0;
          if (speed > maxSpeed) {
            p.vx = (p.vx / speed) * maxSpeed;
            p.vy = (p.vy / speed) * maxSpeed;
          }
        }
      } else if (!inFormation && !inLoadingRing && engine.world.state === 'MOON_DANCE') {
        const dx = engine.world.singularity.x - p.x;
        const dy = engine.world.singularity.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (engine.world.stateTimer > 90) {
          // Phase 1: Spiral galaxy inward pull
          // Target orbit radius slowly collapses from 350px down to 80px over 5 seconds (300 frames)
          const t = Math.min(1.0, (390 - engine.world.stateTimer) / 300);
          const targetOrbit = 350 - t * 270;
          
          const radialDiff = dist - targetOrbit;
          const pullStrength = 0.04 + t * 0.06; // pulls tighter as time goes on
          const pullX = (dx / dist) * radialDiff * pullStrength;
          const pullY = (dy / dist) * radialDiff * pullStrength;

          // Tangential swirl speed increases as orbit shrinks (conservation of angular momentum!)
          const orbitSpeed = 2.8 + t * 4.5;
          const tangentX = (-dy / dist) * orbitSpeed;
          const tangentY = (dx / dist) * orbitSpeed;

          // Dynamic wavy wobble
          const waveFactor = Math.sin(Date.now() * 0.007 + i) * (2.2 * (1 - t * 0.5));
          const danceX = (dx / dist) * waveFactor;
          const danceY = (dy / dist) * waveFactor;

          p.vx += pullX + tangentX + danceX;
          p.vy += pullY + tangentY + danceY;

          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
          const maxSpeed = 7.0 + t * 5.0; // speed limit increases as they get sucked in
          if (speed > maxSpeed) {
            p.vx = (p.vx / speed) * maxSpeed;
            p.vy = (p.vy / speed) * maxSpeed;
          }
        } else {
          // Phase 2: Hyper acceleration directly into the core
          p.vx += (dx / dist) * 2.8;
          p.vy += (dy / dist) * 2.8;
          p.vx += (-dy / dist) * 1.5;
          p.vy += (dx / dist) * 1.5;

          // Decelerate/compress at center
          p.vx *= 0.86;
          p.vy *= 0.86;

          // Vanish
          p.birthProgress = Math.max(0, p.birthProgress - 0.035);
        }
      }

      // C. Evaluate Charging Pull Physics (Nova Strike only)
      if ((!inFormation || engine.world.isSandboxOpen || (typeof document !== 'undefined' && document.body.classList.contains('is-aya-message'))) && !inLoadingRing && engine.world.state === 'CHARGING' && usesDefaultMouseGravity(engine)) {
        const dx = engine.world.mouse.x - p.x;
        const dy = engine.world.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const activeAttractDist = COSMIC_CONSTANTS.MOUSE_ATTRACT_DISTANCE + chargeProgress * 240;

        if (dist < activeAttractDist) {
          const chargeForceMultiplier = 0.78 + chargeProgress * 1.5;
          const pullStrength = (activeAttractDist - dist) / activeAttractDist;
          p.vx += (dx / dist) * pullStrength * chargeForceMultiplier;
          p.vy += (dy / dist) * pullStrength * chargeForceMultiplier;

          p.vx += (-dy / dist) * pullStrength * 0.14;
          p.vy += (dx / dist) * pullStrength * 0.14;

          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          const maxSpeed = 8.0 + chargeProgress * 4.0;
          if (speed > maxSpeed) {
            p.vx = (p.vx / speed) * maxSpeed;
            p.vy = (p.vy / speed) * maxSpeed;
          }
        }
      }

      // D. Evaluate Expanding Shockwave Physics
      if ((!inFormation || engine.world.activePower !== 'DEFAULT' || engine.world.isSandboxOpen || (typeof document !== 'undefined' && document.body.classList.contains('is-aya-message'))) && !inLoadingRing) {
      for (const s of engine.world.shockwaves) {
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < s.radius && dist > s.radius - 60) {
          const force = (1 - dist / s.maxRadius) * 9.5;
          
          // Add chaotic deflection angle to expanding shockwave boundary hits
          const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.0; 
          const speed = force * 0.35 * (Math.random() * 0.5 + 0.75);
          
          p.vx += Math.cos(angle) * speed;
          p.vy += Math.sin(angle) * speed;
          p.colorBlend = Math.max(p.colorBlend, 0.85);
          tryWormholeCapture(engine, p, { forceCapture: true });
        }
      }
      }

      // D2. Sandbox black hole + wormhole + Chrono Well + Planet world physics (persistent until CLEAR)
      if ((!inFormation || engine.world.activePower !== 'DEFAULT' || engine.world.isSandboxOpen || (typeof document !== 'undefined' && document.body.classList.contains('is-aya-message'))) && !inLoadingRing) {
      for (const sbh of engine.world.sandboxBlackholes) {
        applySandboxBlackholeForces(engine, p, sbh);
      }
      for (const cw of engine.world.sandboxChronoWells) {
        applySandboxChronoWellForces(engine, p, cw);
      }
      for (const pl of engine.world.sandboxPlanets) {
        applySandboxPlanetForces(engine, p, pl);
      }
      applyWormholeForcesToParticle(engine, p);
      applySandboxMeteorForces(engine, p);
      }

      // E. Evaluate Swarm Gravity Physics (paused briefly when using a sandbox power)
      if (!inFormation && !inLoadingRing && engine.world.state === 'SWARM' && isMouseGravityActive(engine)) {
        const dx = engine.world.mouse.x - p.x;
        const dy = engine.world.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < COSMIC_CONSTANTS.MOUSE_ATTRACT_DISTANCE) {
          const pullStrength = (COSMIC_CONSTANTS.MOUSE_ATTRACT_DISTANCE - dist) / COSMIC_CONSTANTS.MOUSE_ATTRACT_DISTANCE;
          p.vx += (dx / dist) * pullStrength * 0.78;
          p.vy += (dy / dist) * pullStrength * 0.78;

          p.vx += (-dy / dist) * pullStrength * 0.12;
          p.vy += (dx / dist) * pullStrength * 0.12;

          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          const maxSpeed = 7.0;
          if (speed > maxSpeed) {
            p.vx = (p.vx / speed) * maxSpeed;
            p.vy = (p.vy / speed) * maxSpeed;
          }
        }
      }

      // Aya Easter Egg Interactive Gravity: let the user interactively influence the particles
      // during the moon dance/star formation and during the long Aya-message formation hold.
      if ((engine.world.isAyaDanceActive || engine.world.state === 'AYA_FORMATION') && engine.world.mouse.active && engine.world.mouse.x !== -1000) {
        const dx = engine.world.mouse.x - p.x;
        const dy = engine.world.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const attractDist = 300;
        if (dist < attractDist) {
          const pullStrength = (attractDist - dist) / attractDist;
          // Apply a gentle force to influence the star paths interactively
          const forceMultiplier = engine.world.state === 'AYA_FORMATION' ? 0.35 : 0.65;
          p.vx += (dx / dist) * pullStrength * 0.78 * forceMultiplier;
          p.vy += (dy / dist) * pullStrength * 0.78 * forceMultiplier;
          p.vx += (-dy / dist) * pullStrength * 0.15 * forceMultiplier;
          p.vy += (dx / dist) * pullStrength * 0.15 * forceMultiplier;
        }
      }

      // Wormhole placement preview suction (before both portals exist)
      if (engine.world.isMouseDown && engine.world.activePower === 'WORMHOLE' && engine.world.wormholes.length < 2 && engine.world.mouse.active && engine.world.mouse.x !== -1000) {
        const charge = getSandboxChargeProgress(engine);
        const suctionRadius = 160 + charge * 120;
        const dx = engine.world.mouse.x - p.x;
        const dy = engine.world.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < suctionRadius) {
          const force = (suctionRadius - dist) / suctionRadius;
          p.vx += (dx / dist) * force * (0.5 + charge * 0.8);
          p.vy += (dy / dist) * force * (0.5 + charge * 0.8);
        }
      }

      // Sandbox Repeller Force (while sandbox channel is active)
      if (engine.world.activePower === 'REPELLER' && isSandboxPowerChannelActive(engine) && engine.world.mouse.active && engine.world.mouse.x !== -1000) {
        const charge = engine.world.isMouseDown ? getSandboxChargeProgress(engine) : 0.2;
        const fieldRadius = 220 + charge * 220;
        const dx = p.x - engine.world.mouse.x;
        const dy = p.y - engine.world.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < fieldRadius) {
          const force = (fieldRadius - dist) / fieldRadius;
          const repel = 1.2 + charge * 1.8;
          p.vx += (dx / dist) * force * repel;
          p.vy += (dy / dist) * force * repel;
          p.vx += (-dy / dist) * force * (0.15 + charge * 0.35);
          p.vy += (dx / dist) * force * (0.15 + charge * 0.35);
        }
      }

      if (engine.world.inversionNovaTimer > 0 && engine.world.mouse.x !== -1000) {
        const dx = p.x - engine.world.mouse.x;
        const dy = p.y - engine.world.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 360) {
          const force = (360 - dist) / 360;
          p.vx += (dx / dist) * force * 2.5;
          p.vy += (dy / dist) * force * 2.5;
        }
      }

      // Chrono Well — time slow + gentle inward drift (always active around mouse cursor when selected)
      if (engine.world.activePower === 'TIME_DILATION' && engine.world.mouse.active && engine.world.mouse.x !== -1000) {
        const charge = engine.world.isMouseDown ? getSandboxChargeProgress(engine) : 0.25;
        const fieldRadius = 180 + charge * 180;
        const dx = engine.world.mouse.x - p.x;
        const dy = engine.world.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < fieldRadius) {
          const depth = 1 - dist / fieldRadius;
          const slowFactor = 0.55 - depth * (0.25 + charge * 0.25);
          p.vx *= slowFactor;
          p.vy *= slowFactor;

          const pullStrength = depth * (0.18 + charge * 0.22);
          p.vx += (dx / dist) * pullStrength;
          p.vy += (dy / dist) * pullStrength;
          p.vx += (-dy / dist) * pullStrength * 0.35;
          p.vy += (dx / dist) * pullStrength * 0.35;
          p.colorBlend = Math.max(p.colorBlend, 0.45 + depth * (0.35 + charge * 0.25));
        }
      }

      // Sandbox Nebular Wind Force (while sandbox channel active + mouse held)
      if (engine.world.activePower === 'NEBULAR_WIND' && isSandboxPowerChannelActive(engine) && engine.world.isMouseDown && engine.world.mouse.active && engine.world.mouse.x !== -1000) {
        const charge = getSandboxChargeProgress(engine);
        const dx = p.x - engine.world.mouse.x;
        const dy = p.y - engine.world.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const reach = 200 + charge * 180;
        if (dist < reach) {
          const force = (reach - dist) / reach;
          const windScale = 0.25 + charge * 0.45;
          p.vx += engine.world.mouseVelocity.x * force * windScale;
          p.vy += engine.world.mouseVelocity.y * force * windScale;
        }
      }

      // Physics wall collisions against Stellar Lasso path segments (acts as a solid containment fence!)
      if (engine.world.activePower === 'STELLAR_LASSO' && (engine.world.isMouseDown || engine.world.lassoReleaseQueued) && engine.world.lassoPath && engine.world.lassoPath.length > 1) {
        const pathLen = engine.world.lassoPath.length;
        for (let k = 0; k < pathLen - 1; k += 2) {
          const pt1 = engine.world.lassoPath[k];
          const pt2 = engine.world.lassoPath[k + 1];
          if (!pt1 || !pt2) continue;
          
          const segDx = pt2.x - pt1.x;
          const segDy = pt2.y - pt1.y;
          const segLenSq = segDx * segDx + segDy * segDy;
          if (segLenSq < 1) continue;
          
          let t = ((p.x - pt1.x) * segDx + (p.y - pt1.y) * segDy) / segLenSq;
          t = Math.max(0, Math.min(1, t));
          
          const projX = pt1.x + t * segDx;
          const projY = pt1.y + t * segDy;
          const distToSeg = Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2) || 1;
          
          const radiusSum = p.radius + 12.0; // thick physical containment forcefield wall
          if (distToSeg < radiusSum) {
            const nx = (p.x - projX) / distToSeg;
            const ny = (p.y - projY) / distToSeg;
            
            // Push out of collision
            p.x = projX + nx * radiusSum;
            
            // Reflect velocity along normal (bounce!)
            const dot = p.vx * nx + p.vy * ny;
            p.vx = (p.vx - 2.0 * dot * nx) * 0.85;
            p.vy = (p.vy - 2.0 * dot * ny) * 0.85;
            
            // Slide along the rope wall
            p.vx += -ny * 0.4;
            p.vy += nx * 0.4;
            
            p.colorBlend = Math.max(p.colorBlend, 0.7);
            
            if (Math.random() < 0.15) {
              engine.world.sparks.push({
                x: p.x,
                y: p.y,
                vx: nx * 2.0 + (Math.random() - 0.5) * 1.5,
                vy: ny * 2.0 + (Math.random() - 0.5) * 1.5,
                radius: Math.random() * 1.0 + 0.5,
                alpha: 1.0,
                color: '255, 220, 50'
              });
            }
          }
        }
      }

      // Sandbox Stellar Lasso orbit pull physics (while lasso active + mouse held OR while collapsing)
      if (engine.world.activePower === 'STELLAR_LASSO' && !inFormation && !inLoadingRing) {
        const isHeld = engine.world.isMouseDown && engine.world.mouse.active && engine.world.mouse.x !== -1000;
        const isCollapsing = engine.world.lassoReleaseQueued && engine.world.lassoPath && engine.world.lassoPath.length > 0;
        
        if (isHeld || isCollapsing) {
          let targetX = engine.world.mouse.x;
          let targetY = engine.world.mouse.y;
          
          if (isCollapsing) {
            const tip = engine.world.lassoPath[engine.world.lassoPath.length - 1];
            targetX = tip.x;
            targetY = tip.y;
            
            // Constrain and scale positions directly in sync with the collapsing container to prevent phasing!
            p.x += (tip.x - p.x) * 0.28;
            p.y += (tip.y - p.y) * 0.28;
          }
          
          const dx = p.x - targetX;
          const dy = p.y - targetY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          let minTrailDist = dist;
          if (engine.world.lassoPath && engine.world.lassoPath.length > 0) {
            for (const pt of engine.world.lassoPath) {
              const td = Math.sqrt((pt.x - p.x) ** 2 + (pt.y - p.y) ** 2);
              if (td < minTrailDist) {
                minTrailDist = td;
              }
            }
          }
          
          if (minTrailDist < 55 || p.isLassoed) {
            p.isLassoed = true;
            
            // Squeeze them in towards the collapsing center!
            const pullStrength = isCollapsing ? 0.65 : 0.22;
            p.vx -= (dx / dist) * pullStrength;
            p.vy -= (dy / dist) * pullStrength;
            
            // Swirl inside the bubble
            const swirlSpeed = isCollapsing ? 0.7 : 1.5;
            p.vx += (-dy / dist) * swirlSpeed;
            p.vy += (dx / dist) * swirlSpeed;
            
            p.colorBlend = Math.max(p.colorBlend, 0.85);

            // Draw the physical individual star forcefield containment bubble!
            engine.world.ctx.beginPath();
            engine.world.ctx.arc(p.x, p.y, p.radius + 6.0, 0, Math.PI * 2);
            engine.world.ctx.strokeStyle = `rgba(0, 230, 255, ${0.45 * (0.8 + Math.sin(Date.now() / 120) * 0.2)})`;
            engine.world.ctx.lineWidth = 0.85;
            engine.world.ctx.stroke();
            
            engine.world.ctx.fillStyle = 'rgba(0, 200, 255, 0.04)';
            engine.world.ctx.fill();
          }
        }
      }

      // Sandbox Quantum Splitter spatial rifts duplication & gravity tear (while rifts exist)
      if (engine.world.quantumRifts && engine.world.quantumRifts.length > 0 && !inFormation && !inLoadingRing && !p.isDying && p.birthProgress >= 1.0) {
        for (const f of engine.world.quantumRifts) {
          const dx = f.x2 - f.x1;
          const dy = f.y2 - f.y1;
          const lenSq = dx * dx + dy * dy;
          if (lenSq < 9.0) continue; // skip tiny/zero-length segments to avoid division issues!
          
          let t = ((p.x - f.x1) * dx + (p.y - f.y1) * dy) / lenSq;
          t = Math.max(0, Math.min(1, t));
          
          const projX = f.x1 + t * dx;
          const projY = f.y1 + t * dy;
          const pullDist = Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
          
          // Spatial rift gravity: violent gravity pulling stars into the reality tear!
          if (pullDist < 120) {
            const pullForce = (120 - pullDist) / 120 * f.life * 0.55;
            p.vx += (projX - p.x) * pullForce;
            p.vy += (projY - p.y) * pullForce;
            p.colorBlend = Math.max(p.colorBlend, 0.45 * f.life);
          }
          
          // Split boundary hit: portal teleport if multiple rifts exist, else split star
          if (projX !== undefined && projY !== undefined && pullDist < 14 && p.radius >= 1.35) {
            const riftsCount = engine.world.quantumRifts.length;
            
            if (riftsCount > 1) {
              let fTarget = engine.world.quantumRifts[riftsCount - 1];
              if (fTarget === f) {
                fTarget = engine.world.quantumRifts[0];
              }
              
              const randT = Math.random();
              const targetX = fTarget.x1 + (fTarget.x2 - fTarget.x1) * randT;
              const targetY = fTarget.y1 + (fTarget.y2 - fTarget.y1) * randT;
              
              // Perpendicular ejection velocity from the exit rift
              const fTdx = fTarget.x2 - fTarget.x1;
              const fTdy = fTarget.y2 - fTarget.y1;
              const fTlen = Math.sqrt(fTdx * fTdx + fTdy * fTdy) || 1;
              
              let fTnx = -fTdy / fTlen;
              let fTny = fTdx / fTlen;
              
              if (fTlen < 3.0) {
                const randAngle = Math.random() * Math.PI * 2;
                fTnx = Math.cos(randAngle);
                fTny = Math.sin(randAngle);
              }
              
              const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 2.0;
              const launchSpeed = Math.max(9.0, Math.min(13.0, currentSpeed * 1.45));
              const side = Math.random() < 0.5 ? 1 : -1;
              
              // Play portal teleport sound effect!
              playWormholeTeleportSound();
              
              // Sparks at entry
              spawnStardustPuff(engine, p.x, p.y, p.colorPrefix);
              
              // Teleport coordinates, physically offsetting by 20px along the exit vector so it exits outside the 14px trigger threshold!
              p.x = targetX + fTnx * side * 20.0;
              p.y = targetY + fTny * side * 20.0;
              
              // Sparks at exit
              spawnStardustPuff(engine, p.x, p.y, p.colorPrefix);
              
              p.vx = fTnx * side * launchSpeed;
              p.vy = fTny * side * launchSpeed;
              p.vy = fTny * side * launchSpeed;
              
              p.colorBlend = 1.0;
              p.colorPrefix = Math.random() < 0.5 ? 'rgba(0, 240, 255,' : 'rgba(255, 0, 240,';
              
              // Draw visual arcing lightning pathway connecting the portal tears!
              engine.world.lightnings.push({
                segments: [
                  { x: projX, y: projY },
                  { x: (projX + targetX) / 2 + (Math.random() - 0.5) * 35, y: (projY + targetY) / 2 + (Math.random() - 0.5) * 35 },
                  { x: targetX, y: targetY }
                ],
                alpha: 1.0
              });
              
              engine.world.shakeTimer = Math.max(engine.world.shakeTimer, 8);
            } else {
              // Kill the parent star
              p.isDying = true;
              p.deathProgress = 1.0;
              
              // Screen shake when splitting reality!
              engine.world.shakeTimer = Math.max(engine.world.shakeTimer, 12);
              
              // Generate split copies
              const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1.5;
              const originalAngle = Math.atan2(p.vy, p.vx);
              const speed = Math.min(11.0, currentSpeed * 1.35); // accelerate child stars outwards
              
              const divergence = 0.35 + Math.random() * 0.15; // angle divergence
              const angle1 = originalAngle + divergence;
              const angle2 = originalAngle - divergence;
              
              const rScaled = p.radius * 0.65;
              const brScaled = p.baseRadius * 0.65;

              // Spawn sparks and effects
              spawnStardustPuff(engine, p.x, p.y, p.colorPrefix);
              
              // Draw lightning crack arcing from the tear point
              engine.world.lightnings.push({
                segments: [
                  { x: projX, y: projY },
                  { x: p.x + (Math.random() - 0.5) * 20, y: p.y + (Math.random() - 0.5) * 20 },
                  { x: p.x + Math.cos(angle1) * 35, y: p.y + Math.sin(angle1) * 35 }
                ],
                alpha: 1.0
              });
              
              // Check performance cap before duplicating
              if (engine.world.particles.length < getMaxParticles(engine.world) * 1.15) {
                const p1: Particle = {
                  x: p.x + Math.cos(angle1) * 8,
                  y: p.y + Math.sin(angle1) * 8,
                  vx: Math.cos(angle1) * speed,
                  vy: Math.sin(angle1) * speed,
                  baseVx: Math.cos(angle1) * p.baseVx,
                  baseVy: Math.sin(angle1) * p.baseVy,
                  radius: Math.max(0.65, rScaled),
                  baseRadius: Math.max(0.65, brScaled),
                  colorBlend: 1.0,
                  wobbleTimer: p.wobbleTimer,
                  colorPrefix: 'rgba(0, 240, 255,', // force cyan/magenta quantum neon glow!
                  flockable: p.flockable,
                  life: p.life * 0.9, // slightly shorter life
                  birthProgress: 1.0,
                  deathProgress: 0,
                  isDying: false,
                  behaviorState: p.behaviorState,
                  behaviorTimer: p.behaviorTimer,
                  speedFactor: p.speedFactor,
                  isNursery: p.isNursery,
                  isLassoed: false
                };
                
                const p2: Particle = {
                  x: p.x + Math.cos(angle2) * 8,
                  y: p.y + Math.sin(angle2) * 8,
                  vx: Math.cos(angle2) * speed,
                  vy: Math.sin(angle2) * speed,
                  baseVx: Math.cos(angle2) * p.baseVx,
                  baseVy: Math.sin(angle2) * p.baseVy,
                  radius: Math.max(0.65, rScaled),
                  baseRadius: Math.max(0.65, brScaled),
                  colorBlend: 1.0,
                  wobbleTimer: p.wobbleTimer,
                  colorPrefix: 'rgba(255, 0, 240,', // opposite split polarization!
                  flockable: p.flockable,
                  life: p.life * 0.9,
                  birthProgress: 1.0,
                  deathProgress: 0,
                  isDying: false,
                  behaviorState: p.behaviorState,
                  behaviorTimer: p.behaviorTimer,
                  speedFactor: p.speedFactor,
                  isNursery: p.isNursery,
                  isLassoed: false
                };
                
                engine.world.particles.push(p1, p2);
              }
            }
            break; // Stop checking other rifts for this particle
          }
        }
      }

      // Attract a small fraction of stars to the trigger dot when the panel is closed to hint at its existence
      if (!engine.world.isSandboxOpen && p.flockable && !p.isDying && p.birthProgress >= 1.0) {
        const triggerX = width - 41;
        const triggerY = 41;
        const dx = triggerX - p.x;
        const dy = triggerY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 380) {
          const force = (380 - dist) / 380;
          // Apply a gentle pull towards the dot
          p.vx += (dx / dist) * force * 0.16;
          p.vy += (dy / dist) * force * 0.16;
          // Apply a slight swirl
          p.vx += (-dy / dist) * force * 0.08;
          p.vy += (dx / dist) * force * 0.08;
        }
      }

      // F. Apply Nebula wave wobble
      if (p.wobbleTimer > 0) {
        p.wobbleTimer--;
        p.vx += Math.sin(p.wobbleTimer * 0.45) * 0.95;
        p.vy += Math.cos(p.wobbleTimer * 0.45) * 0.95;
      }

      // Compute Flocking forces and update speedFactor (highly optimized: no Math.sqrt)
      let flockForceX = 0;
      let flockForceY = 0;

      if (engine.world.state === 'DRIFT' && p.flockable && !p.isDying && p.birthProgress >= 1.0) {
        let cohesionX = 0;
        let cohesionY = 0;
        let alignmentVx = 0;
        let alignmentVy = 0;
        let separationX = 0;
        let separationY = 0;
        let neighborCount = 0;

        const flockRangeSq = flockRange * flockRange;
        const separationRange = 65; // subtle spacing
        const separationRangeSq = separationRange * separationRange;

        const flockNeighbors = engine.world.particleSpatialHash.queryRadius(p.x, p.y, flockRange, engine.world.spatialQueryBuffer);
        for (let n = 0; n < flockNeighbors.length; n++) {
          const j = flockNeighbors[n];
          if (i === j) continue;
          const p2 = engine.world.particles[j];
          if (!p2 || !p2.flockable || p2.isDying || p2.birthProgress < 1.0) continue;

          const dx = p2.x - p.x;
          const dy = p2.y - p.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < flockRangeSq) {
            cohesionX += p2.x;
            cohesionY += p2.y;
            alignmentVx += p2.vx;
            alignmentVy += p2.vy;
            neighborCount++;

            if (distSq < separationRangeSq) {
              const force = (separationRangeSq - distSq) / separationRangeSq;
              separationX -= (dx / (distSq + 0.1)) * force * 3.5;
              separationY -= (dy / (distSq + 0.1)) * force * 3.5;
            }
          }
        }

        if (neighborCount > 0) {
          const targetCohesionX = cohesionX / neighborCount;
          const targetCohesionY = cohesionY / neighborCount;
          const steerCohesionX = (targetCohesionX - p.x) * 0.0006 * engine.world.flockEasingFactor;
          const steerCohesionY = (targetCohesionY - p.y) * 0.0006 * engine.world.flockEasingFactor;

          const targetAlignVx = alignmentVx / neighborCount;
          const targetAlignVy = alignmentVy / neighborCount;
          const steerAlignX = (targetAlignVx - p.vx) * 0.008 * engine.world.flockEasingFactor;
          const steerAlignY = (targetAlignVy - p.vy) * 0.008 * engine.world.flockEasingFactor;

          flockForceX = steerCohesionX + steerAlignX + separationX;
          flockForceY = steerCohesionY + steerAlignY + separationY;
        }

        // Gentle border containment force to steer them back if they drift too close to the edges
        const border = 120;
        const panelWidth = width <= 600 ? 280 : 380;
        const activeWidth = engine.world.isSandboxOpen ? Math.max(100, width - panelWidth) : width;

        if (p.x < border) flockForceX += (border - p.x) * 0.0008;
        else if (p.x > activeWidth - border) flockForceX -= (p.x - (activeWidth - border)) * 0.0008;

        if (p.y < border) flockForceY += (border - p.y) * 0.0008;
        else if (p.y > height - border) flockForceY -= (p.y - (height - border)) * 0.0008;
      }

      // Update grouping and speed state
      if (engine.world.state === 'DRIFT') {
        p.behaviorTimer--;
        if (p.behaviorTimer <= 0) {
          const r = Math.random();
          if (p.behaviorState === 'CRUISE') {
            p.behaviorState = r < 0.6 ? 'DECELERATE' : 'BURST';
          } else if (p.behaviorState === 'DECELERATE') {
            p.behaviorState = r < 0.7 ? 'BURST' : 'CRUISE';
          } else { // BURST
            p.behaviorState = r < 0.7 ? 'CRUISE' : 'DECELERATE';
          }

          if (p.behaviorState === 'CRUISE') {
            p.behaviorTimer = Math.floor(Math.random() * 180) + 120;
          } else if (p.behaviorState === 'DECELERATE') {
            p.behaviorTimer = Math.floor(Math.random() * 120) + 90;
          } else { // BURST
            p.behaviorTimer = Math.floor(Math.random() * 50) + 40;
          }
        }

        let targetSpeed = 1.0;
        let lerpSpeed = 0.05;
        if (p.behaviorState === 'DECELERATE') {
          targetSpeed = 0.5;
          lerpSpeed = 0.02;
        } else if (p.behaviorState === 'BURST') {
          targetSpeed = 2.0;
          lerpSpeed = 0.08;
        }
        p.speedFactor += (targetSpeed - p.speedFactor) * lerpSpeed;
      } else {
        // Fast transition back to standard speed multiplier during mouse actions
        p.speedFactor += (1.0 - p.speedFactor) * 0.15;
      }

      // Apply Flocking forces
      p.vx += flockForceX;
      p.vy += flockForceY;

      // Cap drift speed to keep movement elegant
      if (engine.world.state === 'DRIFT') {
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
        const maxDriftSpeed = 1.6;
        if (speed > maxDriftSpeed) {
          p.vx = (p.vx / speed) * maxDriftSpeed;
          p.vy = (p.vy / speed) * maxDriftSpeed;
        }
      }

      // G. Decelerate / Spring back to base velocities (spring drag)
      if (!inFormation && !inLoadingRing) {
        const dragFactor = engine.world.state === 'DRIFT' ? 0.008 : 0.035;
        p.vx += (p.baseVx - p.vx) * dragFactor;
        p.vy += (p.baseVy - p.vy) * dragFactor;

        // Update positions
        p.x += p.vx * p.speedFactor;
        p.y += p.vy * p.speedFactor;

        const panelWidth = width <= 600 ? 280 : 380;
        const activeWidth = engine.world.isSandboxOpen ? Math.max(100, width - panelWidth) : width;

        // If the side panel is open, slide any particles behind it to the left visible area
        if (engine.world.isSandboxOpen && p.x > activeWidth) {
          p.x = Math.max(-10, p.x - 3.5);
          p.vx = Math.min(p.vx, -0.6);
        }

        // Wrap boundaries
        const padding = 20;
        if (p.x < -padding) p.x = activeWidth + padding;
        else if (p.x > activeWidth + padding) p.x = -padding;

        if (p.y < -padding) p.y = height + padding;
        else if (p.y > height + padding) p.y = -padding;

        // Decay color blend
        p.colorBlend *= 0.94;
      } else if (inFormation || inLoadingRing) {
        p.colorBlend = Math.max(p.colorBlend, inLoadingRing ? 0.75 : 0.95);
      }

      // H. Draw Node based on life cycle stage
      let currentRadius = p.radius;
      if (p.birthProgress < 1.0) {
        currentRadius = p.radius * p.birthProgress;
      } else if (p.isDying) {
        currentRadius = p.radius * (1.0 - p.deathProgress);
      }

      if ((engine.world as any).ayaHeartbeatTimer > 0) {
        let heartbeatScale = 1.0;
        const t = 50 - (engine.world as any).ayaHeartbeatTimer;
        if (t < 15) {
          heartbeatScale = 1.0 + Math.sin((t / 15) * Math.PI) * 0.35;
        } else if (t >= 22 && t < 37) {
          heartbeatScale = 1.0 + Math.sin(((t - 22) / 15) * Math.PI) * 0.22;
        }
        currentRadius *= heartbeatScale;
      }

      if (p.isHeart) {
        drawHeart(engine.world.ctx, p.x, p.y, currentRadius);
      } else {
        engine.world.ctx.beginPath();
        engine.world.ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
      }
      
      if (p.birthProgress < 1.0) {
        engine.world.ctx.fillStyle = `${p.colorPrefix}${p.birthProgress * 0.95})`;
      } else if (p.isDying) {
        engine.world.ctx.fillStyle = `rgba(255, 80, 50, ${0.9 - p.deathProgress * 0.8})`;
      } else {
        if (engine.world.state === 'DRIFT' && p.behaviorState === 'DECELERATE') {
          const pulse = (Math.sin(Date.now() / 150 + p.x) + 1.0) * 0.5;
          engine.world.ctx.fillStyle = `${p.colorPrefix}${0.8 + pulse * 0.2})`;
        } else {
          engine.world.ctx.fillStyle = p.colorBlend > 0.08 
            ? `${p.colorPrefix}0.95)` 
            : 'rgba(255, 255, 255, 0.88)';
        }
      }
      engine.world.ctx.fill();

      // Render outer glowing halo
      if (p.isHeart) {
        drawHeart(engine.world.ctx, p.x, p.y, currentRadius * 2.8);
      } else {
        engine.world.ctx.beginPath();
        engine.world.ctx.arc(p.x, p.y, currentRadius * 2.8, 0, Math.PI * 2);
      }
      if (p.birthProgress < 1.0) {
        engine.world.ctx.fillStyle = `${p.colorPrefix}${p.birthProgress * 0.22})`;
      } else if (p.isDying) {
        engine.world.ctx.fillStyle = `rgba(255, 80, 50, ${0.15 - p.deathProgress * 0.15})`;
      } else {
        if (engine.world.state === 'DRIFT' && p.behaviorState === 'DECELERATE') {
          const pulse = (Math.sin(Date.now() / 150 + p.x) + 1.0) * 0.5;
          engine.world.ctx.fillStyle = `${p.colorPrefix}${0.25 + pulse * 0.35})`;
        } else {
          engine.world.ctx.fillStyle = p.colorBlend > 0.08
            ? `${p.colorPrefix}${0.25 + p.colorBlend * 0.5})`
            : `${p.colorPrefix}${0.15 + glowAmplitude})`;
        }
      }
      engine.world.ctx.fill();

      // I. Particle mating/breeding (on close collision)
      if (!engine.world.performanceProfile.skipBreeding && !p.isDying && p.birthProgress >= 1.0) {
        const breedingRangeSq = breedingRange * breedingRange;
        const breedNeighbors = engine.world.particleSpatialHash.queryRadius(p.x, p.y, breedingRange, engine.world.spatialQueryBuffer);
        for (let n = 0; n < breedNeighbors.length; n++) {
          const j = breedNeighbors[n];
          if (j >= i) continue;
          const p2 = engine.world.particles[j];
          if (p2.isDying || p2.birthProgress < 1.0) continue;

          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < breedingRangeSq) {
            if (Math.random() < 0.005) {
              const mx = (p.x + p2.x) / 2;
              const my = (p.y + p2.y) / 2;
              spawnStellarBirth(engine, mx, my);
              spawnStardustPuff(engine, mx, my, 'rgba(255, 100, 230,');
            }
          }
        }
      }

      // J. Render constellation links
      let linksDrawn = 0;
      const linkNeighbors = engine.world.particleSpatialHash.queryRadius(p.x, p.y, meshConnectionDist, engine.world.spatialQueryBuffer);
      for (let n = 0; n < linkNeighbors.length; n++) {
        const j = linkNeighbors[n];
        if (j >= i) continue;
        if (intenseMesh && linksDrawn >= COSMIC_CONSTANTS.MAX_LINKS_INTENSE) {
          break;
        }
        const p2 = engine.world.particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < meshLimitSq) {
          const dist = Math.sqrt(distSq);
          
          let baseAlphaCoeff = engine.world.state === 'DRIFT' ? 0.16 : 0.35;
          if (engine.world.state === 'MOON_DANCE') {
            baseAlphaCoeff = 0.50; // extra glow for the cosmic whirlpool mesh
          }
          let alpha = (1 - dist / meshConnectionDist) * baseAlphaCoeff;
          if ((engine.world.state === 'SWARM' || engine.world.state === 'CHARGING') && isMouseGravityActive(engine)) {
            alpha *= 1.45;
          } else if (engine.world.state === 'DRIFT' && p.behaviorState === 'DECELERATE' && p2.behaviorState === 'DECELERATE') {
            alpha *= 1.25;
          }

          if (p.isDying) alpha *= (1.0 - p.deathProgress);
          if (p2.isDying) alpha *= (1.0 - p2.deathProgress);

          if (alpha > 0.01) {
            engine.world.ctx.beginPath();
            engine.world.ctx.moveTo(p.x, p.y);
            engine.world.ctx.lineTo(p2.x, p2.y);
            
            const maxBlend = Math.max(p.colorBlend, p2.colorBlend);
            let strokeStyle = '';
            let lineWidth = 0.6;

            if (maxBlend > 0.08) {
              strokeStyle = `${p.colorPrefix}${alpha * (0.5 + maxBlend * 0.5)})`;
              lineWidth = 1.15;
            } else if (engine.world.state === 'DRIFT' && p.behaviorState === 'DECELERATE' && p2.behaviorState === 'DECELERATE') {
              strokeStyle = `${p.colorPrefix}${alpha * 0.95})`;
              lineWidth = 1.0;
            } else {
              strokeStyle = `${p.colorPrefix}${alpha * 0.55})`;
              lineWidth = 0.6;
            }
              
            engine.world.ctx.strokeStyle = strokeStyle;
            engine.world.ctx.lineWidth = lineWidth;
            engine.world.ctx.stroke();
            linksDrawn++;
          }
        }
      }

      // Draw gravity attraction beams (SWARM / CHARGING when cursor gravity is active)
      if ((engine.world.state === 'SWARM' || engine.world.state === 'CHARGING') && isMouseGravityActive(engine)) {
        const dx = p.x - engine.world.mouse.x;
        const dy = p.y - engine.world.mouse.y;
        const distSq = dx * dx + dy * dy;
        const activeAttractDist = engine.world.state === 'CHARGING'
          ? (COSMIC_CONSTANTS.MOUSE_ATTRACT_DISTANCE + chargeProgress * 240)
          : COSMIC_CONSTANTS.MOUSE_ATTRACT_DISTANCE;
        const mLimitSq = activeAttractDist * activeAttractDist;

        if (distSq < mLimitSq) {
          const dist = Math.sqrt(distSq);
          let alpha = (1 - dist / activeAttractDist) * 0.45;
          if (p.isDying) alpha *= (1.0 - p.deathProgress);

          if (alpha > 0.01) {
            engine.world.ctx.beginPath();
            engine.world.ctx.moveTo(p.x, p.y);
            engine.world.ctx.lineTo(engine.world.mouse.x, engine.world.mouse.y);
            
            engine.world.ctx.strokeStyle = engine.world.state === 'CHARGING'
              ? `rgba(0, 240, 255, ${alpha * (0.55 + chargeProgress * 0.45)})`
              : `rgba(0, 230, 255, ${alpha * (0.55 + glowAmplitude * 0.4)})`;
              
            engine.world.ctx.lineWidth = engine.world.state === 'CHARGING' ? 1.25 : 1.0;
            engine.world.ctx.stroke();
          }
        }
      } else if (engine.world.activePower === 'REPELLER' && isSandboxPowerChannelActive(engine) && engine.world.mouse.active && engine.world.mouse.x !== -1000) {
        const charge = engine.world.isMouseDown ? getSandboxChargeProgress(engine) : 0.2;
        const repelRadius = 220 + charge * 220;
        const dx = p.x - engine.world.mouse.x;
        const dy = p.y - engine.world.mouse.y;
        const distSq = dx * dx + dy * dy;
        const repelLimitSq = repelRadius * repelRadius;

        if (distSq < repelLimitSq && distSq > 1) {
          const dist = Math.sqrt(distSq);
          let alpha = (1 - dist / repelRadius) * 0.32;
          if (p.isDying) alpha *= (1.0 - p.deathProgress);

          if (alpha > 0.01) {
            const pushX = p.x + (dx / dist) * 18;
            const pushY = p.y + (dy / dist) * 18;
            engine.world.ctx.beginPath();
            engine.world.ctx.moveTo(p.x, p.y);
            engine.world.ctx.lineTo(pushX, pushY);
            engine.world.ctx.strokeStyle = `rgba(255, 120, 190, ${alpha})`;
            engine.world.ctx.lineWidth = 1.0;
            engine.world.ctx.stroke();
          }
        }
      } else if (engine.world.activePower === 'TIME_DILATION' && engine.world.mouse.active && engine.world.mouse.x !== -1000) {
        const charge = engine.world.isMouseDown ? getSandboxChargeProgress(engine) : 0.25;
        const wellRadius = 180 + charge * 180;
        const dx = engine.world.mouse.x - p.x;
        const dy = engine.world.mouse.y - p.y;
        const distSq = dx * dx + dy * dy;
        const wellLimitSq = wellRadius * wellRadius;

        if (distSq < wellLimitSq && distSq > 1) {
          const dist = Math.sqrt(distSq);
          let alpha = (1 - dist / wellRadius) * 0.32;
          if (p.isDying) alpha *= (1.0 - p.deathProgress);

          if (alpha > 0.01) {
            const pullX = p.x + (dx / dist) * 12;
            const pullY = p.y + (dy / dist) * 12;
            engine.world.ctx.beginPath();
            engine.world.ctx.moveTo(p.x, p.y);
            engine.world.ctx.lineTo(pullX, pullY);
            engine.world.ctx.strokeStyle = `rgba(120, 220, 255, ${alpha})`;
            engine.world.ctx.lineWidth = 1.0;
            engine.world.ctx.stroke();
          }
        }
      }

      // Draw connection vectors for persistent Chrono Wells
      for (const cw of engine.world.sandboxChronoWells) {
        const cwRadius = cw.radius;
        const dx = cw.x - p.x;
        const dy = cw.y - p.y;
        const distSq = dx * dx + dy * dy;
        const wellLimitSq = cwRadius * cwRadius;

        if (distSq < wellLimitSq && distSq > 1) {
          const dist = Math.sqrt(distSq);
          let alpha = (1 - dist / cwRadius) * 0.28 * (cw.radius / cw.maxRadius);
          if (p.isDying) alpha *= (1.0 - p.deathProgress);

          if (alpha > 0.01) {
            const pullX = p.x + (dx / dist) * 12;
            const pullY = p.y + (dy / dist) * 12;
            engine.world.ctx.beginPath();
            engine.world.ctx.moveTo(p.x, p.y);
            engine.world.ctx.lineTo(pullX, pullY);
            engine.world.ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
            engine.world.ctx.lineWidth = 1.0;
            engine.world.ctx.stroke();
          }
        }
      }

      // K. Connect particles to UI element anchors
      const aLength = engine.world.uiAnchors.length;
      for (let j = 0; j < aLength; j++) {
        const anchor = engine.world.uiAnchors[j];
        const dx = p.x - anchor.x;
        const dy = p.y - anchor.y;
        const distSq = dx * dx + dy * dy;
        const anchorLimitSq = 100 * 100;

        if (distSq < anchorLimitSq) {
          const dist = Math.sqrt(distSq);
          let alpha = (1 - dist / 100) * 0.20;
          
          if (p.isDying) alpha *= (1.0 - p.deathProgress);
          
          // Boost opacity if mouse is near the UI element
          const mdx = engine.world.mouse.x - anchor.x;
          const mdy = engine.world.mouse.y - anchor.y;
          if (Math.sqrt(mdx * mdx + mdy * mdy) < 220) {
            alpha *= 1.8;
          }

          if (alpha > 0.01) {
            engine.world.ctx.beginPath();
            engine.world.ctx.moveTo(p.x, p.y);
            engine.world.ctx.lineTo(anchor.x, anchor.y);
            
            engine.world.ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
            engine.world.ctx.lineWidth = 0.65;
            engine.world.ctx.stroke();
          }
        }
      }
    }
}
