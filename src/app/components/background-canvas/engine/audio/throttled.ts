import { MousePower, SandboxChargeTier } from '../../models/cosmic.types';

import { getAudioContext } from './context';

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
