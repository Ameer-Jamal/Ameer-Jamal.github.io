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

export function renderOverlays(engine: CosmicCanvasEngine, width: number, height: number): void {
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
