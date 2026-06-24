import { COSMIC_CONSTANTS } from '../models/cosmic.constants';
import type { CosmicCanvasEngine } from './cosmic-canvas-engine';
import { blastParticlesAway, transitionTo } from './state-machine';
import { getLogoSingularityCoords } from './page-explode-targets';

const LOADING_COLORS = [
  'rgba(0, 240, 255,',
  'rgba(0, 240, 255,',
  'rgba(230, 100, 255,',
  'rgba(100, 180, 255,',
  'rgba(255, 255, 255,'
];

export function shouldSkipLoadingSequence(): boolean {
  return typeof window !== 'undefined' && !!(window as { __karma__?: unknown }).__karma__;
}

/** Anchor the spinner on the live logo / "Ameer Jamal" position, falling back to canvas center. */
export function updateLoadingCenter(engine: CosmicCanvasEngine): void {
  const world = engine.world;
  const width = world.canvasWidth || window.innerWidth;
  const height = world.canvasHeight || window.innerHeight;

  const { x, y } = getLogoSingularityCoords(engine);
  world.loadingSpinnerCenterX = Number.isFinite(x) && x > 0 ? x : width / 2;
  world.loadingSpinnerCenterY = Number.isFinite(y) && y > 0 ? y : height / 2;
  world.loadingSpinnerRadius = Math.min(width, height) * COSMIC_CONSTANTS.LOADING_RING_RADIUS_SCALE;
}

export function setupLoadingRing(engine: CosmicCanvasEngine): void {
  const world = engine.world;

  updateLoadingCenter(engine);

  const count = world.particles.length;
  for (let i = 0; i < count; i++) {
    const p = world.particles[i];
    const angle = (i / count) * Math.PI * 2;
    p.orbitAngle = angle;
    p.vx = 0;
    p.vy = 0;
    p.birthProgress = 1;
    p.isDying = false;
    p.deathProgress = 0;
    p.life = 1;
    p.colorBlend = 0.55 + (i % 4) * 0.1;
    p.colorPrefix = LOADING_COLORS[i % LOADING_COLORS.length];
    p.radius = Math.max(p.baseRadius, 2.2);
  }

  tickLoadingSpinner(engine);
}

export function beginLoadingSequence(engine: CosmicCanvasEngine): void {
  if (shouldSkipLoadingSequence()) {
    return;
  }

  const world = engine.world;
  world.loadingStartedAt = Date.now();
  world.pageAssetsReady = false;
  world.pageLoadCompleteTriggered = false;
  world.loadingSpinnerAngle = 0;

  if (typeof document !== 'undefined') {
    document.body.classList.add('is-cosmic-loading');
  }

  setupLoadingRing(engine);
  transitionTo(engine, 'LOADING');

  if (typeof window !== 'undefined') {
    window.addEventListener('portfolio-page-ready', () => markPageAssetsReady(engine), { once: true });
    window.setTimeout(() => {
      if (engine.world.state === 'LOADING' && !engine.world.pageLoadCompleteTriggered) {
        markPageAssetsReady(engine);
      }
    }, 8000);
  }
}

export function markPageAssetsReady(engine: CosmicCanvasEngine): void {
  if (engine.world.pageAssetsReady) {
    return;
  }
  engine.world.pageAssetsReady = true;
  engine.world.pageReadyAt = Date.now();
}

export function tickLoadingSpinner(engine: CosmicCanvasEngine): void {
  const world = engine.world;

  // Keep tracking the logo as the page settles (image load / layout shifts during boot).
  updateLoadingCenter(engine);

  world.loadingSpinnerAngle += COSMIC_CONSTANTS.LOADING_SPIN_SPEED;

  const cx = world.loadingSpinnerCenterX;
  const cy = world.loadingSpinnerCenterY;
  const radius = world.loadingSpinnerRadius;

  for (const p of world.particles) {
    if (p.orbitAngle === undefined) {
      continue;
    }

    const angle = p.orbitAngle + world.loadingSpinnerAngle;
    p.x = cx + Math.cos(angle) * radius;
    p.y = cy + Math.sin(angle) * radius;
    p.vx = -Math.sin(angle) * 2.4;
    p.vy = Math.cos(angle) * 2.4;
  }
}

