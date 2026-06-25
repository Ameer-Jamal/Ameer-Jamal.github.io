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

import { transitionTo } from './state-machine';
import {
  clearPageExplodeInlineStyles,
  restorePageExplodeElements
} from './page-explode-targets';
import { startBlackholeHum } from './audio';

export function startLogoBlackhole(engine: CosmicCanvasEngine, logoX: number, logoY: number): void {
    if (engine.world.isLogoBlackholeActive || engine.world.isAyaDanceActive) return;
    
    engine.world.isLogoBlackholeActive = true;
    engine.world.logoBlackholeTimer = 0;
    
    // Set singularity target coordinates to logo center
    engine.world.singularity.x = logoX;
    engine.world.singularity.y = logoY;
    engine.world.singularity.active = true;
    engine.world.singularity.timer = 390;
    
    transitionTo(engine, 'MOON_DANCE');
    engine.world.stateTimer = 390;
    engine.world.shakeTimer = 0; // wait to shake on blast

    // Loud collapse build-up that crescendos into the big-bang explosion (390f ≈ 6.5s).
    startBlackholeHum(6.5);
    
    if (typeof document === 'undefined') return;

    document.body.classList.add('is-moon-dance-active');
    
    try {
      const logoEl = document.querySelector('.logo') as HTMLElement;
      const logoImg = document.querySelector('.logoImg') as HTMLElement;
      if (logoEl) {
        logoEl.classList.remove('logo-moon-explode');
        logoEl.classList.add('logo-moon-transform');
      }
      if (logoImg) {
        logoImg.classList.remove('logo-moon-explode');
        logoImg.classList.add('logo-moon-transform-img');
      }

    } catch (e) {
      console.warn('[LogoMoonDance] Failed initialization:', e);
    }
  }


export function endLogoBlackhole(engine: CosmicCanvasEngine): void {
    engine.world.isLogoBlackholeActive = false;
    if (typeof document !== 'undefined') {
      document.body.classList.remove('is-moon-dance-active');
    }

    try {
      const logoEl = document.querySelector('.logo') as HTMLElement;
      const logoImg = document.querySelector('.logoImg') as HTMLElement;
      
      if (logoEl) {
        logoEl.classList.remove('logo-moon-transform');
        logoEl.classList.remove('logo-moon-explode');
        logoEl.style.setProperty('transition', 'none', 'important');
        logoEl.style.setProperty('transform', 'scale(0.1)', 'important');
        logoEl.style.setProperty('opacity', '0', 'important');
        logoEl.style.boxShadow = '';
        logoEl.style.borderColor = '';
        logoEl.style.background = '';
        void logoEl.offsetHeight; // force reflow
        logoEl.style.setProperty('transition', 'transform 1.2s cubic-bezier(0.15, 0.85, 0.3, 1.25), opacity 1.2s ease-out', 'important');
        logoEl.style.setProperty('transform', 'scale(1) translate3d(0, 0, 0)', 'important');
        logoEl.style.setProperty('opacity', '1', 'important');
      }
      
      if (logoImg) {
        logoImg.classList.remove('logo-moon-transform-img');
        logoImg.classList.remove('logo-moon-explode');
        logoImg.style.transition = 'none';
        logoImg.style.transform = '';
        logoImg.style.filter = '';
        logoImg.style.opacity = '1';
      }

      if (engine.world.logoElements.length > 0) {
        restorePageExplodeElements(engine.world.logoElements, 2400);
      }
    } catch (e) {
      console.warn('[LogoBlackhole] Failed restore:', e);
    }

    // Cleanup reference arrays and restore original CSS transitions/parallax states
    setTimeout(() => {
      try {
        const logoEl = document.querySelector('.logo') as HTMLElement;
        const logoImg = document.querySelector('.logoImg') as HTMLElement;
        if (logoEl) {
          logoEl.style.transition = '';
          (logoEl.style as any).webkitTransition = '';
          logoEl.style.transform = '';
          (logoEl.style as any).webkitTransform = '';
          logoEl.style.opacity = '';
          logoEl.style.boxShadow = '';
          logoEl.style.borderColor = '';
          logoEl.style.background = '';
        }
        if (logoImg) {
          logoImg.style.transition = '';
          (logoImg.style as any).webkitTransition = '';
          logoImg.style.transform = '';
          (logoImg.style as any).webkitTransform = '';
          logoImg.style.opacity = '';
        }
        
        clearPageExplodeInlineStyles(engine.world.logoElements);
      } catch (e) {
        console.warn('[LogoBlackhole] Failed cleanup:', e);
      }
      engine.world.logoElements = [];
      engine.world.logoOrigPositions = [];
    }, 3000);
  }

