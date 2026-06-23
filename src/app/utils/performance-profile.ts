export type PerformanceTier = 'high' | 'medium' | 'low';

export interface PerformanceProfile {
  tier: PerformanceTier;
  dprCap: number;
  maxParticles: number;
  backgroundStarDivisor: number;
  galaxyStarMultiplier: number;
  dustDivisor: number;
  maxNurseryStars: number;
  connectionDistanceScale: number;
  skipBreeding: boolean;
  skipPulsarRings: boolean;
  skipDomTremble: boolean;
  effectScale: number;
  galaxyUpdateStride: number;
}

export interface PerformanceDetectionContext {
  hardwareConcurrency?: number;
  devicePixelRatio?: number;
  maxTouchPoints?: number;
  prefersReducedMotion?: boolean;
  coarsePointer?: boolean;
}

const PROFILES: Record<PerformanceTier, PerformanceProfile> = {
  high: {
    tier: 'high',
    dprCap: 2.0,
    maxParticles: 145,
    backgroundStarDivisor: 6000,
    galaxyStarMultiplier: 1.0,
    dustDivisor: 10000,
    maxNurseryStars: 80,
    connectionDistanceScale: 1.0,
    skipBreeding: false,
    skipPulsarRings: false,
    skipDomTremble: false,
    effectScale: 1.0,
    galaxyUpdateStride: 1
  },
  medium: {
    tier: 'medium',
    dprCap: 1.5,
    maxParticles: 100,
    backgroundStarDivisor: 8000,
    galaxyStarMultiplier: 0.5,
    dustDivisor: 14000,
    maxNurseryStars: 50,
    connectionDistanceScale: 0.88,
    skipBreeding: false,
    skipPulsarRings: false,
    skipDomTremble: true,
    effectScale: 0.65,
    galaxyUpdateStride: 2
  },
  low: {
    tier: 'low',
    dprCap: 1.25,
    maxParticles: 70,
    backgroundStarDivisor: 12000,
    galaxyStarMultiplier: 0.25,
    dustDivisor: 20000,
    maxNurseryStars: 30,
    connectionDistanceScale: 0.75,
    skipBreeding: true,
    skipPulsarRings: true,
    skipDomTremble: true,
    effectScale: 0.4,
    galaxyUpdateStride: 3
  }
};

export function getProfileForTier(tier: PerformanceTier): PerformanceProfile {
  return { ...PROFILES[tier] };
}

export function downgradeTier(current: PerformanceTier): PerformanceTier | null {
  if (current === 'high') {
    return 'medium';
  }
  if (current === 'medium') {
    return 'low';
  }
  return null;
}

export function upgradeTier(current: PerformanceTier): PerformanceTier | null {
  if (current === 'low') {
    return 'medium';
  }
  if (current === 'medium') {
    return 'high';
  }
  return null;
}

export function resolvePerformanceProfile(ctx?: PerformanceDetectionContext): PerformanceProfile {
  const prefersReducedMotion = ctx?.prefersReducedMotion ??
    (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  if (prefersReducedMotion) {
    return getProfileForTier('low');
  }

  const cores = ctx?.hardwareConcurrency ??
    (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined) ??
    4;
  const dpr = ctx?.devicePixelRatio ??
    (typeof window !== 'undefined' ? window.devicePixelRatio : undefined) ??
    1;
  const maxTouchPoints = ctx?.maxTouchPoints ??
    (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : undefined) ??
    0;
  const coarsePointer = ctx?.coarsePointer ??
    (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);
  const isMobileLike = coarsePointer || maxTouchPoints > 0;

  if (!isMobileLike && cores >= 6) {
    return getProfileForTier('high');
  }

  if (isMobileLike && cores <= 4 && dpr >= 2) {
    return getProfileForTier('low');
  }

  if (isMobileLike && cores <= 4) {
    return getProfileForTier('low');
  }

  return getProfileForTier('medium');
}