export function tryCompleteLoading(engine: CosmicCanvasEngine): void {
  const world = engine.world;

  if (world.pageLoadCompleteTriggered || !world.pageAssetsReady) {
    return;
  }

  const now = Date.now();
  const totalElapsed = now - world.loadingStartedAt;
  const sinceReady = now - world.pageReadyAt;

  // Require an overall minimum, plus a guaranteed window of *smooth* spin once the
  // main thread is free (scripts can block rAF, so time-since-ready is what the user actually sees).
  if (totalElapsed < COSMIC_CONSTANTS.LOADING_MIN_SPIN_MS) {
    return;
  }
  if (sinceReady < COSMIC_CONSTANTS.LOADING_MIN_SPIN_AFTER_READY_MS) {
    return;
  }

  world.pageLoadCompleteTriggered = true;
  triggerLoadCompleteExplosion(engine);
}

export function triggerLoadCompleteExplosion(engine: CosmicCanvasEngine): void {
  const world = engine.world;
  const cx = world.loadingSpinnerCenterX || world.canvasWidth / 2;
  const cy = world.loadingSpinnerCenterY || world.canvasHeight / 2;

  for (const p of world.particles) {
    p.orbitAngle = undefined;
    p.formationActive = false;
    p.colorBlend = 1;
    p.birthProgress = 1;
  }

  if (typeof document !== 'undefined') {
    document.body.classList.remove('is-preload', 'is-cosmic-loading');
  }

  transitionTo(engine, 'EXPLODING');
  world.stateTimer = 55;
  world.screenFlash = 12;
  world.shakeTimer = 18;

  // The page reveal (header/footer fade-in, reflow) is janky for a moment. Reset the FPS
  // governor and give it a cooldown so it does NOT downgrade + reinit particles mid-explosion,
  // which would make stars abruptly disappear and respawn.
  world.fpsLowStreak = 0;
  world.fpsHighStreak = 0;
  world.fpsFrameDeltas = [];
  world.lastFrameTime = 0;
  world.fpsGovernorCooldown = 180;

  blastParticlesAway(engine, cx, cy, 20.0);

  world.shockwaves.push({
    x: cx,
    y: cy,
    radius: 0,
    maxRadius: COSMIC_CONSTANTS.EXPLOSION_RADIUS * 1.4,
    speed: 10.5,
    alpha: 1.0,
    color: '0, 240, 255'
  });
  world.shockwaves.push({
    x: cx,
    y: cy,
    radius: 0,
    maxRadius: COSMIC_CONSTANTS.EXPLOSION_RADIUS * 1.1,
    speed: 8.0,
    alpha: 0.9,
    color: '255, 100, 230'
  });

  const sparkCount = Math.floor(48 * world.performanceProfile.effectScale);
  for (let k = 0; k < sparkCount; k++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8.0 + 2.5;
    world.sparks.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: Math.random() * 2.2 + 1.0,
      alpha: 1.0,
      color: k % 2 === 0 ? 'rgba(0, 240, 255,' : 'rgba(255, 100, 230,'
    });
  }
}

export function drawLoadingRingLinks(engine: CosmicCanvasEngine): void {
  const ctx = engine.world.ctx;
  const particles = engine.world.particles.filter((p) => p.orbitAngle !== undefined);
  if (particles.length < 2) {
    return;
  }

  const cx = engine.world.loadingSpinnerCenterX;
  const cy = engine.world.loadingSpinnerCenterY;
  const pulse = 0.55 + Math.sin(Date.now() / 320) * 0.25;

  ctx.beginPath();
  ctx.arc(cx, cy, engine.world.loadingSpinnerRadius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(0, 240, 255, ${0.12 * pulse})`;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  for (let i = 0; i < particles.length; i++) {
    const p1 = particles[i];
    const p2 = particles[(i + 1) % particles.length];
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = `rgba(0, 240, 255, ${0.45 * pulse})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, engine.world.loadingSpinnerRadius * 0.85);
  innerGrad.addColorStop(0, `rgba(0, 240, 255, ${0.08 * pulse})`);
  innerGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, engine.world.loadingSpinnerRadius * 0.85, 0, Math.PI * 2);
  ctx.fill();
}
