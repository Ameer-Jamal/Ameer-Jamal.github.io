import { MousePower, SandboxChargeTier } from '../../models/cosmic.types';

import { createNoiseBuffer, getAudioContext } from './context';

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
