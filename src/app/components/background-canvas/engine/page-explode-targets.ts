import type { CosmicCanvasEngine } from './cosmic-canvas-engine';
import { getAyaLetterScale } from '../models/aya-constellation';

/** DOM nodes that fly out and snap back during moon-dance / aya page explode. */
export const PAGE_EXPLODE_SELECTORS = [
  '#header .content',
  '#header .content .inner',
  '#header nav',
  '#header nav ul',
  '#header nav ul li',
  '#header nav ul li a',
  '#header .content h1',
  '#header .content p',
  '#header .subIntro p',
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
  '#footer p',
  '#footer ul li'
];

const LOGO_PULL_SELECTORS = ['.logo', '.logoImg'];

export function getLogoSingularityCoords(engine: CosmicCanvasEngine): { x: number; y: number } {
  const canvas = engine.world.canvas;
  const canvasRect = canvas.getBoundingClientRect();
  let x = engine.world.canvasWidth / 2 || canvasRect.width / 2;
  let y = 120;

  if (typeof document !== 'undefined') {
    const logoImg = document.querySelector('.logoImg') || document.querySelector('.logo');
    if (logoImg) {
      const rect = logoImg.getBoundingClientRect();
      x = rect.left + rect.width / 2 - canvasRect.left;
      y = rect.top + rect.height / 2 - canvasRect.top;
    }
  }

  return { x, y };
}

export function getAyaFormationAnchor(
  engine: CosmicCanvasEngine,
  logoX: number,
  logoY: number
): { x: number; y: number } {
  const width = engine.world.canvasWidth || logoX * 2;
  const height = engine.world.canvasHeight || logoY * 2;
  const scale = getAyaLetterScale(width, height);
  // Sit the letters near the top of the screen: leave a small margin above the
  // top arms (letters span +/- ~0.42 * scale vertically around the center).
  const topMargin = Math.max(height * 0.05, 24);
  return {
    x: logoX,
    y: topMargin + scale * 0.42
  };
}

export function collectPageExplodeElements(
  engine: CosmicCanvasEngine,
  centerX: number,
  centerY: number,
  options?: { includeLogo?: boolean }
): void {
  if (typeof document === 'undefined') {
    return;
  }

  const selectors = options?.includeLogo
    ? [...LOGO_PULL_SELECTORS, ...PAGE_EXPLODE_SELECTORS]
    : PAGE_EXPLODE_SELECTORS;

  const elements: HTMLElement[] = [];
  const rawElements = Array.from(document.querySelectorAll(selectors.join(','))) as HTMLElement[];

  rawElements.forEach((htmlEl) => {
    const rect = htmlEl.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      elements.push(htmlEl);
    }
  });

  const canvas = engine.world.canvas;
  const canvasRect = canvas.getBoundingClientRect();

  engine.world.logoElements = elements;
  engine.world.logoOrigPositions = elements.map((htmlEl) => {
    const rect = htmlEl.getBoundingClientRect();
    const elX = rect.left + rect.width / 2 - canvasRect.left;
    const elY = rect.top + rect.height / 2 - canvasRect.top;
    return {
      dx: centerX - elX,
      dy: centerY - elY
    };
  });
}

export function applyPageExplodeFrame(
  htmlEl: HTMLElement,
  orig: { dx: number; dy: number },
  progress: number,
  index: number
): void {
  const dirX = -orig.dx;
  const dirY = -orig.dy;
  const lenDist = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
  const ndx = dirX / lenDist;
  const ndy = dirY / lenDist;

  const blastDistance = Math.pow(progress, 1.15) * 1100;
  const tx = ndx * blastDistance;
  const ty = ndy * blastDistance;

  const rotate = progress * 960 * (index % 2 === 0 ? 1 : -1);
  const scale = Math.max(0, 1.0 - Math.pow(progress, 1.6));
  const opacity = Math.max(0, 1.0 - Math.pow(progress, 1.3));

  htmlEl.style.setProperty('transition', 'none', 'important');
  htmlEl.style.setProperty(
    'transform',
    `translate3d(${tx}px, ${ty}px, 0) rotate(${rotate}deg) scale(${scale})`,
    'important'
  );
  htmlEl.style.setProperty('opacity', `${opacity}`, 'important');
}

const REASSEMBLE_STAGGER_MS = 25;
const REASSEMBLE_STAGGER_MAX_MS = 400;

export function restorePageExplodeElements(elements: HTMLElement[], transformDurationMs: number): void {
  elements.forEach((htmlEl, index) => {
    if (!htmlEl?.style) {
      return;
    }

    // Start from the exploded state (still scattered + invisible), then ease both
    // transform and opacity back together so elements visibly cascade into place.
    const delay = Math.min(index * REASSEMBLE_STAGGER_MS, REASSEMBLE_STAGGER_MAX_MS);
    htmlEl.style.setProperty('transition', 'none', 'important');
    htmlEl.style.setProperty('opacity', '0', 'important');
    void htmlEl.offsetHeight;
    htmlEl.style.setProperty(
      'transition',
      `transform ${transformDurationMs}ms cubic-bezier(0.25, 1.5, 0.45, 1) ${delay}ms, opacity ${Math.round(
        transformDurationMs * 0.7
      )}ms ease-in ${delay}ms`,
      'important'
    );
    htmlEl.style.setProperty('transform', 'translate3d(0, 0, 0) scale(1) rotate(0deg)', 'important');
    htmlEl.style.setProperty('opacity', '1', 'important');
  });
}

export function clearPageExplodeInlineStyles(elements: HTMLElement[]): void {
  elements.forEach((htmlEl) => {
    if (!htmlEl?.style) {
      return;
    }
    htmlEl.style.transition = '';
    htmlEl.style.transform = '';
    htmlEl.style.opacity = '';
  });
}
