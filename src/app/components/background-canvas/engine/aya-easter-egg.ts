import type { CosmicCanvasEngine } from './cosmic-canvas-engine';
import { transitionTo } from './state-machine';
import {
  clearPageExplodeInlineStyles,
  getAyaFormationAnchor,
  getLogoSingularityCoords,
  restorePageExplodeElements
} from './page-explode-targets';
import {
  playChimeSweep,
  startBlackholeHum,
  playSupernovaPop,
  playSpellSound,
  playHeartbeatSound,
  playTypewriterClick
} from './audio';


export const AYA_CONFIG = {
  trigger: {
    name: 'aya',
    email: 'ayaalmansour02@gmail.com',
    message: 'snowman'
  },
  triggerKeywords: ['snowman'],

  /** Hero/header copy swapped in while the easter egg is active. */
  copy: {
    name: 'Aya',
    midline: 'Najoomtee ⭐',
    tagline:
      'I love you to the moon and back. Thank you for always being by my side.\nI wish I could give you the universe, but all I can offer at this moment is a piece of the stars\nSo may every star in this sky guide us closer to each other’s hearts ❤️'
  },

  /** Nav link copy, keyed by anchor href, swapped during Aya's time. */
  navLabels: {
    '#CV': 'Habibti',
    '#work': 'Hayati',
    '#contact': 'Albi',
    '#omree': '3omree'
  } as Record<string, string>,

  /** Copy for the typewriter love-letter modal. */
  letter: {
    title: 'A Note among the stars ❤️',
    signature: 'Forever Yours,<br>Ameer',
    // The Arabic verse (Surah An-Nahl 16:16) is left inline at its usage site to
    // preserve its exact Unicode (diacritics + RTL marks) without risk of mangling.
    arabicVerseSource: 'Surah An-Nahl 16:16 · And by the stars they are guided',
    lines: [
      'Aya, Najoomtee 💫,',
      '',
      'I built this little piece of the sky for you because you have always been the brightest part of mine, no matter how cold it is in the depths of space I know you\'ll always be there to keep me warm. Thank you for standing beside me, for being my calm, my home, and the person who makes the world feel whole. You will always carry me like the stars carry the moon.',
      '',
      'I know it is hard for me to show you the world right now, but I hope this small corner of it that I built for you shows even a piece of what you mean to me.',
      '',
      'Through the late nights, the countless hours of debugging, the mistakes, and everything I have had to learn along the way, I always found comfort knowing that we still look up at the same sky at night. May these stars keep guiding us back to each other, no matter where life takes us.',
      '❤️'
    ]
  },

  /** Animation + lifecycle timing in milliseconds. */
  timing: {
    keyTimeoutMs: 2000,
    danceCooldownMs: 0,
    // Quick fly-in so the text materializes fast and the letter-morph plays out
    // visibly on screen (rather than finishing while still off-screen).
    reassembleMs: 1100,
    staggerMaxMs: 400,
    morphStaggerMs: 120,
    messageHoldMs: 1_800_000
  }
};

let keyBuffer = '';
let lastKeyTime = 0;

/** Original header/nav copy, captured once so re-triggers during the hold are safe. */
let ayaOriginalText: { el: HTMLElement; html: string; love: string }[] | null = null;
let ayaRevertTimer: ReturnType<typeof setTimeout> | null = null;

// Shared audio nodes are imported directly from './audio'

export function triggerHeartSwarm(engine: CosmicCanvasEngine, clickX: number, clickY: number): void {
  const world = engine.world;
  const particles = world.particles;
  const count = particles.length;
  
  const width = world.canvasWidth || window.innerWidth;
  const height = world.canvasHeight || window.innerHeight;
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Calculate a scale that frames the page content.
  // hx goes from -16 to 16, so the width is 32 * scale.
  // We want the heart's width to be about 65% of the viewport dimension.
  const scale = (Math.min(width, height) * 0.65) / 32;
  
  const targets: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
    
    targets.push({
      x: centerX + hx * scale,
      y: centerY + hy * scale
    });
  }
  
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.formationActive = true;
    p.formationTx = targets[i].x + (Math.random() - 0.5) * 12;
    p.formationTy = targets[i].y + (Math.random() - 0.5) * 12;
    p.colorPrefix = 'rgba(255, 100, 180,';
    p.colorBlend = 1.0;
  }
  
  (world as any).isHeartSwarmActive = true;
  transitionTo(engine, 'AYA_FORMATION');
  world.stateTimer = 150; // 2.5 seconds hold
  world.screenFlash = 10;
}

