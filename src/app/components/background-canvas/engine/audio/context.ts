import { MousePower, SandboxChargeTier } from '../../models/cosmic.types';

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
export function createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}
