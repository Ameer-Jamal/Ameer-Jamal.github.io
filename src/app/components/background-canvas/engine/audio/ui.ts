import { MousePower, SandboxChargeTier } from '../../models/cosmic.types';

import { getAudioContext } from './context';

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
    METEOR: 200,
    STELLAR_LASSO: -160,
    QUANTUM_SPLITTER: 320
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