export function spawnAyaShootingStar(engine: CosmicCanvasEngine): void {
  const width = engine.world.canvasWidth || window.innerWidth;
  const height = engine.world.canvasHeight || window.innerHeight;
  
  engine.world.shootingStars.push({
    x: width * 0.9,
    y: height * 0.1,
    vx: -18,
    vy: 9,
    length: 180,
    alpha: 1.0,
    colorPrefix: '255, 100, 180,'
  });
  
  setTimeout(() => {
    engine.world.shootingStars.push({
      x: width * 0.8,
      y: height * 0.05,
      vx: -16,
      vy: 8,
      length: 140,
      alpha: 1.0,
      colorPrefix: '255, 180, 220,'
    });
  }, 180);
  
  setTimeout(() => {
    engine.world.shootingStars.push({
      x: width * 0.95,
      y: height * 0.2,
      vx: -20,
      vy: 10,
      length: 160,
      alpha: 1.0,
      colorPrefix: '200, 100, 255,'
    });
  }, 350);
}

export function showLoveLetterModal(engine: CosmicCanvasEngine): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('aya-love-letter')) return;

  if (!document.getElementById('special-elite-font')) {
    const link = document.createElement('link');
    link.id = 'special-elite-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Special+Elite&display=swap';
    document.head.appendChild(link);
  }

  if (!document.getElementById('amiri-font')) {
    const link = document.createElement('link');
    link.id = 'amiri-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&display=swap';
    document.head.appendChild(link);
  }

  const modal = document.createElement('div');
  modal.id = 'aya-love-letter';
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%) scale(0.9)';
  modal.style.width = '90%';
  modal.style.maxWidth = '580px';
  modal.style.maxHeight = '85vh';
  modal.style.background = 'rgba(15, 10, 25, 0.76)';
  modal.style.backdropFilter = 'blur(20px)';
  (modal.style as any).webkitBackdropFilter = 'blur(20px)';
  modal.style.border = '1px solid rgba(255, 120, 180, 0.35)';
  modal.style.borderRadius = '16px';
  modal.style.boxShadow = '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 35px rgba(255, 100, 180, 0.2)';
  modal.style.color = '#ffffff';
  modal.style.zIndex = '20000';
  modal.style.opacity = '0';
  modal.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
  modal.style.fontFamily = "'Special Elite', 'Courier New', Courier, monospace";
  modal.style.overflow = 'hidden';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';

  const overlay = document.createElement('div');
  overlay.id = 'aya-love-letter-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(5, 3, 10, 0.65)';
  overlay.style.zIndex = '19999';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.5s ease';

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '✕';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '12px';
  closeBtn.style.right = '14px';
  closeBtn.style.background = 'none';
  closeBtn.style.setProperty('border', 'none', 'important');
  closeBtn.style.setProperty('outline', 'none', 'important');
  closeBtn.style.setProperty('box-shadow', 'none', 'important');
  closeBtn.style.color = 'rgba(255, 255, 255, 0.6)';
  closeBtn.style.fontSize = '1.4rem';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.zIndex = '20001';
  closeBtn.style.transition = 'color 0.3s ease, transform 0.3s ease';
  closeBtn.onfocus = () => {
    closeBtn.style.setProperty('outline', 'none', 'important');
    closeBtn.style.setProperty('border', 'none', 'important');
  };
  closeBtn.onmouseenter = () => {
    closeBtn.style.color = '#ff64b4';
    closeBtn.style.transform = 'rotate(90deg)';
  };
  closeBtn.onmouseleave = () => {
    closeBtn.style.color = 'rgba(255, 255, 255, 0.6)';
    closeBtn.style.transform = 'rotate(0deg)';
  };

  const scrollContainer = document.createElement('div');
  scrollContainer.style.overflowY = 'auto';
  scrollContainer.style.padding = '32px';
  scrollContainer.style.paddingTop = '40px';
  scrollContainer.style.width = '100%';
  scrollContainer.style.boxSizing = 'border-box';
  scrollContainer.style.scrollbarWidth = 'thin';
  scrollContainer.style.scrollbarColor = 'rgba(255, 120, 180, 0.3) transparent';
  
  const header = document.createElement('h3');
  header.textContent = AYA_CONFIG.letter.title;
  header.style.fontSize = '1.5rem';
  header.style.fontWeight = '700';
  header.style.margin = '0 0 18px 0';
  header.style.color = '#ff8cc8';
  header.style.textShadow = '0 0 10px rgba(255, 100, 180, 0.5)';
  header.style.letterSpacing = '0.05rem';
  header.style.fontFamily = "'Special Elite', 'Courier New', Courier, monospace";

  const bodyText = document.createElement('p');
  bodyText.style.fontSize = '1.05rem';
  bodyText.style.lineHeight = '1.6';
  bodyText.style.color = 'rgba(255, 255, 255, 0.95)';
  bodyText.style.margin = '0 0 24px 0';
  bodyText.style.minHeight = '140px';
  bodyText.style.fontWeight = '400';
  bodyText.style.fontFamily = "'Special Elite', 'Courier New', Courier, monospace";

  const signature = document.createElement('div');
  signature.style.textAlign = 'right';
  signature.style.fontSize = '1.2rem';
  signature.style.fontWeight = '600';
  signature.style.color = '#ff8cc8';
  signature.style.fontFamily = "'Special Elite', 'Courier New', Courier, monospace";
  signature.style.opacity = '0';
  signature.style.transition = 'opacity 1.0s ease 0.5s';

  const arabicQuote = document.createElement('div');
  arabicQuote.style.textAlign = 'center';
  arabicQuote.style.marginTop = '0.85rem';
  arabicQuote.style.padding = '0.65rem 0.9rem';
  arabicQuote.style.borderRadius = '14px';
  arabicQuote.style.background = 'rgba(255, 140, 200, 0.08)';
  arabicQuote.style.border = '1px solid rgba(255, 140, 200, 0.22)';
  arabicQuote.style.color = '#ffd6ea';
  arabicQuote.style.fontFamily = "'Amiri', 'Scheherazade New', serif";
  arabicQuote.style.opacity = '0';
  arabicQuote.style.transition = 'opacity 1s ease 0.35s';

  const arabicQuoteMain = document.createElement('div');
  arabicQuoteMain.textContent = '﴿وَبِالنَّجْمِ هُمْ يَهْتَدُونَ﴾';
  arabicQuoteMain.lang = 'ar';
  arabicQuoteMain.dir = 'rtl';
  arabicQuoteMain.style.fontSize = '1.35rem';
  arabicQuoteMain.style.fontWeight = '600';
  arabicQuoteMain.style.letterSpacing = '0.02em';

  const arabicQuoteSub = document.createElement('div');
  arabicQuoteSub.textContent = AYA_CONFIG.letter.arabicVerseSource;
  arabicQuoteSub.style.marginTop = '0.25rem';
  arabicQuoteSub.style.fontSize = '0.75rem';
  arabicQuoteSub.style.fontFamily = "'Inter', system-ui, sans-serif";
  arabicQuoteSub.style.color = 'rgba(255, 214, 234, 0.72)';

  arabicQuote.appendChild(arabicQuoteMain);
  arabicQuote.appendChild(arabicQuoteSub);

  scrollContainer.appendChild(header);
  scrollContainer.appendChild(bodyText);
  scrollContainer.appendChild(arabicQuote);
  scrollContainer.appendChild(signature);

  modal.appendChild(closeBtn);
  modal.appendChild(scrollContainer);

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  void modal.offsetHeight;
  modal.style.opacity = '1';
  modal.style.transform = 'translate(-50%, -50%) scale(1)';
  overlay.style.opacity = '1';

  const fullText = AYA_CONFIG.letter.lines.join('\n');
  let charIdx = 0;

  const type = () => {
    if (!document.getElementById('aya-love-letter')) return;
    if (charIdx < fullText.length) {
      const ch = fullText.charAt(charIdx);
      if (ch === '\n') {
        bodyText.innerHTML += '<br>';
      } else {
        bodyText.innerHTML += ch;
      }
      charIdx++;
      
      let delay = 25 + Math.random() * 25;
      if (ch === '.' || ch === '!') delay = 400;
      else if (ch === ',') delay = 200;
      
      if (Math.random() < 0.3) {
        playTypewriterClick();
      }

      setTimeout(type, delay);
    } else {
      arabicQuote.style.opacity = '1';
      signature.innerHTML = AYA_CONFIG.letter.signature;
      signature.style.opacity = '1';
    }
  };

  setTimeout(type, 500);

  const closeModal = () => {
    modal.style.opacity = '0';
    modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
    overlay.style.opacity = '0';
    setTimeout(() => {
      modal.remove();
      overlay.remove();
    }, 500);
  };

  closeBtn.onclick = closeModal;
  overlay.onclick = closeModal;
}

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
  if (h1) targets.push({ el: h1, love: AYA_CONFIG.copy.name });
  if (mid) targets.push({ el: mid, love: AYA_CONFIG.copy.midline });
  if (sub) targets.push({ el: sub, love: AYA_CONFIG.copy.tagline });

  document.querySelectorAll('#header nav ul li a').forEach((node) => {
    const link = node as HTMLElement;
    const love = AYA_CONFIG.navLabels[link.getAttribute('href') ?? ''];
    if (love) {
      targets.push({ el: link, love });
    }
  });

  return targets;
}

