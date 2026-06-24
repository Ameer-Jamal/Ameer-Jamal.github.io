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

import { isSandboxPowerChannelActive, isMouseGravityActive, usesDefaultMouseGravity, transitionTo, triggerRandomStopAction, blastParticlesAway } from './state-machine';
import { spawnStellarBirth, spawnNurseryStar, spawnStardustPuff, spawnMiniSupernova, isIntenseParticleMesh, findRandomNearbyParticle } from './particle-system';
import { drawMiniChargeArc, spawnEasterEggConstellation, drawEasterEggs } from './effects';
import { drawGalaxy, updateAndDrawComets, getLensedCoords, updateUIAnchors } from './background-layers';
import { endLogoBlackhole } from './logo-easter-egg';
import { beginAyaFormation, drawFormationLinks, endAyaFormation, tickAyaFormation } from './aya-formation';
import { drawLoadingRingLinks, tickLoadingSpinner, tryCompleteLoading } from './loading-spinner';
import { applyPageExplodeFrame, collectPageExplodeElements } from './page-explode-targets';
import { getSandboxChargeProgress, tickSandboxCharge, drawSandboxPowerChargeAuras, applyBlackHolePreviewGravity, tryWormholeCapture, applyWormholeForcesToParticle, applySandboxBlackholeForces, tickTeslaHoldZaps, updateAndDrawSandboxElements } from './sandbox-powers';

