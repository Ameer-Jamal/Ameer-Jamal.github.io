import { MousePower, SandboxChargeTier } from '../../models/cosmic.types';

import { createNoiseBuffer, getAudioContext } from './context';

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