const SCRAMBLE_GLYPHS = Array.from('★☆✦✧✪✫✬✭✮✯✰⭐✨✶✷✸✹✺⊹·°');
const SCRAMBLE_REROLL_MS = 45;

interface MorphHandle {
  cancel: () => void;
}

let activeMorphs: MorphHandle[] = [];

function cancelActiveMorphs(): void {
  activeMorphs.forEach((m) => m.cancel());
  activeMorphs = [];
}

function charToHtml(ch: string): string {
  switch (ch) {
    case '\n':
      return '<br>';
    case '&':
      return '&amp;';
    case '<':
      return '&lt;';
    case '>':
      return '&gt;';
    default:
      return ch;
  }
}

function textToHtml(text: string): string {
  let out = '';
  for (const ch of text) {
    out += charToHtml(ch);
  }
  return out;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function morphDurationFor(text: string): number {
  const len = Array.from(text).length;
  return Math.min(4000, Math.max(1700, 1500 + len * 14));
}

interface MorphSlot {
  to: string;
  from: string;
  start: number;
  end: number;
  glyph: string;
}

function morphElementText(
  el: HTMLElement,
  targetText: string,
  options?: { durationMs?: number; delayMs?: number }
): MorphHandle {
  const handle: MorphHandle = { cancel: () => undefined };
  if (typeof document === 'undefined') {
    return handle;
  }

  const duration = options?.durationMs ?? 2400;
  const delay = options?.delayMs ?? 0;
  const fromChars = Array.from(el.textContent ?? '');
  const toChars = Array.from(targetText);
  const length = Math.max(fromChars.length, toChars.length);

  const slots: MorphSlot[] = [];
  for (let i = 0; i < length; i++) {
    const wave = easeInOutCubic(length <= 1 ? 0 : i / (length - 1));
    const start = wave * duration * 0.55;
    const span = duration * 0.3 + Math.random() * duration * 0.14;
    slots.push({ to: toChars[i] ?? '', from: fromChars[i] ?? '', start, end: start + span, glyph: '' });
  }

  let rafId = 0;
  let cancelled = false;
  let lastRoll = Number.NEGATIVE_INFINITY;
  const startTime = performance.now() + delay;

  function render(now: number): void {
    if (cancelled) {
      return;
    }
    const t = now - startTime;
    if (t < 0) {
      rafId = requestAnimationFrame(render);
      return;
    }

    const reroll = now - lastRoll >= SCRAMBLE_REROLL_MS;
    if (reroll) {
      lastRoll = now;
    }

    let html = '';
    let settled = 0;
    for (const slot of slots) {
      if (t >= slot.end) {
        html += charToHtml(slot.to);
        settled++;
      } else if (t >= slot.start) {
        if (reroll || !slot.glyph) {
          slot.glyph = SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)];
        }
        html += `<span class="aya-scramble">${slot.glyph}</span>`;
      } else if (slot.from) {
        html += charToHtml(slot.from);
      }
    }

    el.innerHTML = html;

    if (settled >= length) {
      el.innerHTML = textToHtml(targetText);
      return;
    }
    rafId = requestAnimationFrame(render);
  }

  rafId = requestAnimationFrame(render);
  handle.cancel = () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
  return handle;
}

