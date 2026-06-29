import { MousePower, SandboxChargeTier } from '../models/cosmic.types';

/**
 * Shared Web Audio helpers for the cosmic canvas easter eggs (Aya dance and the
 * normal logo moon-dance) and sandbox powers. Procedurally synthesized.
 */

let audioCtx: AudioContext | null = null;
let hasUserGesture = false;
let gestureListenersAttached = false;

/**
 * Browsers refuse to start an AudioContext until the user interacts with the page.
 * We listen once for the first real gesture, resume the context then, and avoid
 * calling resume() before that point (which otherwise spams a console warning).
 */
function attachGestureListeners(): void {
  if (gestureListenersAttached || typeof window === 'undefined') return;
  gestureListenersAttached = true;

  const onFirstGesture = (): void => {
    hasUserGesture = true;
    if (audioCtx?.state === 'suspended') {
      void audioCtx.resume();
    }
    window.removeEventListener('pointerdown', onFirstGesture);
    window.removeEventListener('keydown', onFirstGesture);
    window.removeEventListener('touchstart', onFirstGesture);
  };

  window.addEventListener('pointerdown', onFirstGesture);
  window.addEventListener('keydown', onFirstGesture);
  window.addEventListener('touchstart', onFirstGesture);
}

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  attachGestureListeners();
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      (window as any).__ayaAudioCtx = audioCtx;
    }
  }
  // Only resume after a user gesture; resuming earlier triggers a browser warning.
  if (hasUserGesture && audioCtx?.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

/** Builds a short white-noise buffer used to give explosions a gritty rumble. */
function createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function playChimeSweep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00]; // C5, E5, G5, C6, E6, G6, C7
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.06);

    gain.gain.setValueAtTime(0, now + idx * 0.06);
    gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.06 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.06);
    osc.stop(now + idx * 0.06 + 0.5);
  });
}

let buildupActive = false;
let buildupNodes: (OscillatorNode | AudioBufferSourceNode)[] = [];

/**
 * Loud collapse build-up: a swelling tension riser that climbs in pitch and
 * volume across the whole moon-dance, peaking right as the explosion hits.
 * Pass the dance duration (seconds) so the crescendo lands on the big bang.
 */
export function startBlackholeHum(durationSec = 6.0): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (buildupActive) return;
  buildupActive = true;

  const now = ctx.currentTime;
  const end = now + durationSec;

  // Master swell: starts silent, ramps up the entire time, crescendos at the end.
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.linearRampToValueAtTime(0.18, now + durationSec * 0.55);
  master.gain.linearRampToValueAtTime(0.55, end - 0.15);
  master.connect(ctx.destination);

  // Deep sub rumble climbing slowly — the "gravity well" growing.
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = 'triangle';
  sub.frequency.setValueAtTime(38, now);
  sub.frequency.exponentialRampToValueAtTime(95, end);
  subGain.gain.setValueAtTime(0.9, now);
  sub.connect(subGain);
  subGain.connect(master);
  sub.start(now);
  sub.stop(end + 0.1);

  // Mid tension riser sweeping upward — the classic rising whoosh.
  const riser = ctx.createOscillator();
  const riserGain = ctx.createGain();
  riser.type = 'sawtooth';
  riser.frequency.setValueAtTime(140, now);
  riser.frequency.exponentialRampToValueAtTime(1400, end);
  riserGain.gain.setValueAtTime(0.12, now);
  riserGain.gain.linearRampToValueAtTime(0.35, end - 0.1);
  riser.connect(riserGain);
  riserGain.connect(master);
  riser.start(now);
  riser.stop(end + 0.1);

  // Filtered noise riser with an opening filter for "air" tension.
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, durationSec + 0.3);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(220, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(2600, end);
  noiseFilter.Q.value = 0.8;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.05, now);
  noiseGain.gain.linearRampToValueAtTime(0.4, end - 0.1);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(now);
  noise.stop(end + 0.1);

  buildupNodes = [sub, riser, noise];

  setTimeout(() => {
    buildupActive = false;
    buildupNodes = [];
  }, (durationSec + 0.3) * 1000);
}

export function stopBlackholeHum(): void {
  if (!buildupActive) return;
  buildupActive = false;
  buildupNodes.forEach((node) => {
    try {
      node.stop();
    } catch (e) {}
  });
  buildupNodes = [];
}

/**
 * Loud, deep rumble explosion for the big bang. Layered sub-bass boom, low body,
 * a gritty filtered-noise rumble, and a sharp transient crack for impact.
 */
