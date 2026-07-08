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

export function renderSandboxFrame(engine: CosmicCanvasEngine, width: number, height: number): number {
    // --- UPDATE & RENDER SANDBOX SIMULATION ELEMENTS ---
    tickSandboxCharge(engine);
    if (engine.world.activePower !== 'DEFAULT') {
      updatePowerChargeAudio(engine.world.activePower, engine.world.isMouseDown, getSandboxChargeProgress(engine));
    }
    tickTeslaHoldZaps(engine);
    applyBlackHolePreviewGravity(engine);
    updateAndDrawSandboxElements(engine, width, height);
    drawSandboxPowerChargeAuras(engine);
    updateAndDrawMeteors(engine, width, height);

    // 5. Draw Charge Aurora ring & charge energy arcs (Nova Strike CHARGING only)
    let chargeProgress = 0;
    if (engine.world.state === 'CHARGING' && usesDefaultMouseGravity(engine)) {
      engine.world.chargeTime++;
      chargeProgress = Math.min(1.0, engine.world.chargeTime / 60);
      updatePowerChargeAudio('DEFAULT', true, chargeProgress);

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
    } else if (engine.world.activePower === 'DEFAULT') {
      updatePowerChargeAudio('DEFAULT', false, 0);
    }
  return chargeProgress;
}