export function showAyaMessage(engine: CosmicCanvasEngine): number {
  if (typeof document === 'undefined') {
    return 0;
  }

  if (!ayaOriginalText) {
    ayaOriginalText = getAyaSwapTargets().map((t) => ({
      el: t.el,
      html: t.el.innerHTML,
      love: t.love
    }));
  }

  cancelActiveMorphs();
  let totalMs = 0;
  ayaOriginalText.forEach((t, i) => {
    const durationMs = morphDurationFor(t.love);
    const delayMs = i * AYA_CONFIG.timing.morphStaggerMs;
    totalMs = Math.max(totalMs, durationMs + delayMs);
    activeMorphs.push(morphElementText(t.el, t.love, { durationMs, delayMs }));
  });

  document.body.classList.add('is-aya-message');

  let omreeLi = document.getElementById('omree-nav-item');
  if (omreeLi) {
    const omreeAnchor = omreeLi.querySelector('a');
    if (omreeAnchor) {
      const durationMs = morphDurationFor('3omree');
      activeMorphs.push(morphElementText(omreeAnchor, '3omree', { durationMs, delayMs: 0 }));
    }
  } else {
    const ul = document.querySelector('#header nav ul');
    if (ul) {
      omreeLi = document.createElement('li');
      omreeLi.id = 'omree-nav-item';

      const omreeAnchor = document.createElement('a');
      omreeAnchor.setAttribute('href', '#omree');
      omreeAnchor.textContent = '★';
      omreeAnchor.style.whiteSpace = 'nowrap';
      omreeLi.appendChild(omreeAnchor);

      const listItems = ul.querySelectorAll('li');
      if (listItems.length >= 3) {
        ul.insertBefore(omreeLi, listItems[2]);
      } else {
        ul.appendChild(omreeLi);
      }

      omreeLi.style.width = '0px';
      omreeLi.style.height = '0px';
      omreeLi.style.overflow = 'hidden';
      omreeLi.style.opacity = '0';
      omreeLi.style.transform = 'scale(0.8)';
      omreeLi.style.transition = 'none';

      void omreeLi.offsetHeight;

      setTimeout(() => {
        if (!document.body.classList.contains('is-aya-message')) {
          omreeLi?.remove();
          return;
        }
        if (omreeLi) {
          omreeLi.style.width = '';
          omreeLi.style.height = '';
          omreeLi.style.overflow = '';
          const targetWidth = omreeLi.getBoundingClientRect().width;
          const targetHeight = omreeLi.getBoundingClientRect().height;

          omreeLi.style.width = '0px';
          omreeLi.style.height = '0px';
          omreeLi.style.overflow = 'hidden';

          void omreeLi.offsetHeight;

          omreeLi.style.transition = 'transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.8s ease-out, width 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
          omreeLi.style.opacity = '1';
          omreeLi.style.transform = 'scale(1)';
          omreeLi.style.width = targetWidth + 'px';
          omreeLi.style.height = targetHeight + 'px';

          setTimeout(() => {
            if (omreeLi && document.body.classList.contains('is-aya-message')) {
              omreeLi.style.width = '';
              omreeLi.style.height = '';
              omreeLi.style.overflow = '';
            }
          }, 850);
        }

        const durationMs = morphDurationFor('3omree');
        activeMorphs.push(morphElementText(omreeAnchor, '3omree', { durationMs, delayMs: 0 }));
      }, AYA_CONFIG.timing.reassembleMs);
    }
  }

  const omreeDuration = AYA_CONFIG.timing.reassembleMs + morphDurationFor('3omree');
  totalMs = Math.max(totalMs, omreeDuration);

  (window as any).__ayaSpawnHearts = (clickX: number, clickY: number) => {
    const heartCount = 45;
    const pinkColors = [
      'rgba(255, 100, 180, ', 
      'rgba(255, 140, 200, ', 
      'rgba(255, 180, 220, ', 
      'rgba(255, 60, 140, ',  
      'rgba(255, 192, 203, '  
    ];

    for (let i = 0; i < heartCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8.0 + 3.0;
      const radius = Math.random() * 7 + 4;
      const rotation = Math.random() * Math.PI * 2;
      const rotSpeed = (Math.random() - 0.5) * 0.15;
      const color = pinkColors[Math.floor(Math.random() * pinkColors.length)];

      engine.world.sparks.push({
        x: clickX,
        y: clickY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius,
        alpha: 1.0,
        color,
        isHeart: true,
        rotation,
        rotSpeed
      } as any);
    }

    engine.world.shockwaves.push({
      x: clickX,
      y: clickY,
      radius: 0,
      maxRadius: 160,
      speed: 4.5,
      alpha: 1.0,
      color: '255, 100, 180'
    });
  };

  (window as any).__ayaSpawnTrailHearts = (clickX: number, clickY: number) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 1.2 + 0.4;
    const radius = Math.random() * 2.8 + 2.0;
    const rotation = Math.random() * Math.PI * 2;
    const rotSpeed = (Math.random() - 0.5) * 0.06;

    engine.world.sparks.push({
      x: clickX,
      y: clickY,
      vx: Math.cos(angle) * speed - 0.2,
      vy: Math.sin(angle) * speed - 0.6,
      radius,
      alpha: 0.8,
      color: 'rgba(255, 140, 200,',
      isHeart: true,
      rotation,
      rotSpeed
    } as any);
  };

  const handleCaptureClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const link = target.closest('#header nav ul li a, .icons a') as HTMLElement | null;

    if (link && document.body.classList.contains('is-aya-message')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();

      const canvas = engine.world.canvas;
      const rect = canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;

      const href = link.getAttribute('href');

      if (href === '#CV') {
        playSpellSound('swarm');
        triggerHeartSwarm(engine, clickX, clickY);
      } else if (href === '#work') {
        playSpellSound('shooting-star');
        spawnAyaShootingStar(engine);
        spawnHayatiLife(engine, clickX, clickY);
      } else if (href === '#contact') {
        // Pulse 1
        playHeartbeatSound();
        (engine.world as any).ayaHeartbeatTimer = 50;
        (window as any).__ayaSpawnHearts?.(clickX, clickY);

        // Pulse 2
        setTimeout(() => {
          if (typeof document !== 'undefined' && document.body.classList.contains('is-aya-message')) {
            playHeartbeatSound();
            (engine.world as any).ayaHeartbeatTimer = 50;
            (window as any).__ayaSpawnHearts?.(clickX, clickY);
          }
        }, 800);

        // Pulse 3
        setTimeout(() => {
          if (typeof document !== 'undefined' && document.body.classList.contains('is-aya-message')) {
            playHeartbeatSound();
            (engine.world as any).ayaHeartbeatTimer = 50;
            (window as any).__ayaSpawnHearts?.(clickX, clickY);
          }
        }, 1600);
      } else if (href === '#omree') {
        playSpellSound('letter');
        showLoveLetterModal(engine);
      } else {
        (window as any).__ayaSpawnHearts?.(clickX, clickY);
      }
    }
  };

  if ((window as any).__ayaCaptureClick) {
    document.removeEventListener('click', (window as any).__ayaCaptureClick, true);
  }
  (window as any).__ayaCaptureClick = handleCaptureClick;
  document.addEventListener('click', handleCaptureClick, true);

  return totalMs;
}

