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
import { drawHeart } from './shared';

export function renderBackground(engine: CosmicCanvasEngine, width: number, height: number): void {
    engine.world.ctx.clearRect(0, 0, width, height);

    // 1. Draw Nebula Clouds Backdrop (Slow breathing drift)
    const nLength = engine.world.nebulas.length;
    for (let i = 0; i < nLength; i++) {
      const neb = engine.world.nebulas[i];
      neb.x = neb.baseX + Math.sin(Date.now() / 15000 + neb.phase) * 60;
      neb.y = neb.baseY + Math.cos(Date.now() / 15000 + neb.phase) * 40;

      const lCoords = getLensedCoords(engine, neb.x, neb.y);
      const opacity = neb.maxOpacity * (0.75 + Math.sin(Date.now() / 10000 + neb.phase) * 0.25);
      const currentRadius = neb.radius * (0.92 + Math.sin(Date.now() / 12000 + neb.scalePhase) * 0.08);

      const grad = engine.world.ctx.createRadialGradient(lCoords.x, lCoords.y, 0, lCoords.x, lCoords.y, currentRadius);
      grad.addColorStop(0, `rgba(${neb.colorBase}, ${opacity})`);
      grad.addColorStop(0.5, `rgba(${neb.colorBase}, ${opacity * 0.45})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      engine.world.ctx.fillStyle = grad;
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(lCoords.x, lCoords.y, currentRadius, 0, Math.PI * 2);
      engine.world.ctx.fill();
    }

    // 1.5. Draw rotating background galaxies
    engine.world.galaxyFrameTick++;
    const galaxyStride = engine.world.performanceProfile.galaxyUpdateStride;
    const gLength = engine.world.backgroundGalaxies.length;
    for (let i = 0; i < gLength; i++) {
      const g = engine.world.backgroundGalaxies[i];
      if (engine.world.galaxyFrameTick % galaxyStride === 0) {
        g.rotation += g.rotationSpeed * galaxyStride;
      }
      drawGalaxy(engine, g);
    }

    // 2. Draw Twinkling Background Starfield
    const bLength = engine.world.backgroundStars.length;
    for (let i = 0; i < bLength; i++) {
      const star = engine.world.backgroundStars[i];
      star.phase += star.twinkleSpeed;
      const twinkleOpacity = 0.12 + (Math.sin(star.phase) + 1.0) * 0.5 * 0.48;

      const lCoords = getLensedCoords(engine, star.x, star.y);
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(lCoords.x, lCoords.y, star.radius, 0, Math.PI * 2);
      engine.world.ctx.fillStyle = `${star.color}${twinkleOpacity})`;
      engine.world.ctx.fill();

      // Pulsars / Variable Stars pulsating ring echoes
      if (star.isPulsar && !engine.world.performanceProfile.skipPulsarRings) {
        star.pulsarPhase += 0.022;
        const pulseRadius = star.radius * (2.2 + Math.sin(star.pulsarPhase) * 1.3);
        const pulseOpacity = (0.5 - Math.sin(star.pulsarPhase) * 0.5) * 0.15 * twinkleOpacity;
        engine.world.ctx.beginPath();
        engine.world.ctx.arc(lCoords.x, lCoords.y, pulseRadius, 0, Math.PI * 2);
        engine.world.ctx.strokeStyle = `${star.color}${pulseOpacity})`;
        engine.world.ctx.lineWidth = 0.8;
        engine.world.ctx.stroke();
      }
    }

    // 3. Draw Parallax Space Dust (Drifting debris)
    const dLength = engine.world.spaceDust.length;
    for (let i = 0; i < dLength; i++) {
      const d = engine.world.spaceDust[i];
      d.x += d.vx;
      d.y += d.vy;

      // wrap boundaries
      if (d.x < -10) d.x = width + 10;
      else if (d.x > width + 10) d.x = -10;
      if (d.y < -10) d.y = height + 10;
      else if (d.y > height + 10) d.y = -10;

      const lCoords = getLensedCoords(engine, d.x, d.y);
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(lCoords.x, lCoords.y, d.radius, 0, Math.PI * 2);
      engine.world.ctx.fillStyle = `rgba(130, 180, 255, ${d.opacity})`;
      engine.world.ctx.fill();
    }

    // 4. Meteor Shower Queue & Random Shooting Star Spawns
    if (engine.world.shootingStars.length < 6) {
      if (engine.world.meteorShowerCount === 0 && Math.random() < 0.0006) {
        engine.world.meteorShowerCount = Math.floor(Math.random() * 5) + 4;
        engine.world.meteorShowerDelay = 0;
      }

      if (engine.world.meteorShowerCount > 0) {
        engine.world.meteorShowerDelay--;
        if (engine.world.meteorShowerDelay <= 0) {
          const prefixList = ['255, 255, 255,', '0, 230, 255,', '255, 100, 230,'];
          const colorPrefix = prefixList[Math.floor(Math.random() * prefixList.length)];
          engine.world.shootingStars.push({
            x: Math.random() * width + width * 0.2,
            y: Math.random() * height * 0.2,
            vx: -Math.random() * 9 - 9,
            vy: Math.random() * 4.5 + 4.5,
            length: Math.random() * 85 + 45,
            alpha: 1.0,
            colorPrefix
          });
          engine.world.meteorShowerCount--;
          engine.world.meteorShowerDelay = Math.floor(Math.random() * 20) + 8;
        }
      }

      if (engine.world.meteorShowerCount === 0 && Math.random() < 0.004) {
        const prefixList = ['255, 255, 255,', '0, 230, 255,'];
        const colorPrefix = prefixList[Math.floor(Math.random() * prefixList.length)];
        engine.world.shootingStars.push({
          x: Math.random() * width + width * 0.15,
          y: Math.random() * height * 0.25,
          vx: -Math.random() * 8 - 8,
          vy: Math.random() * 4 + 4,
          length: Math.random() * 80 + 40,
          alpha: 1.0,
          colorPrefix
        });
      }
    }

    for (let i = engine.world.shootingStars.length - 1; i >= 0; i--) {
      const s = engine.world.shootingStars[i];
      s.x += s.vx;
      s.y += s.vy;
      s.alpha -= 0.014;

      if (s.x < -s.length || s.y > height + s.length || s.alpha <= 0) {
        engine.world.shootingStars.splice(i, 1);
      } else {
        const grad = engine.world.ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 3.5, s.y - s.vy * 3.5);
        grad.addColorStop(0, `rgba(255, 255, 255, ${s.alpha * 0.95})`);
        grad.addColorStop(0.3, `rgba(${s.colorPrefix}${s.alpha * 0.65})`);
        grad.addColorStop(1, `rgba(${s.colorPrefix}0)`);

        engine.world.ctx.strokeStyle = grad;
        engine.world.ctx.lineWidth = 1.8;
        engine.world.ctx.beginPath();
        engine.world.ctx.moveTo(s.x, s.y);
        engine.world.ctx.lineTo(s.x - s.vx * 3.5, s.y - s.vy * 3.5);
        engine.world.ctx.stroke();
      }
    }

    // 4.5. Draw Background Comets
    updateAndDrawComets(engine, width, height);

    // --- COSMIC EVENT BLACKOUT BACKGROUND OVERLAY ---
    if (engine.world.blackoutAlpha > 0) {
      engine.world.ctx.fillStyle = `rgba(0, 0, 0, ${engine.world.blackoutAlpha})`;
      engine.world.ctx.fillRect(0, 0, width, height);
    }
}
