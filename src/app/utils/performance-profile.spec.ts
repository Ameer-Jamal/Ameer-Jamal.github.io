import {
  downgradeTier,
  getProfileForTier,
  resolvePerformanceProfile,
  upgradeTier
} from './performance-profile';

describe('performance-profile', () => {
  it('should return low tier when prefers-reduced-motion is enabled', () => {
    const profile = resolvePerformanceProfile({ prefersReducedMotion: true });
    expect(profile.tier).toBe('low');
    expect(profile.maxParticles).toBe(35);
  });

  it('should return high tier for desktop-like devices with enough cores', () => {
    const profile = resolvePerformanceProfile({
      prefersReducedMotion: false,
      hardwareConcurrency: 8,
      coarsePointer: false,
      maxTouchPoints: 0,
      devicePixelRatio: 1
    });
    expect(profile.tier).toBe('high');
    expect(profile.maxParticles).toBe(115);
    expect(profile.dprCap).toBe(2.0);
  });

  it('should return low tier for coarse-pointer mobile devices with limited cores', () => {
    const profile = resolvePerformanceProfile({
      prefersReducedMotion: false,
      hardwareConcurrency: 4,
      coarsePointer: true,
      maxTouchPoints: 5,
      devicePixelRatio: 3
    });
    expect(profile.tier).toBe('low');
    expect(profile.skipBreeding).toBe(true);
    expect(profile.skipDomTremble).toBe(true);
  });

  it('should return medium tier for mid-range mobile devices', () => {
    const profile = resolvePerformanceProfile({
      prefersReducedMotion: false,
      hardwareConcurrency: 8,
      coarsePointer: true,
      maxTouchPoints: 5,
      devicePixelRatio: 2
    });
    expect(profile.tier).toBe('medium');
    expect(profile.maxParticles).toBe(65);
  });

  it('should step tiers up and down predictably', () => {
    expect(downgradeTier('high')).toBe('medium');
    expect(downgradeTier('medium')).toBe('low');
    expect(downgradeTier('low')).toBeNull();
    expect(upgradeTier('low')).toBe('medium');
    expect(upgradeTier('medium')).toBe('high');
    expect(upgradeTier('high')).toBeNull();
  });

  it('should clone profile values per tier', () => {
    const high = getProfileForTier('high');
    high.maxParticles = 1;
    expect(getProfileForTier('high').maxParticles).toBe(115);
    expect(getProfileForTier('medium').galaxyUpdateStride).toBe(3);
    expect(getProfileForTier('low').galaxyUpdateStride).toBe(4);
  });
});
