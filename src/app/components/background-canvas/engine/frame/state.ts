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

export function tickFrameState(engine: CosmicCanvasEngine, frameDelta: number): void {
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

    // Break out of a leftover permanent AYA_FORMATION lock (see EXPLODING
    // handler below). If the dance is over but we're still stuck in
    // formation, dissolve it and hand control back to the user.
    if (
      engine.world.state === 'AYA_FORMATION' &&
      !engine.world.isAyaDanceActive &&
      engine.world.stateTimer > 10000
    ) {
      for (const p of engine.world.particles) {
        p.formationActive = false;
        p.formationTx = undefined;
        p.formationTy = undefined;
      }
      transitionTo(engine, 'DRIFT');
    }

    // If the cursor is active (was moved / clicked in this session) we
    // should be swarming around its last known position.  `mouse.active`
    // alone is enough — it means the pointer has been inside the viewport
    // at some point and no genuine leave cleared it.  This covers cases
    // where the engine landed back in DRIFT (e.g. after an explosion or the
    // Aya easter egg) while the cursor is still physically inside the
    // viewport and stationary, including keyboard-triggered Aya where no
    // recent pointermove fired.
    if (
      engine.world.state === 'DRIFT' &&
      engine.world.mouse.active &&
      engine.world.mouse.x !== -1000 &&
      isMouseGravityActive(engine)
    ) {
      transitionTo(engine, 'SWARM');
    }

    if ((engine.world as any).ayaHeartbeatTimer > 0) {
      (engine.world as any).ayaHeartbeatTimer = Math.max(0, (engine.world as any).ayaHeartbeatTimer - frameDelta);
      try {
        if (typeof document !== 'undefined') {
          const logoEl = document.querySelector('.logo') as HTMLElement;
          const wrapperEl = document.getElementById('wrapper');
          
          const t = 50 - (engine.world as any).ayaHeartbeatTimer;
          let heartbeatScale = 1.0;
          if (t < 15) {
            heartbeatScale = 1.0 + Math.sin((t / 15) * Math.PI) * 0.35;
          } else if (t >= 22 && t < 37) {
            heartbeatScale = 1.0 + Math.sin(((t - 22) / 15) * Math.PI) * 0.22;
          }
          
          if (logoEl && document.body.classList.contains('is-aya-message')) {
            logoEl.style.transform = `scale(${heartbeatScale})`;
          }
          if (wrapperEl) {
            const screenScale = 1.0 + (heartbeatScale - 1.0) * 0.08;
            wrapperEl.style.transform = `scale(${screenScale})`;
            wrapperEl.style.setProperty('transition', 'none', 'important');
          }
        }
      } catch (e) {}

      if ((engine.world as any).ayaHeartbeatTimer === 0) {
        try {
          if (typeof document !== 'undefined') {
            const logoEl = document.querySelector('.logo') as HTMLElement;
            if (logoEl) {
              logoEl.style.transform = '';
            }
            const wrapperEl = document.getElementById('wrapper');
            if (wrapperEl) {
              wrapperEl.style.transform = '';
              wrapperEl.style.transition = '';
            }
          }
        } catch (e) {}
      }
    }

    // SWARM now persists while the pointer is inside the window, even when the
    // cursor is completely still. The only transition back to DRIFT happens when
    // the pointer physically leaves the viewport (handled in input-controller).
    if (engine.world.state === 'SINGULARITY') {
      engine.world.stateTimer -= frameDelta;
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
      engine.world.stateTimer -= frameDelta;
      engine.world.logoBlackholeTimer += frameDelta;

      // Gradually fade out background space environment into black
      const totalDanceTimer = engine.world.isAyaDanceActive ? 360 : 390;
      const fadeThreshold = engine.world.isAyaDanceActive ? 90 : 90;
      if (engine.world.stateTimer > fadeThreshold) {
        const blackoutTarget = engine.world.isAyaDanceActive ? 0.98 : 0.96;
        const fadeDuration = totalDanceTimer - fadeThreshold;
        engine.world.blackoutAlpha = Math.min(blackoutTarget, ((totalDanceTimer - engine.world.stateTimer) / fadeDuration) * blackoutTarget);
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
          stopBlackholeHum();
          transitionTo(engine, 'EXPLODING');
          playSupernovaPop();
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
      engine.world.stateTimer -= frameDelta;
      tickAyaFormation(engine);
      if (engine.world.stateTimer <= 0) {
        endAyaFormation(engine);
      }
    } else if (engine.world.state === 'LOADING') {
      tickLoadingSpinner(engine);
      tryCompleteLoading(engine);
    } else if (engine.world.state === 'EXPLODING') {
      engine.world.stateTimer -= frameDelta;
      // Slowly fade out the background blackout
      if (engine.world.blackoutAlpha > 0) {
        const fadeStep = (engine.world.isAyaDanceActive ? 0.006 : 0.015) * frameDelta;
        engine.world.blackoutAlpha = Math.max(0, engine.world.blackoutAlpha - fadeStep);
      }
      if (engine.world.stateTimer <= 0 && engine.world.shockwaves.length === 0) {
        // Always resume to SWARM or DRIFT based on mouse state.  Do NOT
        // transition into the infinite AYA_FORMATION hold — that permanently
        // locks particles in formation and makes them appear frozen on the
        // Aya page after any click.
        const resumeSwarm = engine.world.mouseMoving && isMouseGravityActive(engine);
        transitionTo(engine, resumeSwarm ? 'SWARM' : 'DRIFT');
      }
    }
}
