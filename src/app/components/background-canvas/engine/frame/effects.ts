import { COSMIC_CONSTANTS } from '../../models/cosmic.constants';
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
import { drawHeart, drawCosmicBlackHole } from './shared';

export function renderEffects(engine: CosmicCanvasEngine, width: number, height: number): void {
    // 6. Render Active Singularity / Moon Corona
    if (engine.world.state === 'SINGULARITY') {
      const progress = (25 - engine.world.stateTimer) / 25;
      drawCosmicBlackHole(
        engine.world.ctx,
        engine.world.singularity.x,
        engine.world.singularity.y,
        progress * 24,
        progress
      );
    } else if (engine.world.state === 'MOON_DANCE') {
      const t = Math.min(1.0, (390 - engine.world.stateTimer) / 300);
      const maxRadius = 150 + t * 130 + Math.sin(Date.now() / 80) * 12;
      const alpha = Math.min(0.85, t * 0.85);

      const grad = engine.world.ctx.createRadialGradient(
        engine.world.singularity.x, engine.world.singularity.y, 10,
        engine.world.singularity.x, engine.world.singularity.y, maxRadius
      );

      if (engine.world.isAyaDanceActive) {
        grad.addColorStop(0, `rgba(255, 240, 248, ${alpha * 0.95})`);
        grad.addColorStop(0.25, `rgba(255, 120, 180, ${alpha * 0.75})`);
        grad.addColorStop(0.55, `rgba(255, 60, 140, ${alpha * 0.38})`);
        grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      } else {
        grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`);
        grad.addColorStop(0.25, `rgba(0, 240, 255, ${alpha * 0.6})`);
        grad.addColorStop(0.55, `rgba(255, 100, 230, ${alpha * 0.28})`);
        grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      }

      engine.world.ctx.fillStyle = grad;
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(engine.world.singularity.x, engine.world.singularity.y, maxRadius, 0, Math.PI * 2);
      engine.world.ctx.fill();
    }

    // 7. Render active lightning bolt graphics (capped to 18 max to prevent CPU congestion)
    if (engine.world.lightnings.length > 18) {
      engine.world.lightnings = engine.world.lightnings.slice(-18);
    }
    for (let i = engine.world.lightnings.length - 1; i >= 0; i--) {
      const l = engine.world.lightnings[i];
      l.alpha -= 0.12;

      if (l.alpha <= 0) {
        engine.world.lightnings.splice(i, 1);
        continue;
      }

      engine.world.ctx.beginPath();
      engine.world.ctx.moveTo(l.segments[0].x, l.segments[0].y);
      for (let j = 1; j < l.segments.length; j++) {
        engine.world.ctx.lineTo(l.segments[j].x, l.segments[j].y);
      }
      engine.world.ctx.strokeStyle = engine.world.isAyaDanceActive
        ? `rgba(255, 100, 180, ${l.alpha * 0.9})`
        : `rgba(255, 120, 240, ${l.alpha * 0.85})`;
      engine.world.ctx.lineWidth = 2.2;
      engine.world.ctx.stroke();

      engine.world.ctx.strokeStyle = engine.world.isAyaDanceActive
        ? `rgba(255, 180, 220, ${l.alpha * 0.45})`
        : `rgba(0, 230, 255, ${l.alpha * 0.4})`;
      engine.world.ctx.lineWidth = 4.5;
      engine.world.ctx.stroke();
    }

    // 8. Render active expanding shockwaves
    for (let i = engine.world.shockwaves.length - 1; i >= 0; i--) {
      const s = engine.world.shockwaves[i];
      s.radius += s.speed;
      s.alpha = 1 - (s.radius / s.maxRadius);

      if (s.alpha <= 0) {
        engine.world.shockwaves.splice(i, 1);
        continue;
      }

      // Check if shockwave hits planets and shatters them
      for (const pl of engine.world.sandboxPlanets) {
        if (!pl.isDying) {
          const dx = pl.x - s.x;
          const dy = pl.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < s.radius && dist > s.radius - s.speed * 2) {
            shatterPlanet(engine, pl);
          }
        }
      }

      engine.world.ctx.beginPath();
      engine.world.ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(${s.color}, ${s.alpha * 0.45})`;
      engine.world.ctx.lineWidth = 3.0;
      engine.world.ctx.stroke();

      engine.world.ctx.beginPath();
      engine.world.ctx.arc(s.x, s.y, s.radius * 0.82, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(255, 100, 230, ${s.alpha * 0.15})`;
      engine.world.ctx.lineWidth = 1.5;
      engine.world.ctx.stroke();
    }

    // 9. Render cursor sparks (supernova debris particles)
    for (let i = engine.world.sparks.length - 1; i >= 0; i--) {
      const sp = engine.world.sparks[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.alpha -= 0.022; // slightly slower fade for hearts / click sparks to linger

      if (sp.alpha <= 0) {
        engine.world.sparks.splice(i, 1);
        continue;
      }

      if ((sp as any).isHeart) {
        engine.world.ctx.save();
        engine.world.ctx.translate(sp.x, sp.y);
        if ((sp as any).rotation !== undefined) {
          engine.world.ctx.rotate((sp as any).rotation);
        }
        const r = sp.radius;

        // Core heart
        engine.world.ctx.beginPath();
        engine.world.ctx.moveTo(0, -r * 0.3);
        engine.world.ctx.bezierCurveTo(-r / 2, -r, -r, -r * 0.7, -r, 0);
        engine.world.ctx.bezierCurveTo(-r, r * 0.6, -r / 3, r * 1.0, 0, r * 1.35);
        engine.world.ctx.bezierCurveTo(r / 3, r * 1.0, r, r * 0.6, r, 0);
        engine.world.ctx.bezierCurveTo(r, -r * 0.7, r / 2, -r, 0, -r * 0.3);
        engine.world.ctx.closePath();
        engine.world.ctx.fillStyle = `${sp.color}${sp.alpha})`;
        engine.world.ctx.fill();

        // Glow heart halo
        engine.world.ctx.beginPath();
        const hr = r * 1.7;
        engine.world.ctx.moveTo(0, -hr * 0.3);
        engine.world.ctx.bezierCurveTo(-hr / 2, -hr, -hr, -hr * 0.7, -hr, 0);
        engine.world.ctx.bezierCurveTo(-hr, hr * 0.6, -hr / 3, hr * 1.0, 0, hr * 1.35);
        engine.world.ctx.bezierCurveTo(hr / 3, hr * 1.0, hr, hr * 0.6, hr, 0);
        engine.world.ctx.bezierCurveTo(hr, -hr * 0.7, hr / 2, -hr, 0, -hr * 0.3);
        engine.world.ctx.closePath();
        engine.world.ctx.fillStyle = `${sp.color}${sp.alpha * 0.25})`;
        engine.world.ctx.fill();

        engine.world.ctx.restore();

        if ((sp as any).rotation !== undefined && (sp as any).rotSpeed !== undefined) {
          (sp as any).rotation += (sp as any).rotSpeed;
        }
      } else {
        engine.world.ctx.beginPath();
        engine.world.ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
        engine.world.ctx.fillStyle = `${sp.color}${sp.alpha})`;
        engine.world.ctx.fill();

        engine.world.ctx.beginPath();
        engine.world.ctx.arc(sp.x, sp.y, sp.radius * 2.5, 0, Math.PI * 2);
        engine.world.ctx.fillStyle = `${sp.color}${sp.alpha * 0.25})`;
        engine.world.ctx.fill();
      }
    }

    // 9.5. Spawn, Update & Render Background Blackholes (Spontaneous cosmic events)
    if (engine.world.state === 'DRIFT' && engine.world.backgroundBlackholes.length < 2 && Math.random() < 0.00015) {
      engine.world.backgroundBlackholes.push({
        x: Math.random() * (width - 240) + 120,
        y: Math.random() * (height - 240) + 120,
        radius: 0,
        maxRadius: Math.random() * 6 + 10,
        timer: 240,
        maxTimer: 240
      });
    }

    for (let k = engine.world.backgroundBlackholes.length - 1; k >= 0; k--) {
      const bh = engine.world.backgroundBlackholes[k];
      bh.timer--;
      if (bh.timer <= 0) {
        engine.world.backgroundBlackholes.splice(k, 1);
        continue;
      }

      const elapsed = bh.maxTimer - bh.timer;
      if (elapsed < 50) {
        bh.radius = bh.maxRadius * (elapsed / 50);
      } else if (bh.timer < 50) {
        bh.radius = bh.maxRadius * (bh.timer / 50);
      } else {
        bh.radius = bh.maxRadius;
      }

      const bhRadius = bh.radius;
      for (let j = 0; j < engine.world.particles.length; j++) {
        const p = engine.world.particles[j];
        if (!p || p.isDying || p.birthProgress < 1.0) continue;

        const dx = bh.x - p.x;
        const dy = bh.y - p.y;
        const distSq = dx * dx + dy * dy;
        const pullDist = 110;

        if (distSq < pullDist * pullDist) {
          const dist = Math.sqrt(distSq) || 1;
          const force = (pullDist - dist) / pullDist;
          const pullStrength = force * 0.11;

          p.vx += (dx / dist) * pullStrength * 0.45;
          p.vy += (dy / dist) * pullStrength * 0.45;
          p.vx += (-dy / dist) * pullStrength * 0.25;
          p.vy += (dx / dist) * pullStrength * 0.25;

          if (dist < bhRadius + 2) {
            p.isDying = true;
            p.deathProgress = 1.0;
            spawnMiniSupernova(engine, bh.x, bh.y, p.colorPrefix);
          }
        }
      }

      drawCosmicBlackHole(
        engine.world.ctx,
        bh.x,
        bh.y,
        bhRadius,
        bh.radius / bh.maxRadius
      );
    }
}
