#!/usr/bin/env node
/**
 * Splits cosmic-canvas-engine.ts methods into focused engine modules.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ENGINE_DIR = path.join(ROOT, 'src/app/components/background-canvas/engine');

const monolithPath = process.argv[2] || '/tmp/cosmic-canvas-engine.monolith.ts';
const engineSrc = fs.readFileSync(monolithPath, 'utf8');
const lines = engineSrc.split('\n');

const skipMethods = new Set(['constructor', 'init', 'destroy', 'startAnimation', 'pauseAnimation', 'handleResize', 'animate']);

const methodStarts = [];
for (let i = 0; i < lines.length; i++) {
  const priv = lines[i].match(/^  private (\w+)\(/);
  const pub = lines[i].match(/^  public (\w+)\(/);
  const name = priv?.[1] ?? pub?.[1];
  if (name && !skipMethods.has(name) && !methodStarts.find((s) => s.name === name)) {
    methodStarts.push({ name, line: i });
  }
}
methodStarts.sort((a, b) => a.line - b.line);

const initLine = lines.findIndex((l) => l.trim() === 'init(): void {');
const methods = {};
for (let i = 0; i < methodStarts.length; i++) {
  const start = methodStarts[i].line;
  const end = i + 1 < methodStarts.length ? methodStarts[i + 1].line : initLine;
  methods[methodStarts[i].name] = lines.slice(start, end).join('\n');
}

const modules = {
  'fps-governor.ts': ['stopAnimationLoop', 'resetFpsGovernorStreaks', 'applyPerformanceTier', 'tickFpsGovernor'],
  'input-controller.ts': [
    'updatePointerCoords', 'clearPointerState', 'clearTouchPointerStateIfNeeded',
    'onPointerEnter', 'onPointerMove', 'onPointerLeave', 'onPointerCancel', 'onPointerDown', 'onPointerUp',
    'onMouseMove', 'onMouseLeave', 'onMouseDown', 'onMouseUp', 'onLogoBlackholeTrigger'
  ],
  'state-machine.ts': [
    'isSandboxPowerEngaged', 'isSandboxPowerChannelActive', 'isMouseGravityPaused', 'isMouseGravityActive',
    'pauseMouseGravity', 'usesDefaultMouseGravity', 'transitionTo', 'triggerRandomStopAction',
    'triggerNormalClickShockwave', 'triggerSuperMoveExplosion', 'triggerSupernovaBurst',
    'triggerTeslaDischarge', 'triggerNebulaWave', 'blastParticlesAway'
  ],
  'particle-system.ts': [
    'spawnStellarBirth', 'spawnNurseryStar', 'spawnStardustPuff', 'spawnMiniSupernova',
    'initParticles', 'isIntenseParticleMesh', 'findRandomNearbyParticle', 'findNearestParticleIndices'
  ],
  'background-layers.ts': [
    'resizeCanvas', 'initNebulas', 'initStars', 'initGalaxies', 'drawGalaxy',
    'updateAndDrawComets', 'getLensedCoords', 'updateUIAnchors'
  ],
  'effects.ts': ['drawMiniChargeArc', 'spawnEasterEggConstellation', 'drawEasterEggs'],
  'logo-easter-egg.ts': ['startLogoBlackhole', 'endLogoBlackhole'],
  'sandbox-powers.ts': [
    'toggleSandboxBar', 'toggleSandboxPin', 'selectPower', 'clearSandboxElements',
    'getSandboxChargeProgress', 'getSandboxChargeTier', 'isSandboxSuperCharged', 'tickSandboxCharge',
    'drawSandboxChargeAura', 'drawSandboxPowerChargeAuras', 'handleSandboxPowerRelease',
    'spawnSandboxBlackhole', 'applyBlackHolePreviewGravity', 'drawBlackHolePreview',
    'releaseRepellerPower', 'releaseTimeDilationPower', 'releaseNebularWindPower',
    'releasePaintBrushPower', 'tryWormholeCapture', 'applyWormholeForcesToParticle',
    'applySandboxBlackholeForces', 'placeWormholePortal', 'releaseWormholePower',
    'triggerTeslaDischargePower', 'tickTeslaHoldZaps', 'updateAndDrawSandboxElements'
  ],
  'draw-frame.ts': ['draw']
};

const methodToModule = {};
for (const [file, names] of Object.entries(modules)) {
  for (const n of names) methodToModule[n] = file.replace('.ts', '');
}

const allMethodNames = Object.keys(methods);

function convertMethod(name, code) {
  let fn = code.replace(/^  (public |private )/, 'export function ');
  fn = fn.replace(new RegExp(`^export function ${name}\\(`), `export function ${name}(engine: CosmicCanvasEngine, `);
  fn = fn.replace(/\(engine: CosmicCanvasEngine, \)/g, '(engine: CosmicCanvasEngine)');

  fn = fn.replace(/\bthis\.world\./g, 'engine.world.');

  for (const other of allMethodNames) {
    fn = fn.replace(new RegExp(`\\bthis\\.${other}\\(`, 'g'), `${other}(engine, `);
  }

  fn = fn.replace(/\(engine, engine\)/g, '(engine)');
  fn = fn.replace(/\(engine, engine,/g, '(engine,');
  fn = fn.replace(/\(engine,\s*\)/g, '(engine)');

  return fn;
}

function getImportsForModule(methodNames) {
  const localSet = new Set(methodNames);
  const needed = new Set();
  for (const name of methodNames) {
    const code = methods[name] || '';
    for (const other of allMethodNames) {
      if (localSet.has(other)) continue;
      if (code.includes(`this.${other}(`)) {
        needed.add(other);
      }
    }
  }

  const importGroups = {};
  for (const n of needed) {
    const mod = methodToModule[n];
    if (!mod) continue;
    if (!importGroups[mod]) importGroups[mod] = [];
    importGroups[mod].push(n);
  }

  let imports = '';
  for (const [mod, fns] of Object.entries(importGroups)) {
    imports += `import { ${fns.join(', ')} } from './${mod}';\n`;
  }
  return imports;
}

const baseImports = `import {
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

`;

for (const [filename, methodNames] of Object.entries(modules)) {
  const crossImports = getImportsForModule(methodNames);
  const fns = methodNames
    .filter((n) => methods[n])
    .map((n) => convertMethod(n, methods[n]));
  if (fns.length === 0) continue;
  fs.writeFileSync(path.join(ENGINE_DIR, filename), baseImports + crossImports + '\n' + fns.join('\n\n') + '\n');
}

const orchestrator = `import {
  PerformanceTier,
  resolvePerformanceProfile
} from '../../../utils/performance-profile';
import { TOOLS_LIST } from '../models/cosmic.constants';
import { MousePower } from '../models/cosmic.types';
import { applyPerformanceTier, resetFpsGovernorStreaks, stopAnimationLoop, tickFpsGovernor } from './fps-governor';
import { draw } from './draw-frame';
import { initNebulas, initStars, initGalaxies, resizeCanvas } from './background-layers';
import { initParticles } from './particle-system';
import {
  clearSandboxElements,
  selectPower,
  toggleSandboxBar,
  toggleSandboxPin
} from './sandbox-powers';
import {
  onLogoBlackholeTrigger,
  onMouseDown,
  onMouseLeave,
  onMouseMove,
  onMouseUp,
  onPointerCancel,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  onPointerUp
} from './input-controller';
import { CosmicWorld, createCosmicWorld } from './cosmic-world';

export { TOOLS_LIST };

export class CosmicCanvasEngine {
  readonly world: CosmicWorld;
  private animateBound = () => this.animate();

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.world = createCosmicWorld(canvas, ctx);
  }

  init(): void {
    if (typeof window === 'undefined') return;
    this.world.performanceProfile = resolvePerformanceProfile();
    applyPerformanceTier(this, this.world.performanceProfile.tier, false);
    initNebulas(this);
    initParticles(this);
    this.animate();
  }

  destroy(): void {
    stopAnimationLoop(this);
  }

  startAnimation(): void {
    if (!this.world.animationPaused) return;
    this.world.animationPaused = false;
    resetFpsGovernorStreaks(this);
    this.animate();
  }

  pauseAnimation(): void {
    stopAnimationLoop(this);
    this.world.animationPaused = true;
  }

  handleResize(): void {
    resizeCanvas(this);
    initNebulas(this);
    initStars(this);
    initGalaxies(this);
    initParticles(this);
  }

  private animate(): void {
    if (this.world.animationPaused) return;
    tickFpsGovernor(this, typeof performance !== 'undefined' ? performance.now() : Date.now());
    draw(this);
    this.world.animationFrameId = requestAnimationFrame(this.animateBound);
  }

  applyPerformanceTier(tier: PerformanceTier, reinitParticles = true): void {
    applyPerformanceTier(this, tier, reinitParticles);
  }

  public toggleSandboxBar(): void { toggleSandboxBar(this); }
  public toggleSandboxPin(): void { toggleSandboxPin(this); }
  public selectPower(power: MousePower): void { selectPower(this, power); }
  public clearSandboxElements(): void { clearSandboxElements(this); }

  public onPointerEnter(event: PointerEvent): void { onPointerEnter(this, event); }
  public onPointerMove(event: PointerEvent): void { onPointerMove(this, event); }
  public onPointerLeave(event: PointerEvent): void { onPointerLeave(this, event); }
  public onPointerCancel(event: PointerEvent): void { onPointerCancel(this, event); }
  public onPointerDown(event: PointerEvent): void { onPointerDown(this, event); }
  public onPointerUp(event: PointerEvent): void { onPointerUp(this, event); }
  public onMouseMove(event: MouseEvent): void { onMouseMove(this, event); }
  public onMouseLeave(): void { onMouseLeave(this); }
  public onMouseDown(event: MouseEvent): void { onMouseDown(this, event); }
  public onMouseUp(event: MouseEvent): void { onMouseUp(this, event); }
  public onLogoBlackholeTrigger(): void { onLogoBlackholeTrigger(this); }
}
`;

fs.writeFileSync(path.join(ENGINE_DIR, 'cosmic-canvas-engine.ts'), orchestrator);
console.log('Split complete');