export function playSupernovaPop(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Limiter keeps the layered blast loud and punchy without harsh digital clipping.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-8, now);
  limiter.knee.setValueAtTime(2, now);
  limiter.ratio.setValueAtTime(20, now);
  limiter.attack.setValueAtTime(0.002, now);
  limiter.release.setValueAtTime(0.25, now);
  limiter.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.setValueAtTime(1.4, now);
  master.connect(limiter);

  // Sharp transient crack — the initial impact.
  const crack = ctx.createOscillator();
  const crackGain = ctx.createGain();
  crack.type = 'triangle';
  crack.frequency.setValueAtTime(420, now);
  crack.frequency.exponentialRampToValueAtTime(70, now + 0.12);
  crackGain.gain.setValueAtTime(0.5, now);
  crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  crack.connect(crackGain);
  crackGain.connect(master);
  crack.start(now);
  crack.stop(now + 0.2);

  // Deep sub-bass boom — the core of the explosion.
  const boom = ctx.createOscillator();
  const boomGain = ctx.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(140, now);
  boom.frequency.exponentialRampToValueAtTime(26, now + 1.6);
  boomGain.gain.setValueAtTime(0.0001, now);
  boomGain.gain.linearRampToValueAtTime(0.85, now + 0.04);
  boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
  boom.connect(boomGain);
  boomGain.connect(master);
  boom.start(now);
  boom.stop(now + 2.1);

  // Low body layer for weight.
  const body = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  body.type = 'triangle';
  body.frequency.setValueAtTime(90, now);
  body.frequency.exponentialRampToValueAtTime(22, now + 1.4);
  bodyGain.gain.setValueAtTime(0.0001, now);
  bodyGain.gain.linearRampToValueAtTime(0.45, now + 0.05);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);
  body.connect(bodyGain);
  bodyGain.connect(master);
  body.start(now);
  body.stop(now + 1.8);

  // Gritty noise rumble with a closing low-pass — the rolling shockwave.
  const rumble = ctx.createBufferSource();
  rumble.buffer = createNoiseBuffer(ctx, 2.0);
  const rumbleFilter = ctx.createBiquadFilter();
  rumbleFilter.type = 'lowpass';
  rumbleFilter.frequency.setValueAtTime(900, now);
  rumbleFilter.frequency.exponentialRampToValueAtTime(70, now + 1.8);
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.setValueAtTime(0.0001, now);
  rumbleGain.gain.linearRampToValueAtTime(0.6, now + 0.06);
  rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);
  rumble.connect(rumbleFilter);
  rumbleFilter.connect(rumbleGain);
  rumbleGain.connect(master);
  rumble.start(now);
  rumble.stop(now + 2.0);
}

export function playSpellSound(type: 'swarm' | 'shooting-star' | 'letter'): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const freqs = type === 'swarm'
    ? [587.33, 739.99, 880.00, 1174.66]
    : type === 'shooting-star'
    ? [880.00, 1046.50, 1318.51, 1760.00]
    : [659.25, 783.99, 987.77, 1318.51];

  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.04);

    gain.gain.setValueAtTime(0.14, now + idx * 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + idx * 0.04);
    osc.stop(now + idx * 0.04 + 0.38);
  });
}

export function playHeartbeatSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(55, now);
  osc1.frequency.exponentialRampToValueAtTime(30, now + 0.12);

  gain1.gain.setValueAtTime(0.95, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.13);

  setTimeout(() => {
    const now2 = ctx.currentTime;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(50, now2);
    osc2.frequency.exponentialRampToValueAtTime(28, now2 + 0.12);

    gain2.gain.setValueAtTime(0.78, now2);
    gain2.gain.exponentialRampToValueAtTime(0.001, now2 + 0.12);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now2);
    osc2.stop(now2 + 0.13);
  }, 220);
}

export function playTypewriterClick(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Sharp tonal tick.
  const tick = ctx.createOscillator();
  const tickGain = ctx.createGain();
  tick.type = 'square';
  tick.frequency.setValueAtTime(1700 + Math.random() * 400, now);
  tickGain.gain.setValueAtTime(0.12, now);
  tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
  tick.connect(tickGain);
  tickGain.connect(ctx.destination);
  tick.start(now);
  tick.stop(now + 0.03);

  // Tiny noise burst for the mechanical "thock".
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.04);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 1200;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.09, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.04);
}

export function playMeteorExplosion(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-10, now);
  limiter.knee.setValueAtTime(2, now);
  limiter.ratio.setValueAtTime(20, now);
  limiter.attack.setValueAtTime(0.001, now);
  limiter.release.setValueAtTime(0.4, now);
  limiter.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.setValueAtTime(1.2, now);
  master.connect(limiter);

  // 1. Deep sub-bass boom — the body of the explosion
  const boom = ctx.createOscillator();
  const boomGain = ctx.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(140, now);
  boom.frequency.exponentialRampToValueAtTime(28, now + 1.2);
  boomGain.gain.setValueAtTime(0.0001, now);
  boomGain.gain.linearRampToValueAtTime(0.95, now + 0.03);
  boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
  boom.connect(boomGain);
  boomGain.connect(master);
  boom.start(now);
  boom.stop(now + 1.6);

  // 2. Sharp transient crack — the impact
  const crack = ctx.createOscillator();
  const crackGain = ctx.createGain();
  crack.type = 'triangle';
  crack.frequency.setValueAtTime(380, now);
  crack.frequency.exponentialRampToValueAtTime(60, now + 0.14);
  crackGain.gain.setValueAtTime(0.55, now);
  crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  crack.connect(crackGain);
  crackGain.connect(master);
  crack.start(now);
  crack.stop(now + 0.2);

  // 3. Mid-range body layer for impact weight
  const body = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  body.type = 'triangle';
  body.frequency.setValueAtTime(85, now);
  body.frequency.exponentialRampToValueAtTime(20, now + 1.0);
  bodyGain.gain.setValueAtTime(0.0001, now);
  bodyGain.gain.linearRampToValueAtTime(0.55, now + 0.04);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
  body.connect(bodyGain);
  bodyGain.connect(master);
  body.start(now);
  body.stop(now + 1.4);

  // 4. Gritty noise shockwave — the rolling debris rumble
  const rumble = ctx.createBufferSource();
  rumble.buffer = createNoiseBuffer(ctx, 1.6);
  const rumbleFilter = ctx.createBiquadFilter();
  rumbleFilter.type = 'lowpass';
  rumbleFilter.frequency.setValueAtTime(900, now);
  rumbleFilter.frequency.exponentialRampToValueAtTime(80, now + 1.4);
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.setValueAtTime(0.0001, now);
  rumbleGain.gain.linearRampToValueAtTime(0.5, now + 0.05);
  rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
  rumble.connect(rumbleFilter);
  rumbleFilter.connect(rumbleGain);
  rumbleGain.connect(master);
  rumble.start(now);
  rumble.stop(now + 1.6);

  // 5. Fire crackle sizzle — high-frequency spark burst
  const sizzle = ctx.createBufferSource();
  sizzle.buffer = createNoiseBuffer(ctx, 0.5);
  const sizzleFilter = ctx.createBiquadFilter();
  sizzleFilter.type = 'bandpass';
  sizzleFilter.frequency.setValueAtTime(2400, now);
  sizzleFilter.frequency.exponentialRampToValueAtTime(600, now + 0.4);
  sizzleFilter.Q.setValueAtTime(1.0, now);
  const sizzleGain = ctx.createGain();
  sizzleGain.gain.setValueAtTime(0.25, now);
  sizzleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  sizzle.connect(sizzleFilter);
  sizzleFilter.connect(sizzleGain);
  sizzleGain.connect(master);
  sizzle.start(now);
  sizzle.stop(now + 0.5);
}

