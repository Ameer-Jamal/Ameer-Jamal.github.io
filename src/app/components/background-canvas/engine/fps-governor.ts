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

import { resizeCanvas, initStars, initGalaxies } from './background-layers';
import { adjustParticlePopulation, initParticles } from './particle-system';
import { setupLoadingRing } from './loading-spinner';

export function stopAnimationLoop(engine: CosmicCanvasEngine): void {
    if (engine.world.animationFrameId !== null) {
      cancelAnimationFrame(engine.world.animationFrameId);
      engine.world.animationFrameId = null;
    }
  }


export function resetFpsGovernorStreaks(engine: CosmicCanvasEngine): void {
    engine.world.fpsLowStreak = 0;
    engine.world.fpsHighStreak = 0;
    engine.world.fpsFrameDeltas = [];
    engine.world.lastFrameTime = 0;
    engine.world.fpsGovernorCooldown = 0;
  }



export function applyPerformanceTier(engine: CosmicCanvasEngine, tier: PerformanceTier, reinitParticles = true): void {
    engine.world.performanceProfile = getProfileForTier(tier);
    resizeCanvas(engine);
    initStars(engine);
    initGalaxies(engine);
    if (reinitParticles) {
      engine.world.nurseryStarCount = 0;
      initParticles(engine);
      if (engine.world.state === 'LOADING') {
        setupLoadingRing(engine);
      }
    }
  }


/**
 * Apply a tier change triggered by the live FPS governor. Unlike the destructive
 * `applyPerformanceTier`, this keeps the existing stars/galaxies/particles in place and only
 * nudges the population toward the new cap, so the running scene never visibly resets.
 */
export function applyPerformanceTierSoft(engine: CosmicCanvasEngine, tier: PerformanceTier): void {
    engine.world.performanceProfile = getProfileForTier(tier);
    resizeCanvas(engine);
    if (engine.world.state !== 'LOADING') {
      adjustParticlePopulation(engine);
    }
  }


export function tickFpsGovernor(engine: CosmicCanvasEngine, now: number): void {
    // During the loading spinner the main thread is busy booting scripts, producing huge
    // frame deltas. Skip sampling so we never downgrade + reinit particles (which resets the ring).
    if (engine.world.state === 'LOADING') {
      engine.world.lastFrameTime = 0;
      return;
    }

    if (engine.world.lastFrameTime > 0) {
      const delta = now - engine.world.lastFrameTime;
      engine.world.fpsFrameDeltas.push(delta);
      if (engine.world.fpsFrameDeltas.length > COSMIC_CONSTANTS.FPS_SAMPLE_SIZE) {
        engine.world.fpsFrameDeltas.shift();
      }
    }
    engine.world.lastFrameTime = now;

    if (engine.world.fpsGovernorCooldown > 0) {
      engine.world.fpsGovernorCooldown--;
      return;
    }

    if (engine.world.fpsFrameDeltas.length < COSMIC_CONSTANTS.FPS_SAMPLE_SIZE) {
      return;
    }

    const avgDelta = engine.world.fpsFrameDeltas.reduce((sum, value) => sum + value, 0) / engine.world.fpsFrameDeltas.length;
    const fps = 1000 / avgDelta;

    if (fps < COSMIC_CONSTANTS.FPS_DOWNGRADE_THRESHOLD) {
      engine.world.fpsLowStreak++;
      engine.world.fpsHighStreak = 0;
      if (engine.world.fpsLowStreak >= COSMIC_CONSTANTS.FPS_DOWNGRADE_FRAMES) {
        const nextTier = downgradeTier(engine.world.performanceProfile.tier);
        if (nextTier) {
          applyPerformanceTierSoft(engine, nextTier);
        }
        engine.world.fpsLowStreak = 0;
        engine.world.fpsHighStreak = 0;
        engine.world.fpsFrameDeltas = [];
        engine.world.fpsGovernorCooldown = 60;
      }
      return;
    }

    if (fps > COSMIC_CONSTANTS.FPS_UPGRADE_THRESHOLD) {
      engine.world.fpsHighStreak++;
      engine.world.fpsLowStreak = 0;
      if (engine.world.fpsHighStreak >= COSMIC_CONSTANTS.FPS_UPGRADE_FRAMES) {
        const nextTier = upgradeTier(engine.world.performanceProfile.tier);
        if (nextTier) {
          applyPerformanceTierSoft(engine, nextTier);
        }
        engine.world.fpsLowStreak = 0;
        engine.world.fpsHighStreak = 0;
        engine.world.fpsFrameDeltas = [];
        engine.world.fpsGovernorCooldown = 60;
      }
      return;
    }

    engine.world.fpsLowStreak = 0;
    engine.world.fpsHighStreak = 0;
  }

