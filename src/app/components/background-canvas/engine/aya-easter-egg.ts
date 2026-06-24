import type { CosmicCanvasEngine } from './cosmic-canvas-engine';
import { transitionTo } from './state-machine';
import {
  clearPageExplodeInlineStyles,
  getAyaFormationAnchor,
  getLogoSingularityCoords,
  restorePageExplodeElements
} from './page-explode-targets';

const AYA_SEQUENCE = 'aya';
const KEY_TIMEOUT_MS = 2000;
const AYA_DANCE_COOLDOWN_MS = 0;

const AYA_NAME = 'Aya';
const AYA_MIDLINE = 'Najoomtee ⭐';
const AYA_TAGLINE = 'I love you endlessly, Thank you for always being by my side, there is nothing I wouldn\'t do for you, may the stars forever guide us towards each others hearts ❤️';

const REASSEMBLE_MS = 2400;
const STAGGER_MAX_MS = 400;
const MESSAGE_HOLD_MS = 60_000;

/** Nav link copy, keyed by anchor href, swapped during Aya's time. */
const AYA_NAV_LABELS: Record<string, string> = {
  '#CV': 'Habibti',
  '#work': 'Hayati',
  '#contact': 'Albi'
};

let keyBuffer = '';
let lastKeyTime = 0;

/** Original header/nav copy, captured once so re-triggers during the hold are safe. */
let ayaOriginalText: { el: HTMLElement; html: string; love: string }[] | null = null;
let ayaRevertTimer: ReturnType<typeof setTimeout> | null = null;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof HTMLElement === 'undefined') {
    return false;
  }
  const el = target as HTMLElement;
  if (el.isContentEditable) {
    return true;
  }
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** Collect every element whose copy changes during Aya's time, with its love text. */
function getAyaSwapTargets(): { el: HTMLElement; love: string }[] {
  const targets: { el: HTMLElement; love: string }[] = [];

  const h1 = document.querySelector('#header .content h1') as HTMLElement | null;
  const inner = document.querySelector('#header .content .inner') as HTMLElement | null;
  const mid = inner ? (inner.querySelector(':scope > p') as HTMLElement | null) : null;
  const sub = document.querySelector('#header .subIntro p') as HTMLElement | null;
  if (h1) targets.push({ el: h1, love: AYA_NAME });
  if (mid) targets.push({ el: mid, love: AYA_MIDLINE });
  if (sub) targets.push({ el: sub, love: AYA_TAGLINE });

  document.querySelectorAll('#header nav ul li a').forEach((node) => {
    const link = node as HTMLElement;
    const love = AYA_NAV_LABELS[link.getAttribute('href') ?? ''];
    if (love) {
      targets.push({ el: link, love });
    }
  });

  return targets;
}

/** Swap the header + nav into the love message (called while the text is hidden). */
export function showAyaMessage(): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (!ayaOriginalText) {
    ayaOriginalText = getAyaSwapTargets().map((t) => ({
      el: t.el,
      html: t.el.innerHTML,
      love: t.love
    }));
  }

  ayaOriginalText.forEach(({ el, love }) => {
    el.textContent = love;
  });

  document.body.classList.add('is-aya-message');
}

/** Cross-fade the header + nav smoothly back to their original copy. */
export function revertAyaMessage(): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (!ayaOriginalText) {
    document.body.classList.remove('is-aya-message');
    return;
  }

  const originals = ayaOriginalText;
  ayaOriginalText = null;

  originals.forEach(({ el }) => {
    el.style.transition = 'opacity 0.6s ease';
    el.style.opacity = '0';
  });

  setTimeout(() => {
    originals.forEach(({ el, html }) => {
      el.innerHTML = html;
    });
    document.body.classList.remove('is-aya-message');
    requestAnimationFrame(() => {
      originals.forEach(({ el }) => {
        el.style.opacity = '1';
      });
    });
    setTimeout(() => {
      originals.forEach(({ el }) => {
        el.style.transition = '';
        el.style.opacity = '';
      });
    }, 650);
  }, 620);
}