export function revertAyaMessage(engine: CosmicCanvasEngine): void {
  if (typeof document === 'undefined') {
    return;
  }

  // Clear any persistent formation targets and return particles back to DRIFT state
  for (const p of engine.world.particles) {
    p.formationActive = false;
    p.formationTx = undefined;
    p.formationTy = undefined;
    p.colorBlend = 0.4;
    p.colorPrefix = 'rgba(255, 255, 255,';
    p.vx *= 0.4;
    p.vy *= 0.4;
    p.radius = p.baseRadius;
  }
  engine.world.blackoutAlpha = 0;
  transitionTo(engine, 'DRIFT');

  if (!ayaOriginalText) {
    document.body.classList.remove('is-aya-message');
    return;
  }

  if ((window as any).__ayaCaptureClick) {
    document.removeEventListener('click', (window as any).__ayaCaptureClick, true);
    delete (window as any).__ayaCaptureClick;
  }

  delete (window as any).__ayaSpawnHearts;
  delete (window as any).__ayaSpawnTrailHearts;

  const originals = ayaOriginalText;
  ayaOriginalText = null;

  cancelActiveMorphs();

  const omreeLi = document.getElementById('omree-nav-item');
  if (omreeLi) {
    const rect = omreeLi.getBoundingClientRect();
    omreeLi.style.width = rect.width + 'px';
    omreeLi.style.height = rect.height + 'px';
    omreeLi.style.overflow = 'hidden';

    const parent = omreeLi.parentElement;
    let isColumn = false;
    let gap = '0.35rem';
    if (parent) {
      const computed = window.getComputedStyle(parent);
      isColumn = computed.flexDirection === 'column';
      gap = isColumn ? (computed.rowGap || '1.5rem') : (computed.columnGap || '0.35rem');
    }

    void omreeLi.offsetHeight;

    omreeLi.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.6s cubic-bezier(0.25, 1, 0.5, 1), width 0.6s cubic-bezier(0.25, 1, 0.5, 1), height 0.6s cubic-bezier(0.25, 1, 0.5, 1), margin 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    omreeLi.style.opacity = '0';
    omreeLi.style.transform = 'scale(0.8)';
    omreeLi.style.width = '0px';
    omreeLi.style.height = '0px';
    
    if (isColumn) {
      omreeLi.style.marginBottom = `-${gap}`;
    } else {
      omreeLi.style.marginRight = `-${gap}`;
    }

    const omreeAnchor = omreeLi.querySelector('a');
    if (omreeAnchor) {
      omreeAnchor.style.whiteSpace = 'nowrap';
      activeMorphs.push(morphElementText(omreeAnchor, '★', { durationMs: 500, delayMs: 0 }));
    }
  }

  let maxTime = 0;
  originals.forEach(({ el, html }, i) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const originalText = tempDiv.textContent ?? '';
    const duration = morphDurationFor(originalText);
    const delay = i * AYA_CONFIG.timing.morphStaggerMs;
    maxTime = Math.max(maxTime, duration + delay);
    activeMorphs.push(morphElementText(el, originalText, { durationMs: duration, delayMs: delay }));
  });

  setTimeout(() => {
    cancelActiveMorphs();
    originals.forEach(({ el, html }) => {
      el.innerHTML = html;
    });
    
    const omreeLiToDelete = document.getElementById('omree-nav-item');
    if (omreeLiToDelete) {
      omreeLiToDelete.remove();
    }
    
    document.body.classList.remove('is-aya-message');
  }, maxTime + 300);
}

