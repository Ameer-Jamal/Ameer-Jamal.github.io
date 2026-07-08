import { MousePower } from '../../models/cosmic.types';
import type { CosmicCanvasEngine } from '../cosmic-canvas-engine';
import { playClearSound, playSelectPowerSound, playToggleSandboxSound } from '../audio';

export function toggleSandboxBar(engine: CosmicCanvasEngine): void {
    engine.world.isSandboxOpen = !engine.world.isSandboxOpen;
    playToggleSandboxSound(engine.world.isSandboxOpen);
  }

export function toggleSandboxPin(engine: CosmicCanvasEngine): void {
    engine.world.isSandboxPinned = !engine.world.isSandboxPinned;
  }

export function selectPower(engine: CosmicCanvasEngine, power: MousePower): void {
    engine.world.activePower = power;
    playSelectPowerSound(power);
  }

export function clearSandboxElements(engine: CosmicCanvasEngine): void {
    playClearSound();
    engine.world.sandboxBlackholes = [];
    engine.world.sandboxChronoWells = [];
    engine.world.sandboxPlanets = [];
    engine.world.draggedPlanet = null;
    engine.world.sandboxMeteors = [];
    engine.world.wormholes = [];
    engine.world.wormholeHypergateTimer = 0;
    engine.world.inversionNovaTimer = 0;
    engine.world.particles = engine.world.particles.filter(p => !p.isNursery);
    engine.world.nurseryStarCount = 0;
    engine.world.paintHoldFrame = 0;
    engine.world.quantumRifts = [];
  }
