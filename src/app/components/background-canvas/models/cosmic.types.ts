export type GameState = 'LOADING' | 'DRIFT' | 'SWARM' | 'CHARGING' | 'SINGULARITY' | 'EXPLODING' | 'MOON_DANCE' | 'AYA_FORMATION';

export type MousePower =
  | 'DEFAULT'
  | 'BLACK_HOLE'
  | 'PAINT_BRUSH'
  | 'REPELLER'
  | 'TESLA_DISCHARGE'
  | 'WORMHOLE'
  | 'NEBULAR_WIND'
  | 'TIME_DILATION'
  | 'PLANET'
  | 'METEOR'
  | 'STELLAR_LASSO'
  | 'QUANTUM_SPLITTER';

export interface QuantumRift {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  maxLife: number;
}


export type SandboxChargeTier = 'tap' | 'charged' | 'super';

export interface SandboxBlackhole {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  timer: number;
  maxTimer: number;
  pullRadius: number;
  gravityStrength: number;
  isDying?: boolean;
}

export interface SandboxChronoWell {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  timer: number;
  maxTimer: number;
  slowFactor: number;
  isDying?: boolean;
}

export interface SandboxPlanet {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  radius: number;
  baseRadius: number;
  mass: number;
  color: string;
  health: number;
  damageFlash: number;
  rotation?: number;
  rotationSpeed?: number;
  vertices?: number[];
  isFragment?: boolean;
  isDying?: boolean;
  deathTimer?: number;
}

export interface SandboxMeteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  timer: number;
  trail: { x: number; y: number }[];
  exploded: boolean;
}

export interface Wormhole {
  x: number;
  y: number;
  radius: number;
  type: 'ENTRY' | 'EXIT';
  pulsePhase: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVx: number;
  baseVy: number;
  radius: number;
  baseRadius: number;
  colorBlend: number;
  wobbleTimer: number;
  colorPrefix: string;
  flockable: boolean;
  life: number;
  birthProgress: number;
  deathProgress: number;
  isDying: boolean;
  behaviorState: 'CRUISE' | 'DECELERATE' | 'BURST';
  behaviorTimer: number;
  speedFactor: number;
  isNursery?: boolean;
  formationTx?: number;
  formationTy?: number;
  formationActive?: boolean;
  orbitAngle?: number;
  isHeart?: boolean;
  isLassoed?: boolean;
  isQuantumRift?: boolean;
}

export interface TwinkleStar {
  x: number;
  y: number;
  radius: number;
  phase: number;
  twinkleSpeed: number;
  color: string;
  isPulsar: boolean;
  pulsarPhase: number;
}

export interface SpaceDust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  alpha: number;
  color: string;
}

export interface Lightning {
  segments: { x: number; y: number }[];
  alpha: number;
}

export interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  alpha: number;
  colorPrefix: string;
}

export interface NebulaCloud {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  colorBase: string;
  maxOpacity: number;
  phase: number;
  scalePhase: number;
}

export interface SpaceComet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  active: boolean;
  speed: number;
  color: string;
}

export interface BackgroundBlackhole {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  timer: number;
  maxTimer: number;
}

export interface BackgroundGalaxy {
  x: number;
  y: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  arms: number;
  starCount: number;
  seed: number;
}

export interface CosmicEasterEgg {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  points: { x: number; y: number }[];
  connections: [number, number][];
  fadeRate?: number;
  palette?: 'default' | 'warm' | 'pink';
}

export interface ConstellationTemplate {
  points: { x: number; y: number }[];
  connections: [number, number][];
}

export interface MouseState {
  x: number;
  y: number;
  active: boolean;
}

export interface SingularityState {
  x: number;
  y: number;
  active: boolean;
  timer: number;
}

export interface SandboxTool {
  id: MousePower;
  name: string;
  desc: string;
  icon: string;
}