export function startAyaDance(engine: CosmicCanvasEngine): void {
  if (engine.world.isAyaDanceActive || engine.world.isLogoBlackholeActive) {
    return;
  }
  if (engine.world.state === 'MOON_DANCE' || engine.world.state === 'SINGULARITY' || engine.world.state === 'AYA_FORMATION') {
    return;
  }

  playChimeSweep();
  startBlackholeHum();

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now < engine.world.ayaEasterEggCooldownUntil) {
    return;
  }
  engine.world.ayaEasterEggCooldownUntil = now + AYA_CONFIG.timing.danceCooldownMs;

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
  engine.world.singularity.timer = 360;

  transitionTo(engine, 'MOON_DANCE');
  engine.world.stateTimer = 360;
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

export function restoreAyaPageUI(engine: CosmicCanvasEngine): void {
  try {
    if (typeof document !== 'undefined') {
      document.body.classList.add('is-aya-message');
    }

    const logoEl = document.querySelector('.logo') as HTMLElement;
    const logoImg = document.querySelector('.logoImg') as HTMLElement;

    if (logoEl) {
      logoEl.classList.remove('logo-aya-transform');
      logoEl.classList.remove('logo-aya-explode');
      logoEl.style.setProperty('transition', 'none', 'important');
      logoEl.style.setProperty('transform', 'scale(0.1)', 'important');
      logoEl.style.setProperty('opacity', '0', 'important');
      logoEl.style.boxShadow = '';
      logoEl.style.borderColor = '';
      logoEl.style.background = '';
      void logoEl.offsetHeight;
      logoEl.style.setProperty('transition', 'transform 1.4s cubic-bezier(0.15, 0.85, 0.3, 1.25), opacity 1.4s ease-out', 'important');
      logoEl.style.setProperty('transform', 'scale(1) translate3d(0, 0, 0)', 'important');
      logoEl.style.setProperty('opacity', '1', 'important');
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
      restorePageExplodeElements(elements, AYA_CONFIG.timing.reassembleMs);
      setTimeout(() => {
        clearPageExplodeInlineStyles(elements);
      }, AYA_CONFIG.timing.reassembleMs + AYA_CONFIG.timing.staggerMaxMs + 200);
    }

    const morphTotalMs = showAyaMessage(engine);

    if (ayaRevertTimer) {
      clearTimeout(ayaRevertTimer);
    }
    ayaRevertTimer = setTimeout(() => {
      ayaRevertTimer = null;
      revertAyaMessage(engine);
    }, morphTotalMs + AYA_CONFIG.timing.messageHoldMs);
  } catch (e) {
    console.warn('[AyaDance] Failed page UI restore:', e);
  }
}