export function playSpaceshipLaunch(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const duration = 4.5;
  const ignitionTime = 0.4; // Matches the visual ignition poof.

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-10, now);
  limiter.knee.setValueAtTime(12, now);
  limiter.ratio.setValueAtTime(14, now);
  limiter.attack.setValueAtTime(0.003, now);
  limiter.release.setValueAtTime(0.18, now);
  limiter.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.linearRampToValueAtTime(0.16, now + ignitionTime);
  master.gain.linearRampToValueAtTime(0.84, now + ignitionTime + 0.18);
  master.gain.linearRampToValueAtTime(0.62, now + 2.4);
  master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  master.connect(limiter);

  const makeShaper = (drive: number): WaveShaperNode => {
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(44100);
    for (let i = 0; i < curve.length; i++) {
      const x = (i * 2) / curve.length - 1;
      curve[i] = Math.tanh(x * drive);
    }
    shaper.curve = curve;
    shaper.oversample = '4x';
    return shaper;
  };

  const rumbleNoise = ctx.createBufferSource();
  rumbleNoise.buffer = createNoiseBuffer(ctx, duration);

  const rumbleFilter = ctx.createBiquadFilter();
  rumbleFilter.type = 'lowpass';
  rumbleFilter.frequency.setValueAtTime(52, now);
  rumbleFilter.frequency.linearRampToValueAtTime(78, now + ignitionTime);
  rumbleFilter.frequency.exponentialRampToValueAtTime(34, now + duration);

  const rumbleGain = ctx.createGain();
  rumbleGain.gain.setValueAtTime(0.34, now);
  rumbleGain.gain.linearRampToValueAtTime(0.56, now + ignitionTime + 0.12);
  rumbleGain.gain.linearRampToValueAtTime(0.4, now + 2.8);
  rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  const rumbleDrive = makeShaper(2.2);
  rumbleNoise.connect(rumbleFilter);
  rumbleFilter.connect(rumbleDrive);
  rumbleDrive.connect(rumbleGain);
  rumbleGain.connect(master);
  rumbleNoise.start(now);
  rumbleNoise.stop(now + duration);

  const bodyNoise = ctx.createBufferSource();
  bodyNoise.buffer = createNoiseBuffer(ctx, duration);

  const bodyBand = ctx.createBiquadFilter();
  bodyBand.type = 'bandpass';
  bodyBand.Q.value = 0.7;
  bodyBand.frequency.setValueAtTime(110, now);
  bodyBand.frequency.linearRampToValueAtTime(180, now + ignitionTime + 0.08);
  bodyBand.frequency.exponentialRampToValueAtTime(85, now + duration);

  const bodyLowpass = ctx.createBiquadFilter();
  bodyLowpass.type = 'lowpass';
  bodyLowpass.frequency.setValueAtTime(420, now);
  bodyLowpass.frequency.linearRampToValueAtTime(620, now + ignitionTime + 0.2);
  bodyLowpass.frequency.exponentialRampToValueAtTime(220, now + duration);

  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.05, now);
  bodyGain.gain.linearRampToValueAtTime(0.68, now + ignitionTime + 0.12);
  bodyGain.gain.linearRampToValueAtTime(0.54, now + 2.0);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  const churnLfo = ctx.createOscillator();
  churnLfo.type = 'triangle';
  churnLfo.frequency.setValueAtTime(5.5, now);

  const churnDepth = ctx.createGain();
  churnDepth.gain.setValueAtTime(85, now);

  churnLfo.connect(churnDepth);
  churnDepth.connect(bodyBand.frequency);

  const bodyDrive = makeShaper(3.4);
  bodyNoise.connect(bodyBand);
  bodyBand.connect(bodyLowpass);
  bodyLowpass.connect(bodyDrive);
  bodyDrive.connect(bodyGain);
  bodyGain.connect(master);

  churnLfo.start(now);
  churnLfo.stop(now + duration);
  bodyNoise.start(now);
  bodyNoise.stop(now + duration);

  const crackleNoise = ctx.createBufferSource();
  crackleNoise.buffer = createNoiseBuffer(ctx, duration);

  const crackleFilter = ctx.createBiquadFilter();
  crackleFilter.type = 'highpass';
  crackleFilter.frequency.setValueAtTime(900, now);

  const crackleGain = ctx.createGain();
  crackleGain.gain.setValueAtTime(0.0001, now);
  crackleGain.gain.linearRampToValueAtTime(0.028, now + ignitionTime);
  crackleGain.gain.linearRampToValueAtTime(0.07, now + ignitionTime + 0.35);
  crackleGain.gain.linearRampToValueAtTime(0.05, now + 2.3);
  crackleGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  const crackleLfo = ctx.createOscillator();
  crackleLfo.type = 'square';
  crackleLfo.frequency.setValueAtTime(17, now);

  const crackleDepth = ctx.createGain();
  crackleDepth.gain.setValueAtTime(0.012, now);

  crackleLfo.connect(crackleDepth);
  crackleDepth.connect(crackleGain.gain);

  const crackleDrive = makeShaper(5.5);
  crackleNoise.connect(crackleFilter);
  crackleFilter.connect(crackleDrive);
  crackleDrive.connect(crackleGain);
  crackleGain.connect(master);

  crackleLfo.start(now + ignitionTime * 0.5);
  crackleLfo.stop(now + duration);
  crackleNoise.start(now);
  crackleNoise.stop(now + duration);

  const transientNoise = ctx.createBufferSource();
  transientNoise.buffer = createNoiseBuffer(ctx, 0.35);

  const transientFilter = ctx.createBiquadFilter();
  transientFilter.type = 'bandpass';
  transientFilter.Q.value = 1.2;
  transientFilter.frequency.setValueAtTime(320, now + ignitionTime);

  const transientGain = ctx.createGain();
  transientGain.gain.setValueAtTime(0.0001, now);
  transientGain.gain.setValueAtTime(0.14, now + ignitionTime);
  transientGain.gain.exponentialRampToValueAtTime(0.0001, now + ignitionTime + 0.28);

  const transientDrive = makeShaper(3.8);
  transientNoise.connect(transientFilter);
  transientFilter.connect(transientDrive);
  transientDrive.connect(transientGain);
  transientGain.connect(master);
  transientNoise.start(now + ignitionTime);
  transientNoise.stop(now + ignitionTime + 0.32);

  const pressureWave = ctx.createOscillator();
  const pressureGain = ctx.createGain();
  pressureWave.type = 'sine';
  pressureWave.frequency.setValueAtTime(44, now + ignitionTime);
  pressureWave.frequency.exponentialRampToValueAtTime(18, now + ignitionTime + 1.7);

  pressureGain.gain.setValueAtTime(0.0001, now);
  pressureGain.gain.setValueAtTime(0.44, now + ignitionTime);
  pressureGain.gain.exponentialRampToValueAtTime(0.0001, now + ignitionTime + 2.0);

  pressureWave.connect(pressureGain);
  pressureGain.connect(master);
  pressureWave.start(now + ignitionTime);
  pressureWave.stop(now + ignitionTime + 2.05);
}


