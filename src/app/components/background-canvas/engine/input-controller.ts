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
import { playPowerReleaseSound, updatePowerChargeAudio } from './audio';

export function updatePointerCoords(engine: CosmicCanvasEngine, clientX: number, clientY: number): void {
    const canvas = engine.world.canvas;
    const rect = canvas.getBoundingClientRect();
    engine.world.mouse.x = clientX - rect.left;
    engine.world.mouse.y = clientY - rect.top;
  }


export function clearPointerState(engine: CosmicCanvasEngine, skipRandomStop = false): void {
    if (!skipRandomStop && engine.world.activePower === 'DEFAULT' && !engine.world.isMouseDown && (engine.world.state === 'SWARM' || engine.world.state === 'CHARGING')) {
      triggerRandomStopAction(engine);
    }
    engine.world.mouse.active = false;
    engine.world.mouse.x = -1000;
    engine.world.mouse.y = -1000;
    engine.world.mouseVelocity.x = 0;
    engine.world.mouseVelocity.y = 0;
    engine.world.mouseMoving = false;
    engine.world.isMouseDown = false;
    engine.world.draggedBlackhole = null;
    engine.world.draggedWormhole = null;
    engine.world.draggedChronoWell = null;
    updatePowerChargeAudio('DEFAULT', false, 0);
    if (engine.world.activePower !== 'DEFAULT') {
      updatePowerChargeAudio(engine.world.activePower, false, 0);
    }
  }

function isPointerInsideViewport(event: PointerEvent): boolean {
    if (typeof window === 'undefined') return false;
    const margin = 2;
    return (
      event.clientX >= -margin &&
      event.clientY >= -margin &&
      event.clientX <= window.innerWidth + margin &&
      event.clientY <= window.innerHeight + margin
    );
  }


export function clearTouchPointerStateIfNeeded(engine: CosmicCanvasEngine, event: PointerEvent): void {
    if (event.pointerType === 'touch') {
      clearPointerState(engine);
    }
  }

export function onPointerEnter(engine: CosmicCanvasEngine, event: PointerEvent): void {
    engine.world.pointerInsideWindow = true;
    if (event.pointerType === 'mouse') {
      updatePointerCoords(engine, event.clientX, event.clientY);
      engine.world.mouse.active = true;
    }
  }

export function onPointerMove(engine: CosmicCanvasEngine, event: PointerEvent): void {
    engine.world.pointerInsideWindow = true;

    const prevX = engine.world.mouse.x;
    const prevY = engine.world.mouse.y;

    updatePointerCoords(engine, event.clientX, event.clientY);

    const curX = engine.world.mouse.x;
    const curY = engine.world.mouse.y;

    if (engine.world.draggedBlackhole) {
      engine.world.draggedBlackhole.x = curX;
      engine.world.draggedBlackhole.y = curY;
    }
    if (engine.world.draggedWormhole) {
      engine.world.draggedWormhole.x = curX;
      engine.world.draggedWormhole.y = curY;
    }
    if (engine.world.draggedChronoWell) {
      engine.world.draggedChronoWell.x = curX;
      engine.world.draggedChronoWell.y = curY;
    }
    if (engine.world.draggedPlanet) {
      engine.world.draggedPlanet.x = curX;
      engine.world.draggedPlanet.y = curY;
    }

    if (typeof document !== 'undefined' && document.body.classList.contains('is-aya-message')) {
      if (prevX !== -1000 && Math.abs(curX - prevX) + Math.abs(curY - prevY) > 8) {
        (window as any).__ayaSpawnTrailHearts?.(curX, curY);
      }
    }

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
    engine.world.pointerInsideWindow = false;

    // Some touchpads/browsers fire spurious pointerleave events while the cursor
    // is still physically inside the window. Ignore those so the swarm stays alive.
    if (isPointerInsideViewport(event)) {
      return;
    }

    if (event.pointerType !== 'mouse') {
      clearTouchPointerStateIfNeeded(engine, event);
      return;
    }

    transitionTo(engine, 'DRIFT');
    clearPointerState(engine, true);
  }

export function onPointerCancel(engine: CosmicCanvasEngine, event: PointerEvent): void {
    if (!engine.world.isMouseDown) {
      clearTouchPointerStateIfNeeded(engine, event);
      return;
    }
    onPointerUp(engine, event);
  }

