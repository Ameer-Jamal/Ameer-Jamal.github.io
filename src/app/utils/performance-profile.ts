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
    maxParticles: 115,
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
    dprCap: 1.25,
    maxParticles: 65,
    backgroundStarDivisor: 10000,
    galaxyStarMultiplier: 0.35,
    dustDivisor: 17000,
    maxNurseryStars: 36,
    connectionDistanceScale: 0.82,
    skipBreeding: false,
    skipPulsarRings: false,
    skipDomTremble: true,
    effectScale: 0.5,
    galaxyUpdateStride: 3
  },
  low: {
    tier: 'low',
    dprCap: 1.0,
    maxParticles: 35,
    backgroundStarDivisor: 15000,
    galaxyStarMultiplier: 0.15,
    dustDivisor: 26000,
    maxNurseryStars: 18,
    connectionDistanceScale: 0.68,
    skipBreeding: true,
    skipPulsarRings: true,
    skipDomTremble: true,
    effectScale: 0.25,
    galaxyUpdateStride: 4
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

  if (isMobileLike && dpr >= 2.5) {
    return getProfileForTier('low');
  }

  if (isMobileLike && cores <= 6) {
    return getProfileForTier('low');
  }

  if (isMobileLike) {
    return getProfileForTier('medium');
  }

  return getProfileForTier('medium');
}