export function endAyaDance(engine: CosmicCanvasEngine): void {
  engine.world.isAyaDanceActive = false;
  if (typeof document !== 'undefined') {
    document.body.classList.remove('is-aya-dance-active');
  }

  try {
    restoreAyaPageUI(engine);
  } catch (e) {
    console.warn('[AyaDance] Failed restore:', e);
  }

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
    } catch (err) {
      console.warn('[AyaDance] Logo cleanup error:', err);
    }

    engine.world.logoElements = [];
    engine.world.logoOrigPositions = [];
  }, AYA_CONFIG.timing.reassembleMs + AYA_CONFIG.timing.staggerMaxMs + 400);
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
  if (now - lastKeyTime > AYA_CONFIG.timing.keyTimeoutMs) {
    keyBuffer = '';
  }
  lastKeyTime = now;

  const keywords = AYA_CONFIG.triggerKeywords;
  const maxLen = Math.max(...keywords.map((keyword) => keyword.length));
  keyBuffer = (keyBuffer + key.toLowerCase()).slice(-maxLen);
  
  const matched = keywords.find(keyword => keyBuffer.endsWith(keyword));
  if (matched) {
    keyBuffer = '';
    startAyaDance(engine);
  }
}

export function spawnHayatiLife(engine: CosmicCanvasEngine, clickX: number, clickY: number): void {
  // Throttle to at most one spawn every 500ms so spam-clicking "Hayati" doesn't
  // flood the particle ecosystem beyond what the FPS governor can compensate for.
  const now = Date.now();
  const lastSpawn = (engine.world as any).lastHayatiSpawn as number | undefined;
  if (lastSpawn !== undefined && now - lastSpawn < 500) {
    return;
  }
  (engine.world as any).lastHayatiSpawn = now;

  const maxParticles = engine.world.performanceProfile?.maxParticles ?? 145;
  const spawnTotal = 24; // 12 hearts + 12 stars per click
  const heartBudget = 100;

  // Count current hearts and do a single-scan budget + cull pass so we never
  // iterate the array more than once.
  let heartCount = 0;
  let culledHearts = 0;
  const heartCullTarget = 8;
  for (const element of engine.world.particles) {
    const p = element;
    if (p.isHeart) {
      heartCount++;
      if (heartCount > heartBudget && culledHearts < heartCullTarget && !p.isDying) {
        p.isDying = true;
        culledHearts++;
      }
    }
  }

  // If we're still over the budget despite culling, mark more hearts as dying.
  if (heartCount - culledHearts > heartBudget) {
    const stillExcess = heartCount - culledHearts - heartBudget;
    let dying = 0;
    for (let i = 0; i < engine.world.particles.length && dying < stillExcess; i++) {
      const p = engine.world.particles[i];
      if (p.isHeart && !p.isDying) {
        p.isDying = true;
        dying++;
      }
    }
    culledHearts += dying;
  }

  // Kill oldest non-heart, non-dying stars to make room for the new batch so
  // the user always sees a visible burst when clicking Hayati.
  const roomNeeded = Math.max(0, (engine.world.particles.length + spawnTotal) - maxParticles);
  if (roomNeeded > 0) {
    let culled = 0;
    for (let i = 0; i < engine.world.particles.length && culled < roomNeeded; i++) {
      const p = engine.world.particles[i];
      if (!p.isHeart && !p.isDying && !p.formationActive && p.orbitAngle === undefined) {
        p.isDying = true;
        culled++;
      }
    }
  }

  const pinkColors = [
    'rgba(255, 100, 180, ',
    'rgba(255, 140, 200, ',
    'rgba(255, 120, 160, '
  ];

  for (let i = 0; i < spawnTotal; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5.0 + 2.5;
    const baseRadius = Math.random() * 2.2 + 1.8;
    const colorPrefix = pinkColors[Math.floor(Math.random() * pinkColors.length)];
    const isHeart = i % 2 === 0;

    engine.world.particles.push({
      x: clickX,
      y: clickY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      baseVx: Math.cos(angle) * 0.45,
      baseVy: Math.sin(angle) * 0.45,
      radius: baseRadius,
      baseRadius,
      colorBlend: 1.0,
      wobbleTimer: 0,
      colorPrefix,
      flockable: true,
      life: 1.0,
      birthProgress: 1.0,
      deathProgress: 0.0,
      isDying: false,
      behaviorState: 'CRUISE',
      behaviorTimer: Math.floor(Math.random() * 120) + 120,
      speedFactor: 1.0,
      isHeart: isHeart
    });
  }
}
