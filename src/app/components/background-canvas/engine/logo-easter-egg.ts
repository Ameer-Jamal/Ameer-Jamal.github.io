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

export function startLogoBlackhole(engine: CosmicCanvasEngine, logoX: number, logoY: number): void {
    if (engine.world.isLogoBlackholeActive) return;
    
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
    
    if (typeof document === 'undefined') return;
    
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

      // Select all individual layout elements and their container borders/outlines to explode
      const selectors = [
        '#header nav',
        '#header nav ul li',
        '#header .content',
        '#header .content h1',
        '#header .content p',
        '#header .subIntro p',
        '#main',
        '#main article.active',
        '#main article.active h2',
        '#main article.active h3',
        '#main article.active p',
        '#main article.active a',
        '#main article.active li',
        '#main article.active .close',
        '#main article.active .field',
        '#main article.active input',
        '#main article.active textarea',
        '#main article.active #github-projects > *',
        'footer',
        'footer p',
        'footer ul li'
      ];
      
      const elements: HTMLElement[] = [];
      const rawElements = Array.from(document.querySelectorAll(selectors.join(','))) as HTMLElement[];
      
      rawElements.forEach((htmlEl) => {
        const rect = htmlEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          elements.push(htmlEl);
        }
      });
      
      engine.world.logoElements = elements;
      engine.world.logoOrigPositions = [];
      
      engine.world.logoElements.forEach(htmlEl => {
        const rect = htmlEl.getBoundingClientRect();
        const elX = rect.left + rect.width / 2;
        const elY = rect.top + rect.height / 2;
        
        engine.world.logoOrigPositions.push({
          dx: logoX - elX,
          dy: logoY - elY
        });
      });
    } catch (e) {
      console.warn('[LogoMoonDance] Failed initialization:', e);
    }
  }


export function endLogoBlackhole(engine: CosmicCanvasEngine): void {
    try {
      const logoEl = document.querySelector('.logo') as HTMLElement;
      const logoImg = document.querySelector('.logoImg') as HTMLElement;
      
      if (logoEl) {
        logoEl.classList.remove('logo-moon-transform');
        logoEl.classList.remove('logo-moon-explode');
        logoEl.style.transition = 'none';
        logoEl.style.transform = 'scale(0.1)';
        logoEl.style.opacity = '0';
        logoEl.style.boxShadow = '';
        logoEl.style.borderColor = '';
        logoEl.style.background = '';
        void logoEl.offsetHeight; // force reflow
        logoEl.style.transition = 'transform 1.2s cubic-bezier(0.15, 0.85, 0.3, 1.25), opacity 1.2s ease-out';
        logoEl.style.transform = '';
        logoEl.style.opacity = '1';
      }
      
      if (logoImg) {
        logoImg.classList.remove('logo-moon-transform-img');
        logoImg.classList.remove('logo-moon-explode');
        logoImg.style.transition = 'none';
        logoImg.style.transform = '';
        logoImg.style.filter = '';
        logoImg.style.opacity = '1';
      }

      // Restore structural containers with a gravitational snapping animation
      if (engine.world.logoElements) {
        engine.world.logoElements.forEach(htmlEl => {
          if (htmlEl && htmlEl.style) {
            htmlEl.style.transition = 'transform 2.2s cubic-bezier(0.25, 1.5, 0.45, 1), opacity 0.5s ease-out';
            htmlEl.style.transform = 'translate(0, 0) scale(1) rotate(0deg)';
            htmlEl.style.opacity = '1';
          }
        });
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
          logoEl.style.transform = '';
          logoEl.style.opacity = '';
        }
        if (logoImg) {
          logoImg.style.transition = '';
          logoImg.style.transform = '';
          logoImg.style.opacity = '';
        }
        
        if (engine.world.logoElements) {
          engine.world.logoElements.forEach(htmlEl => {
            if (htmlEl && htmlEl.style) {
              htmlEl.style.transition = '';
              htmlEl.style.transform = '';
              htmlEl.style.opacity = '';
            }
          });
        }
      } catch (e) {
        console.warn('[LogoBlackhole] Failed cleanup:', e);
      }
      engine.world.isLogoBlackholeActive = false;
      engine.world.logoElements = [];
      engine.world.logoOrigPositions = [];
    }, 1900);
  }

