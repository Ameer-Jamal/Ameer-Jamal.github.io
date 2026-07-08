import { PerformanceProfile } from '../../../utils/performance-profile';
import { SpatialHash } from '../../../utils/spatial-hash';
import { COSMIC_CONSTANTS } from '../models/cosmic.constants';
import {
  BackgroundBlackhole,
  BackgroundGalaxy,
  CosmicEasterEgg,
  GameState,
  Lightning,
  MousePower,
  MouseState,
  NebulaCloud,
  Particle,
  SandboxBlackhole,
  Shockwave,
  ShootingStar,
  SingularityState,
  SpaceComet,
  SpaceDust,
  Spark,
  TwinkleStar,
  Wormhole,
  SandboxChronoWell,
  SandboxMeteor,
  SandboxPlanet,
  QuantumRift,
  SandboxChargeTier
} from '../models/cosmic.types';

export interface CosmicWorld {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: GameState;
  stateTimer: number;
  particles: Particle[];
  backgroundStars: TwinkleStar[];
  spaceDust: SpaceDust[];
  nebulas: NebulaCloud[];
  sparks: Spark[];
  shockwaves: Shockwave[];
  lightnings: Lightning[];
  shootingStars: ShootingStar[];
  comets: SpaceComet[];
  backgroundGalaxies: BackgroundGalaxy[];
  easterEggs: CosmicEasterEgg[];
  uiAnchors: { x: number; y: number }[];
  lastAnchorUpdate: number;
  isLogoBlackholeActive: boolean;
  isAyaDanceActive: boolean;
  logoBlackholeTimer: number;
  logoElements: HTMLElement[];
  logoOrigPositions: { dx: number; dy: number }[];
  pageExplodeActive: boolean;
  pageExplodeTimer: number;
  pageExplodeStartTime: number;
  screenFlash: number;
  blackoutAlpha: number;
  isSandboxOpen: boolean;
  isSandboxPinned: boolean;
  activePower: MousePower;
  sandboxBlackholes: SandboxBlackhole[];
  draggedBlackhole: SandboxBlackhole | null;
  sandboxChronoWells: SandboxChronoWell[];
  draggedChronoWell: SandboxChronoWell | null;
  wormholes: Wormhole[];
  draggedWormhole: Wormhole | null;
  sandboxPlanets: SandboxPlanet[];
  draggedPlanet: SandboxPlanet | null;
  sandboxMeteors: SandboxMeteor[];
  quantumRifts: QuantumRift[];
  lassoReleaseQueued: boolean;
  lassoReleaseTier: SandboxChargeTier;
  meteorAimX: number;
  meteorAimY: number;
  nurseryStarCount: number;
  paintHoldFrame: number;
  mouse: MouseState;
  pointerInsideWindow: boolean;
  mouseMoving: boolean;
  lastMoveTime: number;
  isMouseDown: boolean;
  chargeTime: number;
  shakeTimer: number;
  mouseVelocity: { x: number; y: number };
  teslaHoldZapTimer: number;
  inversionNovaTimer: number;
  wormholeHypergateTimer: number;
  mouseGravityPauseTimer: number;
  singularity: SingularityState;
  backgroundBlackholes: BackgroundBlackhole[];
  flockEasingFactor: number;
  meteorShowerCount: number;
  meteorShowerDelay: number;
  animationFrameId: number | null;
  animationPaused: boolean;
  canvasWidth: number;
  canvasHeight: number;
  galaxyFrameTick: number;
  particleSpatialHash: SpatialHash;
  spatialQueryBuffer: number[];
  performanceProfile: PerformanceProfile;
  fpsFrameDeltas: number[];
  fpsLowStreak: number;
  fpsHighStreak: number;
  fpsGovernorCooldown: number;
  lastFrameTime: number;
  ayaEasterEggCooldownUntil: number;
  ayaFormationCenterX: number;
  ayaFormationCenterY: number;
  loadingSpinnerAngle: number;
  loadingSpinnerCenterX: number;
  loadingSpinnerCenterY: number;
  loadingSpinnerRadius: number;
  loadingStartedAt: number;
  pageReadyAt: number;
  pageAssetsReady: boolean;
  pageLoadCompleteTriggered: boolean;
  screenShake: number;
  lassoPath: { x: number; y: number }[];
}