// ==========================================
// SANDBOX POWERS PROCEDURAL SYNTHESIS ENGINE
// ==========================================

interface ChargeAudioState {
  power: MousePower;
  osc1?: OscillatorNode;
  osc2?: OscillatorNode;
  noise?: AudioBufferSourceNode;
  gain: GainNode;
  filter?: BiquadFilterNode;
  startTime: number;
}

let activeCharge: ChargeAudioState | null = null;

function stopChargeState(state: ChargeAudioState): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  try {
    state.gain.gain.cancelScheduledValues(now);
    state.gain.gain.setValueAtTime(state.gain.gain.value, now);
    state.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  } catch (e) {}

  setTimeout(() => {
    try {
      state.osc1?.stop();
      state.osc1?.disconnect();
    } catch (e) {}
    try {
      state.osc2?.stop();
      state.osc2?.disconnect();
    } catch (e) {}
    try {
      state.noise?.stop();
      state.noise?.disconnect();
    } catch (e) {}
    try {
      state.filter?.disconnect();
    } catch (e) {}
    try {
      state.gain?.disconnect();
    } catch (e) {}
  }, 100);
}

/** Updates the active looping charging sound for the selected power. */
export function updatePowerChargeAudio(power: MousePower, isCharging: boolean, progress: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // If we should not be charging, clean up the active synthesizer
  if (!isCharging || (power === 'DEFAULT' && progress === 0)) {
    if (activeCharge) {
      stopChargeState(activeCharge);
      activeCharge = null;
    }
    return;
  }

  // If power changes mid-charge, stop the active one first
  if (activeCharge && activeCharge.power !== power) {
    stopChargeState(activeCharge);
    activeCharge = null;
  }

  // Initialize nodes if not already started
  if (!activeCharge) {
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.connect(ctx.destination);

    let osc1: OscillatorNode | undefined;
    let osc2: OscillatorNode | undefined;
    let noise: AudioBufferSourceNode | undefined;
    let filterNode: BiquadFilterNode | undefined;

    switch (power) {
      case 'DEFAULT': // Nova Strike click-and-hold
        osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(55, now);
        osc1.connect(gainNode);

        osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(85, now);
        osc2.connect(gainNode);

        osc1.start(now);
        osc2.start(now);
        break;

      case 'BLACK_HOLE':
        osc1 = ctx.createOscillator();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(45, now);
        osc1.connect(gainNode);

        // Sweeping spatial noise band
        noise = ctx.createBufferSource();
        noise.buffer = createNoiseBuffer(ctx, 8.0);
        noise.loop = true;
        filterNode = ctx.createBiquadFilter();
        filterNode.type = 'bandpass';
        filterNode.frequency.setValueAtTime(180, now);
        filterNode.Q.setValueAtTime(1.2, now);

        noise.connect(filterNode);
        filterNode.connect(gainNode);

        osc1.start(now);
        noise.start(now);
        break;

      case 'TESLA_DISCHARGE':
        // Deep power line transformer hum (no sawtooth bee buzz!)
        osc1 = ctx.createOscillator();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(50, now);
        osc1.connect(gainNode);

        osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(100, now);
        osc2.connect(gainNode);

        // Electric arc sizzle / crackle noise
        noise = ctx.createBufferSource();
        noise.buffer = createNoiseBuffer(ctx, 6.0);
        noise.loop = true;
        
        filterNode = ctx.createBiquadFilter();
        filterNode.type = 'bandpass';
        filterNode.frequency.setValueAtTime(2500, now);
        filterNode.Q.setValueAtTime(1.5, now);

        noise.connect(filterNode);
        filterNode.connect(gainNode);

        osc1.start(now);
        osc2.start(now);
        noise.start(now);
        break;

      case 'REPELLER':
        osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(120, now);
        osc1.connect(gainNode);

        osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(240, now);
        osc2.connect(gainNode);

        osc1.start(now);
        osc2.start(now);
        break;

      case 'TIME_DILATION':
        osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(320, now);
        osc1.connect(gainNode);
        osc1.start(now);
        break;

      case 'NEBULAR_WIND':
        noise = ctx.createBufferSource();
        noise.buffer = createNoiseBuffer(ctx, 7.0);
        noise.loop = true;
        filterNode = ctx.createBiquadFilter();
        filterNode.type = 'bandpass';
        filterNode.frequency.setValueAtTime(450, now);
        filterNode.Q.setValueAtTime(2.2, now);

        noise.connect(filterNode);
        filterNode.connect(gainNode);
        noise.start(now);
        break;

      case 'PAINT_BRUSH':
        osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(780, now);
        osc1.connect(gainNode);
        osc1.start(now);
        break;

      case 'WORMHOLE':
        osc1 = ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(95, now);

        filterNode = ctx.createBiquadFilter();
        filterNode.type = 'bandpass';
        filterNode.frequency.setValueAtTime(220, now);
        filterNode.Q.setValueAtTime(4.5, now);

        osc1.connect(filterNode);
        filterNode.connect(gainNode);
        osc1.start(now);
        break;
    }

    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.12);
    activeCharge = {
      power,
      osc1,
      osc2,
      noise,
      gain: gainNode,
      filter: filterNode,
      startTime: now
    };
  }

  // Update loop values dynamically based on charge progress (0 to 1)
  const state = activeCharge;
  switch (power) {
    case 'DEFAULT':
      state.osc1?.frequency.setValueAtTime(55 + progress * 105, now);
      state.osc2?.frequency.setValueAtTime(85 + progress * 145, now);
      state.gain.gain.setValueAtTime(0.001 + progress * 0.32, now);
      break;

    case 'BLACK_HOLE':
      state.osc1?.frequency.setValueAtTime(45 + progress * 35, now);
      state.filter?.frequency.setValueAtTime(180 - progress * 95, now);
      state.filter?.Q.setValueAtTime(1.2 + progress * 4.5, now);
      state.gain.gain.setValueAtTime(0.001 + progress * 0.38, now);
      break;

    case 'TESLA_DISCHARGE': {
      // 1. Deep transformer hum: clean and heavy, rises slightly but stays low-pitched
      state.osc1?.frequency.setValueAtTime(50 + progress * 40, now); // 50 to 90 Hz
      state.osc2?.frequency.setValueAtTime(100 + progress * 80, now); // 100 to 180 Hz
      
      // 2. Electric crackle / spark discharges:
      // Modulate the bandpass filter frequency and Q dynamically to create sweeps/arcs
      // And introduce sharp, random volume/gain spikes (crackles) rather than a smooth hiss.
      const hasCrackle = Math.random() > 0.35;
      const crackleFreq = 2000 + Math.random() * 3000 + progress * 1500;
      state.filter?.frequency.setValueAtTime(crackleFreq, now);
      state.filter?.Q.setValueAtTime(1.0 + Math.random() * 3.0, now);
      
      const crackleMod = hasCrackle ? 1.0 : 0.2;
      const electricalSizzle = 0.05 + crackleMod * (0.05 + progress * 0.3);
      state.gain.gain.setValueAtTime(electricalSizzle, now);
      break;
    }

    case 'REPELLER':
      // Magnetic downward sweeps
      state.osc1?.frequency.setValueAtTime(120 - progress * 40, now);
      state.osc2?.frequency.setValueAtTime(240 - progress * 80, now);
      state.gain.gain.setValueAtTime(0.001 + progress * 0.24, now);
      break;

    case 'TIME_DILATION':
      state.osc1?.frequency.setValueAtTime(320 - progress * 210, now);
      // Create a ticking clock amplitude modulation that slows down as we charge!
      const tickRate = 22 - progress * 17.5; // Starts fast (22Hz/rad), slows to 4.5Hz
      const tickAmp = Math.max(0.12, Math.cos((now - state.startTime) * tickRate * Math.PI));
      state.gain.gain.setValueAtTime((0.08 + progress * 0.26) * tickAmp, now);
      break;

    case 'NEBULAR_WIND':
      // Gusty, fluctuating bandpass center frequency
      const gust = Math.sin(now * 5.5) * 95;
      state.filter?.frequency.setValueAtTime(450 + progress * 850 + gust, now);
      state.gain.gain.setValueAtTime(0.001 + progress * 0.3, now);
      break;

    case 'PAINT_BRUSH':
      // High-pitched shimmery magic vibrato
      const paintVibrato = Math.sin(now * 85) * 65;
      state.osc1?.frequency.setValueAtTime(780 + progress * 480 + paintVibrato, now);
      state.gain.gain.setValueAtTime(0.001 + progress * 0.2, now);
      break;

    case 'WORMHOLE':
      // Teleporter sweep
      const pSweep = Math.sin(now * 12) * 120;
      state.filter?.frequency.setValueAtTime(220 + progress * 650 + pSweep, now);
      state.gain.gain.setValueAtTime(0.001 + progress * 0.28, now);
      break;
  }
}

