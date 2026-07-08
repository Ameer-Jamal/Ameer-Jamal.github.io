import { MousePower, SandboxChargeTier } from '../../models/cosmic.types';

import { createNoiseBuffer, getAudioContext } from './context';

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

    case 'STELLAR_LASSO': {
      const dur = tier === 'super' ? 0.38 : tier === 'charged' ? 0.28 : 0.18;
      const vol = tier === 'super' ? 1.0 : tier === 'charged' ? 0.7 : 0.45;
      
      // Thread contraction sweep
      const snap = ctx.createOscillator();
      snap.type = 'triangle';
      snap.frequency.setValueAtTime(880, now);
      snap.frequency.exponentialRampToValueAtTime(110, now + dur);
      
      const snapGain = ctx.createGain();
      snapGain.gain.setValueAtTime(vol * 0.75, now);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      
      snap.connect(snapGain);
      snapGain.connect(master);
      snap.start(now);
      snap.stop(now + dur + 0.05);
      
      // Energy pop burst noise
      const noise = ctx.createBufferSource();
      noise.buffer = createNoiseBuffer(ctx, dur);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.frequency.exponentialRampToValueAtTime(400, now + dur);
      
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(vol * 0.45, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(master);
      noise.start(now);
      noise.stop(now + dur + 0.05);
      break;
    }

    case 'QUANTUM_SPLITTER': {
      const dur = tier === 'super' ? 0.68 : tier === 'charged' ? 0.45 : 0.3;
      const vol = tier === 'super' ? 1.3 : tier === 'charged' ? 0.9 : 0.55;
      
      // Detuned buzzy reality laser slash oscillators
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(800, now);
      osc1.frequency.exponentialRampToValueAtTime(80, now + dur);
      
      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(815, now); // slightly detuned
      osc2.frequency.exponentialRampToValueAtTime(78, now + dur);
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(250, now + dur);
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol * 0.68, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + dur + 0.05);
      osc2.stop(now + dur + 0.05);
      break;
    }
  }
}
