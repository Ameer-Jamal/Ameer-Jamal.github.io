import { MousePower, SandboxChargeTier } from '../../models/cosmic.types';

import { createNoiseBuffer, getAudioContext } from './context';

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
