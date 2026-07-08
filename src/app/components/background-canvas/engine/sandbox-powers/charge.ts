import { MousePower, SandboxChargeTier } from '../../models/cosmic.types';
import type { CosmicCanvasEngine } from '../cosmic-canvas-engine';
import { playPowerReleaseSound, updatePowerChargeAudio } from '../audio';
import { drawBlackHolePreview, spawnSandboxBlackhole } from './black-hole';
import { spawnSandboxChronoWell } from './chrono-well';
import { releaseNebularWindPower, releasePaintBrushPower, releaseRepellerPower } from './brush-and-wind';
import { drawMeteorChargePreview, spawnSandboxMeteor } from './meteor';
import { drawPlanetPreview, spawnSandboxPlanet } from './planet';
import { triggerTeslaDischargePower } from './tesla';
import { releaseWormholePower } from './wormhole';

export function getSandboxChargeProgress(engine: CosmicCanvasEngine): number {
    return Math.min(1, engine.world.chargeTime / 60);
  }

export function getSandboxChargeTier(engine: CosmicCanvasEngine): SandboxChargeTier {
    if (engine.world.chargeTime >= 60) {
      return 'super';
    }
    if (engine.world.chargeTime >= 12) {
      return 'charged';
    }
    return 'tap';
  }

export function isSandboxSuperCharged(engine: CosmicCanvasEngine): boolean {
    return engine.world.chargeTime >= 60;
  }

export function tickSandboxCharge(engine: CosmicCanvasEngine): void {
    if (engine.world.isMouseDown && engine.world.activePower !== 'DEFAULT') {
      engine.world.chargeTime++;
    }
  }

export function drawSandboxChargeAura(engine: CosmicCanvasEngine,
    innerColor: string,
    midColor: string,
    outerColor: string,
    baseRadius = 35
  ): void {
    if (!engine.world.isMouseDown || engine.world.mouse.x === -1000) {
      return;
    }

    const chargeProgress = getSandboxChargeProgress(engine);
    const auroraRadius = baseRadius + chargeProgress * 95;
    const pulse = Math.sin(Date.now() / 60) * 10;

    const grad = engine.world.ctx.createRadialGradient(
      engine.world.mouse.x, engine.world.mouse.y, 8,
      engine.world.mouse.x, engine.world.mouse.y, auroraRadius + pulse
    );
    grad.addColorStop(0, innerColor.replace('ALPHA', String(0.45 * chargeProgress)));
    grad.addColorStop(0.35, midColor.replace('ALPHA', String(0.28 * chargeProgress)));
    grad.addColorStop(0.75, outerColor.replace('ALPHA', String(0.14 * chargeProgress)));
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

    engine.world.ctx.fillStyle = grad;
    engine.world.ctx.beginPath();
    engine.world.ctx.arc(engine.world.mouse.x, engine.world.mouse.y, auroraRadius + pulse, 0, Math.PI * 2);
    engine.world.ctx.fill();
  }

export function drawSandboxPowerChargeAuras(engine: CosmicCanvasEngine): void {
    if (!engine.world.isMouseDown || engine.world.mouse.x === -1000) {
      return;
    }

    switch (engine.world.activePower) {
      case 'BLACK_HOLE':
        drawBlackHolePreview(engine);
        break;
      case 'TESLA_DISCHARGE':
        drawSandboxChargeAura(engine,
          'rgba(180, 220, 255, ALPHA)',
          'rgba(120, 180, 255, ALPHA)',
          'rgba(80, 140, 255, ALPHA)'
        );
        break;
      case 'REPELLER':
        drawSandboxChargeAura(engine,
          'rgba(255, 140, 200, ALPHA)',
          'rgba(255, 100, 170, ALPHA)',
          'rgba(255, 70, 130, ALPHA)'
        );
        break;
      case 'TIME_DILATION':
        drawSandboxChargeAura(engine,
          'rgba(0, 240, 255, ALPHA)',
          'rgba(80, 200, 255, ALPHA)',
          'rgba(120, 160, 255, ALPHA)'
        );
        break;
      case 'NEBULAR_WIND':
        drawSandboxChargeAura(engine,
          'rgba(120, 220, 255, ALPHA)',
          'rgba(80, 180, 255, ALPHA)',
          'rgba(60, 140, 255, ALPHA)',
          28
        );
        break;
      case 'PAINT_BRUSH':
        drawSandboxChargeAura(engine,
          'rgba(255, 220, 180, ALPHA)',
          'rgba(255, 180, 140, ALPHA)',
          'rgba(255, 140, 120, ALPHA)',
          30
        );
        break;
      case 'WORMHOLE':
        drawSandboxChargeAura(engine,
          'rgba(0, 240, 255, ALPHA)',
          'rgba(255, 100, 230, ALPHA)',
          'rgba(140, 120, 255, ALPHA)'
        );
        break;
      case 'PLANET':
        drawPlanetPreview(engine);
        break;
      case 'METEOR':
        drawMeteorChargePreview(engine);
        break;
      case 'STELLAR_LASSO':
        drawSandboxChargeAura(engine,
          'rgba(255, 230, 100, ALPHA)',
          'rgba(255, 180, 50, ALPHA)',
          'rgba(255, 120, 0, ALPHA)',
          28
        );
        break;
      case 'QUANTUM_SPLITTER':
        drawSandboxChargeAura(engine,
          'rgba(255, 0, 240, ALPHA)',
          'rgba(180, 0, 255, ALPHA)',
          'rgba(100, 0, 255, ALPHA)',
          24
        );
        break;
    }
  }

export function handleSandboxPowerRelease(engine: CosmicCanvasEngine): void {
    const tier = getSandboxChargeTier(engine);
    playPowerReleaseSound(engine.world.activePower, tier);
    updatePowerChargeAudio(engine.world.activePower, false, 0);

    switch (engine.world.activePower) {
      case 'BLACK_HOLE':
        spawnSandboxBlackhole(engine, engine.world.mouse.x, engine.world.mouse.y, tier);
        break;
      case 'TESLA_DISCHARGE':
        triggerTeslaDischargePower(engine, tier === 'tap' ? 'tap' : tier === 'charged' ? 'charged' : 'super');
        break;
      case 'REPELLER':
        releaseRepellerPower(engine, tier);
        break;
      case 'TIME_DILATION':
        spawnSandboxChronoWell(engine, engine.world.mouse.x, engine.world.mouse.y, tier);
        break;
      case 'NEBULAR_WIND':
        releaseNebularWindPower(engine, tier);
        break;
      case 'PAINT_BRUSH':
        releasePaintBrushPower(engine, tier);
        break;
      case 'WORMHOLE':
        releaseWormholePower(engine, tier);
        break;
      case 'PLANET':
        spawnSandboxPlanet(engine, engine.world.mouse.x, engine.world.mouse.y);
        break;
      case 'METEOR':
        spawnSandboxMeteor(engine, engine.world.mouse.x, engine.world.mouse.y);
        break;
      case 'STELLAR_LASSO':
        engine.world.lassoReleaseQueued = true;
        engine.world.lassoReleaseTier = tier;
        break;
    }
  }