/** Plays the release/activation sound based on the power and the release tier. */
export function playPowerReleaseSound(power: MousePower, tier: SandboxChargeTier): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Master limiter for all release blasts
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-6, now);
  limiter.knee.setValueAtTime(3, now);
  limiter.ratio.setValueAtTime(15, now);
  limiter.attack.setValueAtTime(0.002, now);
  limiter.release.setValueAtTime(0.2, now);
  limiter.connect(ctx.destination);

  const master = ctx.createGain();
  master.connect(limiter);

  switch (power) {
    case 'DEFAULT':
      if (tier === 'tap') {
        // Quick clean pop with sharp transient kick
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

        osc.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + 0.15);
      } else {
        // Nova Strike: A massive shockwave explosion.
        const isSuper = tier === 'super';
        const volume = isSuper ? 1.6 : 1.0;
        const duration = isSuper ? 1.8 : 1.2;

        // 1. Heavy initial sub-bass transient punch (Kick-style drop)
        const kick = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kick.type = 'triangle';
        kick.frequency.setValueAtTime(220, now);
        kick.frequency.exponentialRampToValueAtTime(40, now + 0.15);
        kickGain.gain.setValueAtTime(volume * 0.95, now);
        kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        kick.connect(kickGain);
        kickGain.connect(master);
        kick.start(now);
        kick.stop(now + 0.2);

        // 2. Slow deep sub-bass body rumble (lasting duration of explosion)
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(140, now);
        sub.frequency.exponentialRampToValueAtTime(28, now + duration);
        subGain.gain.setValueAtTime(0, now);
        subGain.gain.linearRampToValueAtTime(volume * 0.9, now + 0.05); // slight swell to layer under kick
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        sub.connect(subGain);
        subGain.connect(master);
        sub.start(now);
        sub.stop(now + duration + 0.15);

        // 3. Resonant sweeping white-noise shockwave representing gas dispersion
        const noise = ctx.createBufferSource();
        noise.buffer = createNoiseBuffer(ctx, duration);
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1800, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(85, now + duration);
        noiseFilter.Q.setValueAtTime(2.0, now);
        
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.001, now);
        noiseGain.gain.linearRampToValueAtTime(volume * 0.85, now + 0.03);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(master);
        noise.start(now);
        noise.stop(now + duration + 0.15);

        // 4. Detuned medium buzz layer for futuristic space crunch
        const buzz = ctx.createOscillator();
        const buzzGain = ctx.createGain();
        buzz.type = 'sawtooth';
        buzz.frequency.setValueAtTime(80, now);
        buzz.frequency.exponentialRampToValueAtTime(32, now + duration * 0.7);
        
        const buzzFilter = ctx.createBiquadFilter();
        buzzFilter.type = 'lowpass';
        buzzFilter.frequency.setValueAtTime(350, now);
        
        buzzGain.gain.setValueAtTime(volume * 0.35, now);
        buzzGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.75);
        
        buzz.connect(buzzFilter);
        buzzFilter.connect(buzzGain);
        buzzGain.connect(master);
        buzz.start(now);
        buzz.stop(now + duration + 0.1);
      }
      break;

    case 'BLACK_HOLE': {
      // Suction sound whoosh followed by gravity snap
      const duration = tier === 'super' ? 0.45 : tier === 'charged' ? 0.32 : 0.2;
      const vol = tier === 'super' ? 0.95 : tier === 'charged' ? 0.65 : 0.4;

      // Suction whoosh
      const suckNoise = ctx.createBufferSource();
      suckNoise.buffer = createNoiseBuffer(ctx, duration + 0.05);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(120, now);
      filter.frequency.exponentialRampToValueAtTime(750, now + duration);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol * 0.4, now + duration * 0.65);
      gain.gain.setValueAtTime(0, now + duration);

      suckNoise.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      suckNoise.start(now);
      suckNoise.stop(now + duration + 0.1);

      // Bass gravity thud at release end
      const impactTime = now + duration;
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(85, impactTime);
      sub.frequency.exponentialRampToValueAtTime(20, impactTime + 1.2);
      subGain.gain.setValueAtTime(0, now);
      subGain.gain.setValueAtTime(vol * 0.9, impactTime);
      subGain.gain.exponentialRampToValueAtTime(0.0001, impactTime + 1.25);
      sub.connect(subGain);
      subGain.connect(master);
      sub.start(impactTime);
      sub.stop(impactTime + 1.3);
      break;
    }

    case 'TESLA_DISCHARGE': {
      const isSuper = tier === 'super';
      const isCharged = tier === 'charged';
      
      const vol = isSuper ? 1.6 : isCharged ? 1.0 : 0.45;
      const thunderDuration = isSuper ? 2.2 : isCharged ? 1.4 : 0.6;
      
      // 1. Pre-discharge sizzle crackles (rapid micro clicks)
      const clickCount = isSuper ? 4 : isCharged ? 2 : 0;
      for (let i = 0; i < clickCount; i++) {
        const clickTime = now + i * 0.035 + Math.random() * 0.015;
        const clickOsc = ctx.createOscillator();
        clickOsc.type = 'square';
        clickOsc.frequency.setValueAtTime(1800 + Math.random() * 800, clickTime);
        const clickGain = ctx.createGain();
        clickGain.gain.setValueAtTime(0.12, clickTime);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, clickTime + 0.012);
        clickOsc.connect(clickGain);
        clickGain.connect(master);
        clickOsc.start(clickTime);
        clickOsc.stop(clickTime + 0.015);
      }

      // The main lightning bolt strikes slightly after the clicks
      const strikeTime = now + (clickCount > 0 ? clickCount * 0.035 + 0.02 : 0);

      // 2. High-voltage lightning snap (The main crack)
      // Layered dual-square sweep for extreme resonance
      const crackOsc1 = ctx.createOscillator();
      crackOsc1.type = 'square';
      crackOsc1.frequency.setValueAtTime(2800, strikeTime);
      crackOsc1.frequency.exponentialRampToValueAtTime(600, strikeTime + 0.09);

      const crackOsc2 = ctx.createOscillator();
      crackOsc2.type = 'sawtooth';
      crackOsc2.frequency.setValueAtTime(1400, strikeTime);
      crackOsc2.frequency.exponentialRampToValueAtTime(200, strikeTime + 0.09);

      const crackGain = ctx.createGain();
      crackGain.gain.setValueAtTime(vol * 0.65, strikeTime);
      crackGain.gain.exponentialRampToValueAtTime(0.0001, strikeTime + 0.12);

      crackOsc1.connect(crackGain);
      crackOsc2.connect(crackGain);
      crackGain.connect(master);
      crackOsc1.start(strikeTime);
      crackOsc2.start(strikeTime);
      crackOsc1.stop(strikeTime + 0.15);
      crackOsc2.stop(strikeTime + 0.15);

      // 3. Lightning sizzle (Highpass white noise snap)
      const sizzleNoise = ctx.createBufferSource();
      sizzleNoise.buffer = createNoiseBuffer(ctx, 0.18);
      const sizzleFilter = ctx.createBiquadFilter();
      sizzleFilter.type = 'highpass';
      sizzleFilter.frequency.setValueAtTime(3500, strikeTime);
      const sizzleGain = ctx.createGain();
      sizzleGain.gain.setValueAtTime(vol * 0.45, strikeTime);
      sizzleGain.gain.exponentialRampToValueAtTime(0.0001, strikeTime + 0.15);

      sizzleNoise.connect(sizzleFilter);
      sizzleFilter.connect(sizzleGain);
      sizzleGain.connect(master);
      sizzleNoise.start(strikeTime);
      sizzleNoise.stop(strikeTime + 0.2);

      // 4. Low-frequency rolling thunder rumble
      if (isCharged || isSuper) {
        // Deep sub boom
        const boom = ctx.createOscillator();
        const boomGain = ctx.createGain();
        boom.type = 'triangle';
        boom.frequency.setValueAtTime(65, strikeTime);
        boom.frequency.exponentialRampToValueAtTime(24, strikeTime + thunderDuration);
        boomGain.gain.setValueAtTime(vol * 0.95, strikeTime);
        boomGain.gain.exponentialRampToValueAtTime(0.0001, strikeTime + thunderDuration);
        boom.connect(boomGain);
        boomGain.connect(master);
        boom.start(strikeTime);
        boom.stop(strikeTime + thunderDuration + 0.15);

        // Low-pass filtered rolling noise rumble
        const rumbleNoise = ctx.createBufferSource();
        rumbleNoise.buffer = createNoiseBuffer(ctx, thunderDuration);
        
        const rumbleFilter = ctx.createBiquadFilter();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.setValueAtTime(280, strikeTime);
        rumbleFilter.frequency.exponentialRampToValueAtTime(45, strikeTime + thunderDuration);

        // Amplitude modulator (LFO) for rolling crackle effect
        const rumbleGain = ctx.createGain();
        rumbleGain.gain.setValueAtTime(vol * 0.75, strikeTime);
        
        // Connect LFO (modulator) to gain node's gain parameter
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 14; // 14 Hz rolling shake
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = vol * 0.25; // depth of modulation
        
        lfo.connect(lfoGain);
        lfoGain.connect(rumbleGain.gain);
        
        rumbleGain.gain.exponentialRampToValueAtTime(0.0001, strikeTime + thunderDuration);

        rumbleNoise.connect(rumbleFilter);
        rumbleFilter.connect(rumbleGain);
        rumbleGain.connect(master);
        
        lfo.start(strikeTime);
        rumbleNoise.start(strikeTime);
        lfo.stop(strikeTime + thunderDuration + 0.1);
        rumbleNoise.stop(strikeTime + thunderDuration + 0.1);
      } else {
        // Tap: small quick discharge thump
        const boom = ctx.createOscillator();
        const boomGain = ctx.createGain();
        boom.type = 'sine';
        boom.frequency.setValueAtTime(90, strikeTime);
        boom.frequency.exponentialRampToValueAtTime(40, strikeTime + 0.35);
        boomGain.gain.setValueAtTime(vol * 0.6, strikeTime);
        boomGain.gain.exponentialRampToValueAtTime(0.0001, strikeTime + 0.38);
        boom.connect(boomGain);
        boomGain.connect(master);
        boom.start(strikeTime);
        boom.stop(strikeTime + 0.4);
      }
      break;
    }

    case 'REPELLER': {
      // Outward kinetic deflector sweep
      const sweepDur = tier === 'super' ? 0.72 : tier === 'charged' ? 0.48 : 0.28;
      const maxFreq = tier === 'super' ? 420 : tier === 'charged' ? 320 : 220;
      const vol = tier === 'super' ? 0.85 : tier === 'charged' ? 0.6 : 0.4;

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(maxFreq, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + sweepDur);

      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, sweepDur);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + sweepDur);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol * 0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + sweepDur + 0.05);

      osc.connect(gain);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      osc.start(now);
      noise.start(now);
      osc.stop(now + sweepDur + 0.1);
      noise.stop(now + sweepDur + 0.1);
      break;
    }

    case 'TIME_DILATION': {
      // Expanding resonant warp dome
      const dur = tier === 'super' ? 0.68 : tier === 'charged' ? 0.48 : 0.32;
      const vol = tier === 'super' ? 0.8 : tier === 'charged' ? 0.55 : 0.35;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + dur);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(180, now);
      filter.frequency.exponentialRampToValueAtTime(1800, now + dur);
      filter.Q.setValueAtTime(5.5, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(vol * 0.75, now + dur * 0.4);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.05);

      // Glass ring overlay (high-pitch carrier)
      const ring = ctx.createOscillator();
      ring.type = 'sine';
      ring.frequency.setValueAtTime(880, now);
      ring.frequency.exponentialRampToValueAtTime(2000, now + dur);
      const ringGain = ctx.createGain();
      ringGain.gain.setValueAtTime(vol * 0.18, now);
      ringGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      ring.connect(ringGain);
      ringGain.connect(master);

      osc.start(now);
      ring.start(now);
      osc.stop(now + dur + 0.1);
      ring.stop(now + dur + 0.1);
      break;
    }

    case 'NEBULAR_WIND': {
      const gustDur = tier === 'super' ? 1.4 : tier === 'charged' ? 0.8 : 0.42;
      const vol = tier === 'super' ? 0.9 : tier === 'charged' ? 0.6 : 0.35;

      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, gustDur);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + gustDur);
      filter.Q.setValueAtTime(2.8, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(vol * 0.85, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + gustDur + 0.05);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      noise.start(now);
      noise.stop(now + gustDur + 0.1);
      break;
    }

    case 'PAINT_BRUSH': {
      // Magic sparkle chime chord
      const noteCount = tier === 'super' ? 8 : tier === 'charged' ? 5 : 3;
      const baseFreq = tier === 'super' ? 987.77 : tier === 'charged' ? 783.99 : 659.25;

      for (let i = 0; i < noteCount; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const delay = i * 0.038;

        osc.type = 'sine';
        // Ascending harmonic series
        osc.frequency.setValueAtTime(baseFreq * (1 + i * 0.25), now + delay);

        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(0.12, now + delay + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.28);

        osc.connect(gain);
        gain.connect(master);

        osc.start(now + delay);
        osc.stop(now + delay + 0.32);
      }
      break;
    }

    case 'WORMHOLE': {
      if (tier === 'super') {
        // Electronic sci-fi portal hypergate sweep
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(680, now + 0.65);

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(300, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.42, now + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);

        osc.start(now);
        osc.stop(now + 0.75);
      } else {
        // Normal placement beep
        const firstBeep = ctx.createOscillator();
        const gain1 = ctx.createGain();
        firstBeep.type = 'sine';
        firstBeep.frequency.setValueAtTime(523.25, now); // C5

        gain1.gain.setValueAtTime(0.18, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

        firstBeep.connect(gain1);
        gain1.connect(master);
        firstBeep.start(now);
        firstBeep.stop(now + 0.09);

        // Second slightly higher beep
        const secondBeep = ctx.createOscillator();
        const gain2 = ctx.createGain();
        secondBeep.type = 'sine';
        secondBeep.frequency.setValueAtTime(783.99, now + 0.075); // G5

        gain2.gain.setValueAtTime(0, now + 0.075);
        gain2.gain.linearRampToValueAtTime(0.15, now + 0.075 + 0.015);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.075 + 0.14);

        secondBeep.connect(gain2);
        gain2.connect(master);
        secondBeep.start(now + 0.075);
        secondBeep.stop(now + 0.075 + 0.16);
      }
      break;
    }
  }
}