export function draw(engine: CosmicCanvasEngine): void {
    const width = engine.world.canvasWidth || window.innerWidth;
    const height = engine.world.canvasHeight || window.innerHeight;

    // Auto close sandbox if website article modal is opened
    if (typeof document !== 'undefined' && document.body.classList.contains('is-article-visible')) {
      engine.world.isSandboxOpen = false;
    }

    // Slowly ease in the flocking strength when returning to DRIFT state
    if (engine.world.state === 'DRIFT') {
      engine.world.flockEasingFactor += (1.0 - engine.world.flockEasingFactor) * 0.007; // Eases over ~4 seconds
    } else {
      engine.world.flockEasingFactor = 0.0;
    }

    // --- UPDATE UI TEXT ANCHORS ---
    updateUIAnchors(engine);

    // --- PAGE ELEMENTS EXPLOSION ---
    if (engine.world.pageExplodeActive) {
      try {
        const elapsed = Date.now() - engine.world.pageExplodeStartTime;
        const explodeDuration = engine.world.isAyaDanceActive
          ? COSMIC_CONSTANTS.PAGE_EXPLODE_DURATION_MS * 1.5
          : COSMIC_CONSTANTS.PAGE_EXPLODE_DURATION_MS;
        const progress = Math.min(1.0, elapsed / explodeDuration);
        engine.world.pageExplodeTimer = Math.floor(progress * 120);

        const len = engine.world.logoElements.length;
        for (let i = 0; i < len; i++) {
          const htmlEl = engine.world.logoElements[i];
          const orig = engine.world.logoOrigPositions[i];
          if (!htmlEl || !orig) continue;

          applyPageExplodeFrame(htmlEl, orig, progress, i);
        }

        if (progress >= 1.0) {
          engine.world.pageExplodeActive = false;
          if (!engine.world.isAyaDanceActive) {
            endLogoBlackhole(engine);
          }
          // Aya: leave logo/text exploded and hidden for the whole formation;
          // they are reassembled together at the end via endAyaDance.
        }
      } catch (e) {
        console.warn('[LogoBlackhole] Page elements explosion frame error:', e);
      }
    }

    // --- STATE MACHINE ENGINE TICK ---
    if (engine.world.inversionNovaTimer > 0) {
      engine.world.inversionNovaTimer--;
    }
    if (engine.world.wormholeHypergateTimer > 0) {
      engine.world.wormholeHypergateTimer--;
    }
    if (engine.world.mouseGravityPauseTimer > 0) {
      engine.world.mouseGravityPauseTimer--;
    }

    if (engine.world.state === 'SWARM') {
      if (engine.world.activePower === 'DEFAULT' && !engine.world.isMouseDown && engine.world.mouse.active && engine.world.mouseMoving) {
        if (Date.now() - engine.world.lastMoveTime > 220) {
          triggerRandomStopAction(engine);
          engine.world.mouseMoving = false;
        }
      }
    } else if (engine.world.state === 'SINGULARITY') {
      engine.world.stateTimer--;
      if (engine.world.stateTimer <= 0) {
        transitionTo(engine, 'EXPLODING');
        
        // Blast all particles outwards with huge speed and chaos!
        blastParticlesAway(engine, engine.world.singularity.x, engine.world.singularity.y, 18.0);
        spawnEasterEggConstellation(engine, engine.world.singularity.x, engine.world.singularity.y);
        
        // Add shockwaves
        const waveColor = '0, 240, 255';
        engine.world.shockwaves.push({
          x: engine.world.singularity.x,
          y: engine.world.singularity.y,
          radius: 0,
          maxRadius: COSMIC_CONSTANTS.EXPLOSION_RADIUS * 0.95,
          speed: 8.5,
          alpha: 1.0,
          color: waveColor
        });
        engine.world.shakeTimer = 15;
      }
    } else if (engine.world.state === 'MOON_DANCE') {
      engine.world.stateTimer--;
      engine.world.logoBlackholeTimer++;

      // Gradually fade out background space environment into black
      if (engine.world.stateTimer > 90) {
        const blackoutTarget = engine.world.isAyaDanceActive ? 0.98 : 0.96;
        engine.world.blackoutAlpha = Math.min(blackoutTarget, ((390 - engine.world.stateTimer) / 300) * blackoutTarget);
      } else {
        engine.world.blackoutAlpha = engine.world.isAyaDanceActive ? 0.98 : 0.96;
        
        // Phase 2: Rapid logo trembling and pulsing
        if (!engine.world.performanceProfile.skipDomTremble) {
          const logoEl = document.querySelector('.logo') as HTMLElement;
          if (logoEl) {
            const pulseFactor = 1.35 + Math.sin(engine.world.stateTimer * 0.45) * 0.15;
            const trembleX = (Math.random() - 0.5) * 4;
            const trembleY = (Math.random() - 0.5) * 4;
            logoEl.style.transform = `scale(${pulseFactor}) translate3d(${trembleX}px, ${trembleY}px, 0)`;
          }
        }
        
        // Tremble screen
        engine.world.shakeTimer = Math.max(engine.world.shakeTimer, 3);

        // Convergence cosmic lightning discharges
        if (Math.random() < 0.35 * engine.world.performanceProfile.effectScale) {
          const startFromLeft = Math.random() > 0.5;
          const startX = startFromLeft ? 0 : window.innerWidth;
          const startY = Math.random() * window.innerHeight;
          
          const segments = [];
          const steps = 6;
          for (let s = 0; s <= steps; s++) {
            const pct = s / steps;
            const baseOffset = 45 * (1 - pct);
            const ox = (s === 0 || s === steps) ? 0 : (Math.random() - 0.5) * baseOffset;
            const oy = (s === 0 || s === steps) ? 0 : (Math.random() - 0.5) * baseOffset;
            segments.push({
              x: startX + (engine.world.singularity.x - startX) * pct + ox,
              y: startY + (engine.world.singularity.y - startY) * pct + oy
            });
          }
          engine.world.lightnings.push({ segments, alpha: 1.0 });
        }
      }

      if (engine.world.stateTimer <= 0) {
        if (engine.world.isAyaDanceActive) {
          engine.world.screenFlash = 18;

          for (const p of engine.world.particles) {
            p.birthProgress = 1.0;
            p.colorBlend = 1.0;
            p.colorPrefix = 'rgba(255, 100, 180,';
          }

          blastParticlesAway(engine, engine.world.singularity.x, engine.world.singularity.y, 52.0);

          const pinkShockwaves = [
            { x: engine.world.singularity.x, y: engine.world.singularity.y, radius: 0, maxRadius: COSMIC_CONSTANTS.EXPLOSION_RADIUS * 3.8, speed: 24.0, alpha: 1.0, color: '255, 220, 240' },
            { x: engine.world.singularity.x, y: engine.world.singularity.y, radius: 0, maxRadius: COSMIC_CONSTANTS.EXPLOSION_RADIUS * 3.2, speed: 18.0, alpha: 0.95, color: '255, 120, 180' },
            { x: engine.world.singularity.x, y: engine.world.singularity.y, radius: 0, maxRadius: COSMIC_CONSTANTS.EXPLOSION_RADIUS * 2.6, speed: 14.0, alpha: 0.88, color: '255, 80, 160' },
            { x: engine.world.singularity.x, y: engine.world.singularity.y, radius: 0, maxRadius: COSMIC_CONSTANTS.EXPLOSION_RADIUS * 2.0, speed: 10.0, alpha: 0.78, color: '255, 160, 200' }
          ];
          const shockwaveCount = Math.max(1, Math.floor(pinkShockwaves.length * engine.world.performanceProfile.effectScale));
          for (let w = 0; w < shockwaveCount; w++) {
            engine.world.shockwaves.push(pinkShockwaves[w]);
          }

          const sparkCount = Math.floor(280 * engine.world.performanceProfile.effectScale);
          for (let k = 0; k < sparkCount; k++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 20.0 + 4.5;
            engine.world.sparks.push({
              x: engine.world.singularity.x,
              y: engine.world.singularity.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              radius: Math.random() * 3.2 + 1.2,
              alpha: 1.0,
              color: k % 3 === 0 ? 'rgba(255, 150, 200,' : k % 3 === 1 ? 'rgba(255, 100, 180,' : 'rgba(255, 200, 220,'
            });
          }

          engine.world.shakeTimer = 90;

          const logoEl = document.querySelector('.logo') as HTMLElement;
          const logoImg = document.querySelector('.logoImg') as HTMLElement;
          if (logoEl) {
            logoEl.classList.remove('logo-aya-transform');
            logoEl.classList.add('logo-aya-explode');
          }
          if (logoImg) {
            logoImg.classList.remove('logo-aya-transform-img');
            logoImg.classList.add('logo-aya-explode');
          }

          collectPageExplodeElements(
            engine,
            engine.world.singularity.x,
            engine.world.singularity.y,
            { includeLogo: false }
          );
          engine.world.pageExplodeActive = true;
          engine.world.pageExplodeTimer = 0;
          engine.world.pageExplodeStartTime = Date.now();

          beginAyaFormation(engine);
        } else {
        transitionTo(engine, 'EXPLODING');
        engine.world.stateTimer = 240;
        engine.world.screenFlash = 14;

        // Reset particle birth progress and blend so they are bright and flash out on explosion
        for (const p of engine.world.particles) {
          p.birthProgress = 1.0;
          p.colorBlend = 1.0;
        }

        // Blast all particles outwards with hyper kinetic speed (Big Bang)
        blastParticlesAway(engine, engine.world.singularity.x, engine.world.singularity.y, 45.0);
        const constellationCount = 1 + Math.floor(2 * engine.world.performanceProfile.effectScale);
        spawnEasterEggConstellation(engine, engine.world.singularity.x, engine.world.singularity.y);
        if (constellationCount >= 2) {
          spawnEasterEggConstellation(engine, engine.world.singularity.x - 100, engine.world.singularity.y + 100);
        }
        if (constellationCount >= 3) {
          spawnEasterEggConstellation(engine, engine.world.singularity.x + 100, engine.world.singularity.y - 100);
        }
        
        // Push massive multi-colored shockwave rings
        const bigBangShockwaves = [
          {
            x: engine.world.singularity.x,
            y: engine.world.singularity.y,
            radius: 0,
            maxRadius: COSMIC_CONSTANTS.EXPLOSION_RADIUS * 3.5,
            speed: 22.0,
            alpha: 1.0,
            color: '255, 255, 255'
          },
          {
            x: engine.world.singularity.x,
            y: engine.world.singularity.y,
            radius: 0,
            maxRadius: COSMIC_CONSTANTS.EXPLOSION_RADIUS * 3.0,
            speed: 16.0,
            alpha: 0.95,
            color: '0, 240, 255'
          },
          {
            x: engine.world.singularity.x,
            y: engine.world.singularity.y,
            radius: 0,
            maxRadius: COSMIC_CONSTANTS.EXPLOSION_RADIUS * 2.5,
            speed: 12.0,
            alpha: 0.85,
            color: '255, 100, 230'
          },
          {
            x: engine.world.singularity.x,
            y: engine.world.singularity.y,
            radius: 0,
            maxRadius: COSMIC_CONSTANTS.EXPLOSION_RADIUS * 2.0,
            speed: 9.0,
            alpha: 0.75,
            color: '100, 180, 255'
          }
        ];
        const shockwaveCount = Math.max(1, Math.floor(bigBangShockwaves.length * engine.world.performanceProfile.effectScale));
        for (let w = 0; w < shockwaveCount; w++) {
          engine.world.shockwaves.push(bigBangShockwaves[w]);
        }
        
        // Big Bang explosion sparks (scaled by performance tier)
        const sparkCount = Math.floor(240 * engine.world.performanceProfile.effectScale);
        for (let k = 0; k < sparkCount; k++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 20.0 + 4.5;
          engine.world.sparks.push({
            x: engine.world.singularity.x,
            y: engine.world.singularity.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: Math.random() * 3.2 + 1.2,
            alpha: 1.0,
            color: k % 3 === 0 ? 'rgba(0, 240, 255,' : k % 3 === 1 ? 'rgba(255, 100, 230,' : 'rgba(100, 180, 255,'
          });
        }
        
        engine.world.shakeTimer = 75;
        
        // Apply explode class to logo elements
        const logoEl = document.querySelector('.logo') as HTMLElement;
        const logoImg = document.querySelector('.logoImg') as HTMLElement;
        if (logoEl) {
          logoEl.classList.remove('logo-moon-transform');
          logoEl.classList.add('logo-moon-explode');
        }
        if (logoImg) {
          logoImg.classList.remove('logo-moon-transform-img');
          logoImg.classList.add('logo-moon-explode');
        }
        
        collectPageExplodeElements(
          engine,
          engine.world.singularity.x,
          engine.world.singularity.y,
          { includeLogo: false }
        );
        engine.world.pageExplodeActive = true;
        engine.world.pageExplodeTimer = 0;
        engine.world.pageExplodeStartTime = Date.now();
        }
      }
    } else if (engine.world.state === 'AYA_FORMATION') {
      engine.world.stateTimer--;
      tickAyaFormation(engine);
      if (engine.world.stateTimer <= 0) {
        endAyaFormation(engine);
      }
    } else if (engine.world.state === 'LOADING') {
      tickLoadingSpinner(engine);
      tryCompleteLoading(engine);
    } else if (engine.world.state === 'EXPLODING') {
      engine.world.stateTimer--;
      // Slowly fade out the background blackout
      if (engine.world.blackoutAlpha > 0) {
        const fadeStep = engine.world.isAyaDanceActive ? 0.006 : 0.015;
        engine.world.blackoutAlpha = Math.max(0, engine.world.blackoutAlpha - fadeStep);
      }
      if (engine.world.stateTimer <= 0 && engine.world.shockwaves.length === 0) {
        const resumeSwarm = engine.world.mouseMoving && isMouseGravityActive(engine);
        transitionTo(engine, resumeSwarm ? 'SWARM' : 'DRIFT');
      }
    }

    // --- SCREEN SHAKE RENDERING TRANSLATION ---
    if (engine.world.shakeTimer > 0) {
      engine.world.shakeTimer--;
      const shakeIntensity = (engine.world.shakeTimer / 30) * 8.5;
      const shakeX = (Math.random() - 0.5) * shakeIntensity;
      const shakeY = (Math.random() - 0.5) * shakeIntensity;
      engine.world.ctx.save();
      engine.world.ctx.translate(shakeX, shakeY);
    }

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

    // --- UPDATE & RENDER SANDBOX SIMULATION ELEMENTS ---
    tickSandboxCharge(engine);
    tickTeslaHoldZaps(engine);
    applyBlackHolePreviewGravity(engine);
    updateAndDrawSandboxElements(engine, width, height);
    drawSandboxPowerChargeAuras(engine);

    // 5. Draw Charge Aurora ring & charge energy arcs (Nova Strike CHARGING only)
    let chargeProgress = 0;
    if (engine.world.state === 'CHARGING' && usesDefaultMouseGravity(engine)) {
      engine.world.chargeTime++;
      chargeProgress = Math.min(1.0, engine.world.chargeTime / 60);

      const auroraRadius = 35 + chargeProgress * 95;
      const pulse = Math.sin(Date.now() / 60) * 10;
      
      const grad = engine.world.ctx.createRadialGradient(
        engine.world.mouse.x, engine.world.mouse.y, 8,
        engine.world.mouse.x, engine.world.mouse.y, auroraRadius + pulse
      );
      grad.addColorStop(0, `rgba(0, 240, 255, ${0.45 * chargeProgress})`);
      grad.addColorStop(0.35, `rgba(230, 100, 255, ${0.28 * chargeProgress})`);
      grad.addColorStop(0.75, `rgba(130, 80, 255, ${0.14 * chargeProgress})`);
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      engine.world.ctx.fillStyle = grad;
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(engine.world.mouse.x, engine.world.mouse.y, auroraRadius + pulse, 0, Math.PI * 2);
      engine.world.ctx.fill();

      // Energy lightning arcs jumping into cursor hotspot from surrounding stars
      if (Math.random() < 0.38) {
        const attractionDist = COSMIC_CONSTANTS.MOUSE_ATTRACT_DISTANCE + chargeProgress * 240;
        const nearby = findRandomNearbyParticle(engine, engine.world.mouse.x, engine.world.mouse.y, attractionDist);
        if (nearby) {
          drawMiniChargeArc(engine, engine.world.mouse.x, engine.world.mouse.y, nearby.x, nearby.y);
        }
      }
    }

    // 6. Render Active Singularity / Moon Corona
    if (engine.world.state === 'SINGULARITY') {
      const progress = (25 - engine.world.stateTimer) / 25;
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(engine.world.singularity.x, engine.world.singularity.y, progress * 24, 0, Math.PI * 2);
      engine.world.ctx.fillStyle = `rgba(0, 0, 0, ${progress * 0.88})`;
      engine.world.ctx.fill();
      
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(engine.world.singularity.x, engine.world.singularity.y, progress * 25, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(0, 240, 255, ${0.45 + progress * 0.5})`;
      engine.world.ctx.lineWidth = 2.2;
      engine.world.ctx.stroke();
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

    // 7. Render active lightning bolt graphics
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
      sp.alpha -= 0.025;

      if (sp.alpha <= 0) {
        engine.world.sparks.splice(i, 1);
        continue;
      }

      engine.world.ctx.beginPath();
      engine.world.ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
      engine.world.ctx.fillStyle = `${sp.color}${sp.alpha})`;
      engine.world.ctx.fill();

      engine.world.ctx.beginPath();
      engine.world.ctx.arc(sp.x, sp.y, sp.radius * 2.5, 0, Math.PI * 2);
      engine.world.ctx.fillStyle = `${sp.color}${sp.alpha * 0.25})`;
      engine.world.ctx.fill();
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

      engine.world.ctx.beginPath();
      engine.world.ctx.arc(bh.x, bh.y, bhRadius, 0, Math.PI * 2);
      engine.world.ctx.fillStyle = 'rgba(10, 10, 15, 0.95)';
      engine.world.ctx.fill();

      const pulse = Math.sin(Date.now() / 100 + bh.x) * bhRadius * 0.25;
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(bh.x, bh.y, bhRadius * 1.55 + pulse, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(130, 80, 255, ${0.45 * (bh.radius / bh.maxRadius)})`;
      engine.world.ctx.lineWidth = 2.2;
      engine.world.ctx.stroke();

      engine.world.ctx.beginPath();
      engine.world.ctx.arc(bh.x, bh.y, bhRadius * 1.35 + pulse * 0.5, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(0, 240, 255, ${0.35 * (bh.radius / bh.maxRadius)})`;
      engine.world.ctx.lineWidth = 1.2;
      engine.world.ctx.stroke();
    }

    // 10. Stellar nursery: Random births if particle count drops (maintain ecosystem)
    if (engine.world.particles.length < getMaxParticles(engine.world) && engine.world.state !== 'AYA_FORMATION' && engine.world.state !== 'LOADING' && Math.random() < 0.045) {
      spawnStellarBirth(engine, Math.random() * width, Math.random() * height);
    }

    // Spawn painted stars during drag if paint brush is active
    if (engine.world.isMouseDown && engine.world.activePower === 'PAINT_BRUSH' && engine.world.mouse.x !== -1000) {
      engine.world.paintHoldFrame++;
      if (engine.world.nurseryStarCount < getMaxNurseryStars(engine.world) && engine.world.paintHoldFrame % 2 === 0) {
        spawnNurseryStar(engine, engine.world.mouse.x, engine.world.mouse.y);
      } else if (engine.world.nurseryStarCount >= getMaxNurseryStars(engine.world) && engine.world.paintHoldFrame % 8 === 0) {
        spawnStardustPuff(engine, engine.world.mouse.x, engine.world.mouse.y, 'rgba(255, 220, 180,');
      }
    } else {
      engine.world.paintHoldFrame = 0;
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
      if (!inFormation && !inLoadingRing && engine.world.state === 'CHARGING' && usesDefaultMouseGravity(engine)) {
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
      if (!inFormation && !inLoadingRing) {
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

      // D2. Sandbox black hole + wormhole world physics (persistent until CLEAR)
      if (!inFormation && !inLoadingRing) {
      for (const sbh of engine.world.sandboxBlackholes) {
        applySandboxBlackholeForces(engine, p, sbh);
      }
      applyWormholeForcesToParticle(engine, p);
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

      // Chrono Well — time slow + gentle inward drift while sandbox channel is active
      if (engine.world.activePower === 'TIME_DILATION' && isSandboxPowerChannelActive(engine) && engine.world.mouse.active && engine.world.mouse.x !== -1000) {
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
        if (p.x < border) flockForceX += (border - p.x) * 0.0008;
        else if (p.x > width - border) flockForceX -= (p.x - (width - border)) * 0.0008;

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

      // Wrap boundaries
      const padding = 20;
      if (p.x < -padding) p.x = width + padding;
      else if (p.x > width + padding) p.x = -padding;

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

      engine.world.ctx.beginPath();
      engine.world.ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
      
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
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(p.x, p.y, currentRadius * 2.8, 0, Math.PI * 2);
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
      } else if (engine.world.activePower === 'TIME_DILATION' && isSandboxPowerChannelActive(engine) && engine.world.mouse.active && engine.world.mouse.x !== -1000) {
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

    // 12. Formation links + easter egg message
    if (engine.world.state === 'AYA_FORMATION') {
      drawFormationLinks(engine);
    }
    if (engine.world.state === 'LOADING') {
      drawLoadingRingLinks(engine);
    }
    drawEasterEggs(engine);

    // Pink dedication vignette during Aya formation
    if (engine.world.isAyaDanceActive && (engine.world.state === 'AYA_FORMATION' || engine.world.easterEggs.length > 0)) {
      const vigCx = engine.world.ayaFormationCenterX || width / 2;
      const vigCy = engine.world.ayaFormationCenterY || height * 0.25;
      const vigGrad = engine.world.ctx.createRadialGradient(
        vigCx, vigCy, Math.min(width, height) * 0.08,
        vigCx, vigCy, Math.max(width, height) * 0.65
      );
      vigGrad.addColorStop(0, 'rgba(255, 100, 180, 0)');
      vigGrad.addColorStop(0.5, 'rgba(255, 80, 160, 0.06)');
      vigGrad.addColorStop(1, 'rgba(60, 10, 35, 0.28)');
      engine.world.ctx.fillStyle = vigGrad;
      engine.world.ctx.fillRect(0, 0, width, height);
    }

    // --- RESTORE SCREEN SHAKE TRANSFORMATION ---
    if (engine.world.shakeTimer > 0) {
      engine.world.ctx.restore();
    }

    // --- SCREEN FLASH OVERLAY (Big Bang flash) ---
    if (engine.world.screenFlash > 0) {
      engine.world.screenFlash--;
      const flashMax = engine.world.isAyaDanceActive ? 18 : 14;
      const flashAlpha = engine.world.screenFlash / flashMax;
      const flashRgb = engine.world.isAyaDanceActive ? '255, 180, 220' : '255, 255, 255';
      engine.world.ctx.fillStyle = `rgba(${flashRgb}, ${flashAlpha})`;
      engine.world.ctx.fillRect(0, 0, width, height);
    }
  }

  // --- SANDBOX CONTROL PANEL METHODS ---
