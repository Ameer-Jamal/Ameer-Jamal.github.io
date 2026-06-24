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

import { triggerRandomStopAction, isSandboxPowerEngaged, isMouseGravityActive, transitionTo, pauseMouseGravity, triggerNormalClickShockwave, triggerSuperMoveExplosion } from './state-machine';
import { handleSandboxPowerRelease } from './sandbox-powers';
import { startLogoBlackhole } from './logo-easter-egg';

export function updatePointerCoords(engine: CosmicCanvasEngine, clientX: number, clientY: number): void {
    const canvas = engine.world.canvas;
    const rect = canvas.getBoundingClientRect();
    engine.world.mouse.x = clientX - rect.left;
    engine.world.mouse.y = clientY - rect.top;
  }


export function clearPointerState(engine: CosmicCanvasEngine): void {
    if (engine.world.activePower === 'DEFAULT' && !engine.world.isMouseDown && (engine.world.state === 'SWARM' || engine.world.state === 'CHARGING')) {
      triggerRandomStopAction(engine);
    }
    engine.world.mouse.active = false;
    engine.world.mouse.x = -1000;
    engine.world.mouse.y = -1000;
    engine.world.mouseVelocity.x = 0;
    engine.world.mouseVelocity.y = 0;
    engine.world.mouseMoving = false;
    engine.world.isMouseDown = false;
  }


export function clearTouchPointerStateIfNeeded(engine: CosmicCanvasEngine, event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      clearPointerState(engine);
    }
  }

export function onPointerMove(engine: CosmicCanvasEngine, event: PointerEvent): void {
    const prevX = engine.world.mouse.x;
    const prevY = engine.world.mouse.y;

    updatePointerCoords(engine, event.clientX, event.clientY);

    if (prevX !== -1000) {
      engine.world.mouseVelocity.x = engine.world.mouse.x - prevX;
      engine.world.mouseVelocity.y = engine.world.mouse.y - prevY;
    } else {
      engine.world.mouseVelocity.x = 0;
      engine.world.mouseVelocity.y = 0;
    }

    engine.world.mouse.active = true;
    engine.world.lastMoveTime = Date.now();

    // Stars follow the cursor when it moves (paused during sandbox hold)
    if (isMouseGravityActive(engine) && (engine.world.state === 'DRIFT' || (engine.world.state === 'EXPLODING' && engine.world.stateTimer < 15))) {
      transitionTo(engine, 'SWARM');
    }

    // Keep sandbox hold active while dragging — do not let SWARM idle events hijack the interaction
    if (isSandboxPowerEngaged(engine)) {
      engine.world.mouseMoving = true;
      return;
    }

    engine.world.mouseMoving = true;
  }

export function onPointerLeave(engine: CosmicCanvasEngine, event: PointerEvent): void {
    if (event.pointerType !== 'mouse') {
      return;
    }
    clearPointerState(engine);
  }

export function onPointerCancel(engine: CosmicCanvasEngine, event: PointerEvent): void {
    if (!engine.world.isMouseDown) {
      clearTouchPointerStateIfNeeded(engine, event);
      return;
    }
    onPointerUp(engine, event);
  }

export function onPointerDown(engine: CosmicCanvasEngine, event: PointerEvent): void {
    if (engine.world.state === 'SINGULARITY' || engine.world.state === 'MOON_DANCE') {
      return;
    }

    // Ignore clicks on sandbox mode UI controls
    if (typeof document !== 'undefined') {
      const panel = document.querySelector('.sandbox-panel');
      const trigger = document.querySelector('.sandbox-trigger');
      const hint = document.querySelector('.sandbox-trigger-hint');
      if (
        panel?.contains(event.target as Node) ||
        trigger?.contains(event.target as Node) ||
        hint?.contains(event.target as Node)
      ) {
        return;
      }
    }

    // Close sandbox panel if clicked outside — unless pinned
    if (engine.world.isSandboxOpen && !engine.world.isSandboxPinned) {
      engine.world.isSandboxOpen = false;
      return;
    }

    updatePointerCoords(engine, event.clientX, event.clientY);
    engine.world.mouse.active = true;
    engine.world.isMouseDown = true;
    engine.world.chargeTime = 0;
    engine.world.teslaHoldZapTimer = 0;

    if (engine.world.activePower === 'DEFAULT') {
      transitionTo(engine, 'CHARGING');
    } else {
      pauseMouseGravity(engine);
    }
  }

export function onPointerUp(engine: CosmicCanvasEngine, event: PointerEvent): void {
    if (!engine.world.isMouseDown) {
      return;
    }
    engine.world.isMouseDown = false;

    if (engine.world.state === 'SINGULARITY' || engine.world.state === 'MOON_DANCE') {
      clearTouchPointerStateIfNeeded(engine, event);
      return;
    }

    // Ignore releases on sandbox mode UI controls
    if (typeof document !== 'undefined') {
      const panel = document.querySelector('.sandbox-panel');
      const trigger = document.querySelector('.sandbox-trigger');
      if (panel?.contains(event.target as Node) || trigger?.contains(event.target as Node)) {
        clearTouchPointerStateIfNeeded(engine, event);
        return;
      }
    }

    updatePointerCoords(engine, event.clientX, event.clientY);

    if (engine.world.activePower !== 'DEFAULT') {
      handleSandboxPowerRelease(engine);
      pauseMouseGravity(engine, 90);
      clearTouchPointerStateIfNeeded(engine, event);
      return;
    }

    if (engine.world.chargeTime >= 20) {
      triggerSuperMoveExplosion(engine);
    } else {
      transitionTo(engine, 'EXPLODING');
      triggerNormalClickShockwave(engine);
    }

    clearTouchPointerStateIfNeeded(engine, event);
  }

  /** @deprecated Use onPointerMove — kept for unit tests */

export function onMouseMove(engine: CosmicCanvasEngine, event: MouseEvent): void {
    onPointerMove(engine, event as PointerEvent);
  }

  /** @deprecated Use onPointerLeave — kept for unit tests */

export function onMouseLeave(engine: CosmicCanvasEngine): void {
    clearPointerState(engine);
  }

  /** @deprecated Use onPointerDown — kept for unit tests */

export function onMouseDown(engine: CosmicCanvasEngine, event: MouseEvent): void {
    onPointerDown(engine, event as PointerEvent);
  }

  /** @deprecated Use onPointerUp — kept for unit tests */

export function onMouseUp(engine: CosmicCanvasEngine, event: MouseEvent): void {
    onPointerUp(engine, event as PointerEvent);
  }

export function onLogoBlackholeTrigger(engine: CosmicCanvasEngine): void {
    if (engine.world.state === 'SINGULARITY' || engine.world.isLogoBlackholeActive) return;
    
    // Find logo coordinates relative to canvas layout
    const logoImg = document.querySelector('.logoImg') || document.querySelector('.logo');
    let logoX = window.innerWidth / 2;
    let logoY = 120;
    
    if (logoImg) {
      const rect = logoImg.getBoundingClientRect();
      const canvas = engine.world.canvas;
      const canvasRect = canvas.getBoundingClientRect();
      
      logoX = rect.left + rect.width / 2 - canvasRect.left;
      logoY = rect.top + rect.height / 2 - canvasRect.top;
    }
    
    startLogoBlackhole(engine, logoX, logoY);
  }

  // --- STATE MACHINE ROUTING ---
  /** Cursor gravity (SWARM pull) — active for all powers unless briefly paused on click. */
  /** Sandbox click/hold owns the cursor until mouseup. */