/** UI sound effects */

export function playSelectPowerSound(power: MousePower): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  // Give different powers slightly distinct select bleeps
  const pitchOffset = ({
    DEFAULT: 0,
    BLACK_HOLE: -80,
    TESLA_DISCHARGE: 150,
    REPELLER: -40,
    TIME_DILATION: 80,
    NEBULAR_WIND: 20,
    PAINT_BRUSH: 280,
    WORMHOLE: 120,
    PLANET: -120,
    METEOR: 200
  } as any)[power] || 0;

  osc.frequency.setValueAtTime(620 + pitchOffset, now);
  osc.frequency.exponentialRampToValueAtTime(880 + pitchOffset, now + 0.065);

  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.08);
}

export function playToggleSandboxSound(isOpen: boolean): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'triangle';
  filter.type = 'lowpass';

  if (isOpen) {
    // Upward sliding futuristic slide open
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(560, now + 0.22);
    filter.frequency.setValueAtTime(250, now);
    filter.frequency.exponentialRampToValueAtTime(1500, now + 0.22);
  } else {
    // Downward folding slide close
    osc.frequency.setValueAtTime(560, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.18);
  }

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.23);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.24);
}

export function playClearSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sawtooth';
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(900, now);
  filter.frequency.exponentialRampToValueAtTime(80, now + 0.42);
  filter.Q.setValueAtTime(2.0, now);

  osc.frequency.setValueAtTime(280, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.42);

  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.46);
}

// Throttled feedback sounds for portal captures and particle consumes
let lastWormholeTeleport = 0;
export function playWormholeTeleportSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Throttle to avoid audio clipping / overlay fatigue (max 1 teleport sound every 120ms)
  if (now - lastWormholeTeleport < 0.12) {
    return;
  }
  lastWormholeTeleport = now;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(330, now);
  osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);

  gain.gain.setValueAtTime(0.07, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.1);
}

let lastBlackHoleConsume = 0;
export function playBlackHoleConsumeSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Throttle to max 1 consume sound every 70ms
  if (now - lastBlackHoleConsume < 0.07) {
    return;
  }
  lastBlackHoleConsume = now;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220 + Math.random() * 120, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.06);

  gain.gain.setValueAtTime(0.09, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.08);
}
