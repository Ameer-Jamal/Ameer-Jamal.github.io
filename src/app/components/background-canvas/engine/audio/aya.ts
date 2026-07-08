import { MousePower, SandboxChargeTier } from '../../models/cosmic.types';

import { createNoiseBuffer, getAudioContext } from './context';

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