export function startAyaDance(engine: CosmicCanvasEngine): void {
  if (engine.world.isAyaDanceActive || engine.world.isLogoBlackholeActive) {
    return;
  }
  if (engine.world.state === 'MOON_DANCE' || engine.world.state === 'SINGULARITY' || engine.world.state === 'AYA_FORMATION') {
    return;
  }

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now < engine.world.ayaEasterEggCooldownUntil) {
    return;
  }
  engine.world.ayaEasterEggCooldownUntil = now + AYA_DANCE_COOLDOWN_MS;

  // Cancel a pending revert from a previous run; originals stay captured.
  if (ayaRevertTimer) {
    clearTimeout(ayaRevertTimer);
    ayaRevertTimer = null;
  }

  const { x: logoX, y: logoY } = getLogoSingularityCoords(engine);
  const formation = getAyaFormationAnchor(engine, logoX, logoY);

  engine.world.isAyaDanceActive = true;
  engine.world.logoBlackholeTimer = 0;
  engine.world.ayaFormationCenterX = formation.x;
  engine.world.ayaFormationCenterY = formation.y;

  engine.world.singularity.x = logoX;
  engine.world.singularity.y = logoY;
  engine.world.singularity.active = true;
  engine.world.singularity.timer = 390;

  transitionTo(engine, 'MOON_DANCE');
  engine.world.stateTimer = 390;
  engine.world.shakeTimer = 0;

  if (typeof document === 'undefined') {
    return;
  }

  document.body.classList.add('is-aya-dance-active');

  try {
    const logoEl = document.querySelector('.logo') as HTMLElement;
    const logoImg = document.querySelector('.logoImg') as HTMLElement;
    if (logoEl) {
      logoEl.classList.remove('logo-aya-explode');
      logoEl.classList.add('logo-aya-transform');
    }
    if (logoImg) {
      logoImg.classList.remove('logo-aya-explode');
      logoImg.classList.add('logo-aya-transform-img');
    }
  } catch (e) {
    console.warn('[AyaDance] Failed initialization:', e);
  }
}

/**
 * Reassemble the page UI at the end of the formation: the logo bounces back like
 * the normal moon-dance and the text flies in already showing the love message.
 */
export function restoreAyaPageUI(engine: CosmicCanvasEngine): void {
  try {
    showAyaMessage();

    const logoEl = document.querySelector('.logo') as HTMLElement;
    const logoImg = document.querySelector('.logoImg') as HTMLElement;

    if (logoEl) {
      logoEl.classList.remove('logo-aya-transform');
      logoEl.classList.remove('logo-aya-explode');
      logoEl.style.transition = 'none';
      logoEl.style.transform = 'scale(0.1)';
      logoEl.style.opacity = '0';
      logoEl.style.boxShadow = '';
      logoEl.style.borderColor = '';
      logoEl.style.background = '';
      void logoEl.offsetHeight;
      logoEl.style.transition = 'transform 1.4s cubic-bezier(0.15, 0.85, 0.3, 1.25), opacity 1.4s ease-out';
      logoEl.style.transform = '';
      logoEl.style.opacity = '1';
    }

    if (logoImg) {
      logoImg.classList.remove('logo-aya-transform-img');
      logoImg.classList.remove('logo-aya-explode');
      logoImg.style.transition = 'none';
      logoImg.style.transform = '';
      logoImg.style.filter = '';
      logoImg.style.opacity = '1';
    }

    if (engine.world.logoElements.length > 0) {
      const elements = engine.world.logoElements;
      restorePageExplodeElements(elements, REASSEMBLE_MS);
      setTimeout(() => {
        clearPageExplodeInlineStyles(elements);
      }, REASSEMBLE_MS + STAGGER_MAX_MS + 200);
    }

    if (ayaRevertTimer) {
      clearTimeout(ayaRevertTimer);
    }
    ayaRevertTimer = setTimeout(() => {
      ayaRevertTimer = null;
      revertAyaMessage();
    }, REASSEMBLE_MS + STAGGER_MAX_MS + MESSAGE_HOLD_MS);
  } catch (e) {
    console.warn('[AyaDance] Failed page UI restore:', e);
  }
}

export function endAyaDance(engine: CosmicCanvasEngine): void {
  try {
    restoreAyaPageUI(engine);
  } catch (e) {
    console.warn('[AyaDance] Failed restore:', e);
  }

  setTimeout(() => {
    engine.world.isAyaDanceActive = false;
    engine.world.logoElements = [];
    engine.world.logoOrigPositions = [];
    if (typeof document !== 'undefined') {
      document.body.classList.remove('is-aya-dance-active');
    }
  }, 100);
}

export function onAyaKeyDown(engine: CosmicCanvasEngine, event: KeyboardEvent): void {
  if (isEditableTarget(event.target)) {
    return;
  }

  if (
    engine.world.state === 'SINGULARITY' ||
    engine.world.state === 'MOON_DANCE' ||
    engine.world.state === 'AYA_FORMATION' ||
    engine.world.isAyaDanceActive ||
    engine.world.isLogoBlackholeActive
  ) {
    return;
  }

  const key = event.key;
  if (key.length !== 1 || !/[a-zA-Z]/.test(key)) {
    keyBuffer = '';
    return;
  }

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastKeyTime > KEY_TIMEOUT_MS) {
    keyBuffer = '';
  }
  lastKeyTime = now;

  keyBuffer = (keyBuffer + key.toLowerCase()).slice(-AYA_SEQUENCE.length);
  if (keyBuffer === AYA_SEQUENCE) {
    keyBuffer = '';
    startAyaDance(engine);
  }
}