export function createCosmicWorld(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): CosmicWorld {
  return {
    canvas,
    ctx,
    state: 'DRIFT',
    stateTimer: 0,
    particles: [],
    backgroundStars: [],
    spaceDust: [],
    nebulas: [],
    sparks: [],
    shockwaves: [],
    lightnings: [],
    shootingStars: [],
    comets: [],
    backgroundGalaxies: [],
    easterEggs: [],
    uiAnchors: [],
    lastAnchorUpdate: 0,
    isLogoBlackholeActive: false,
    isAyaDanceActive: false,
    logoBlackholeTimer: 0,
    logoElements: [],
    logoOrigPositions: [],
    pageExplodeActive: false,
    pageExplodeTimer: 0,
    pageExplodeStartTime: 0,
    screenFlash: 0,
    screenShake: 0,
    lassoPath: [],
    blackoutAlpha: 0,
    isSandboxOpen: false,
    isSandboxPinned: false,
    activePower: 'DEFAULT',
    sandboxBlackholes: [],
    draggedBlackhole: null,
    sandboxChronoWells: [],
    draggedChronoWell: null,
    wormholes: [],
    draggedWormhole: null,
    sandboxPlanets: [],
    draggedPlanet: null,
    sandboxMeteors: [],
    quantumRifts: [],
    lassoReleaseQueued: false,
    lassoReleaseTier: 'tap',
    meteorAimX: -1000,
    meteorAimY: -1000,
    nurseryStarCount: 0,
    paintHoldFrame: 0,
    mouse: { x: -1000, y: -1000, active: false },
    pointerInsideWindow: false,
    mouseMoving: false,
    lastMoveTime: 0,
    isMouseDown: false,
    chargeTime: 0,
    shakeTimer: 0,
    mouseVelocity: { x: 0, y: 0 },
    teslaHoldZapTimer: 0,
    inversionNovaTimer: 0,
    wormholeHypergateTimer: 0,
    mouseGravityPauseTimer: 0,
    singularity: { x: 0, y: 0, active: false, timer: 0 },
    backgroundBlackholes: [],
    flockEasingFactor: 0,
    meteorShowerCount: 0,
    meteorShowerDelay: 0,
    animationFrameId: null,
    animationPaused: false,
    canvasWidth: 0,
    canvasHeight: 0,
    galaxyFrameTick: 0,
    particleSpatialHash: new SpatialHash(COSMIC_CONSTANTS.SPATIAL_HASH_CELL_SIZE),
    spatialQueryBuffer: [],
    performanceProfile: null!,
    fpsFrameDeltas: [],
    fpsLowStreak: 0,
    fpsHighStreak: 0,
    fpsGovernorCooldown: 0,
    lastFrameTime: 0,
    ayaEasterEggCooldownUntil: 0,
    ayaFormationCenterX: 0,
    ayaFormationCenterY: 0,
    loadingSpinnerAngle: 0,
    loadingSpinnerCenterX: 0,
    loadingSpinnerCenterY: 0,
    loadingSpinnerRadius: 0,
    loadingStartedAt: 0,
    pageReadyAt: 0,
    pageAssetsReady: false,
    pageLoadCompleteTriggered: false
  };
}

export function getMaxParticles(world: CosmicWorld): number {
  return world.performanceProfile.maxParticles;
}

export function getMaxNurseryStars(world: CosmicWorld): number {
  return world.performanceProfile.maxNurseryStars;
}

export function getScaledConnectionDistance(world: CosmicWorld): number {
  return COSMIC_CONSTANTS.CONNECTION_DISTANCE * world.performanceProfile.connectionDistanceScale;
}