export function onPointerDown(engine: CosmicCanvasEngine, event: PointerEvent): void {
    if (typeof document !== 'undefined' && document.body.classList.contains('is-aya-message') && engine.world.activePower === 'DEFAULT') {
      updatePointerCoords(engine, event.clientX, event.clientY);
      const customSpawn = (window as any).__ayaSpawnHearts;
      if (customSpawn) {
        customSpawn(engine.world.mouse.x, engine.world.mouse.y);
      }
    }

    if (
      engine.world.state === 'SINGULARITY' ||
      engine.world.state === 'MOON_DANCE' ||
      engine.world.state === 'AYA_FORMATION' ||
      engine.world.state === 'LOADING'
    ) {
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
    engine.world.pointerInsideWindow = true;
    engine.world.mouse.active = true;
    engine.world.isMouseDown = true;
    engine.world.chargeTime = 0;
    engine.world.teslaHoldZapTimer = 0;

    // Reset dragged references
    engine.world.draggedBlackhole = null;
    engine.world.draggedWormhole = null;
    engine.world.draggedChronoWell = null;
    engine.world.draggedPlanet = null;

    const clickX = engine.world.mouse.x;
    const clickY = engine.world.mouse.y;

    // Check for wormhole drag first (precedence)
    const wh = engine.world.wormholes.find(w => ((clickX - w.x) ** 2 + (clickY - w.y) ** 2 <= Math.max(35, w.radius) ** 2));
    if (wh) {
      engine.world.draggedWormhole = wh;
      return;
    }

    // Check for blackhole drag
    const bh = engine.world.sandboxBlackholes.find(b => !b.isDying && ((clickX - b.x) ** 2 + (clickY - b.y) ** 2 <= Math.max(30, b.radius) ** 2));
    if (bh) {
      engine.world.draggedBlackhole = bh;
      return;
    }

    // Check for chrono well drag
    const cw = engine.world.sandboxChronoWells.find(c => !c.isDying && ((clickX - c.x) ** 2 + (clickY - c.y) ** 2 <= Math.max(35, c.radius) ** 2));
    if (cw) {
      engine.world.draggedChronoWell = cw;
      return;
    }

    // Check for planet drag
    const pl = engine.world.sandboxPlanets.find(p => !p.isDying && ((clickX - p.x) ** 2 + (clickY - p.y) ** 2 <= Math.max(35, p.radius) ** 2));
    if (pl) {
      engine.world.draggedPlanet = pl;
      return;
    }

    if (engine.world.activePower === 'DEFAULT') {
      transitionTo(engine, 'CHARGING');
    } else {
      // Meteor: record aim start point for slingshot-style launching
      if (engine.world.activePower === 'METEOR') {
        engine.world.meteorAimX = engine.world.mouse.x;
        engine.world.meteorAimY = engine.world.mouse.y;
      }
      pauseMouseGravity(engine);
    }
  }

export function onPointerUp(engine: CosmicCanvasEngine, event: PointerEvent): void {
    if (!engine.world.isMouseDown) {
      return;
    }
    engine.world.isMouseDown = false;

    if (
      engine.world.state === 'SINGULARITY' ||
      engine.world.state === 'MOON_DANCE' ||
      engine.world.state === 'AYA_FORMATION' ||
      engine.world.state === 'LOADING'
    ) {
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

    if (engine.world.draggedBlackhole || engine.world.draggedWormhole || engine.world.draggedChronoWell || engine.world.draggedPlanet) {
      engine.world.draggedBlackhole = null;
      engine.world.draggedWormhole = null;
      engine.world.draggedChronoWell = null;
      engine.world.draggedPlanet = null;
      clearTouchPointerStateIfNeeded(engine, event);
      return;
    }

    if (engine.world.activePower !== 'DEFAULT') {
      handleSandboxPowerRelease(engine);
      pauseMouseGravity(engine, 90);
      clearTouchPointerStateIfNeeded(engine, event);
      return;
    }

    if (engine.world.chargeTime >= 20) {
      updatePowerChargeAudio('DEFAULT', false, 0);
      playPowerReleaseSound('DEFAULT', 'super');
      triggerSuperMoveExplosion(engine);
    } else {
      updatePowerChargeAudio('DEFAULT', false, 0);
      playPowerReleaseSound('DEFAULT', 'tap');
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
    if (engine.world.state === 'SINGULARITY' || engine.world.state === 'MOON_DANCE' || engine.world.state === 'AYA_FORMATION' || engine.world.state === 'LOADING' || engine.world.isLogoBlackholeActive || engine.world.isAyaDanceActive) return;
    
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
    
    if (typeof document !== 'undefined' && document.body.classList.contains('is-aya-message')) {
      const customSpawn = (window as any).__ayaSpawnHearts;
      if (customSpawn) {
        customSpawn(logoX, logoY);
      }
      return;
    }

    startLogoBlackhole(engine, logoX, logoY);
  }

  // --- STATE MACHINE ROUTING ---
  /** Cursor gravity (SWARM pull) — active for all powers unless briefly paused on click. */
  /** Sandbox click/hold owns the cursor until mouseup. */
