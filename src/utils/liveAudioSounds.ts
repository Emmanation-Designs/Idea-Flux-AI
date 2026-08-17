/**
 * High-fidelity earcons and acoustic chimes for Trelvix Live Mode
 * Synthesized purely in Web Audio API for zero latency and studio-grade clarity.
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (e) {
    console.warn('[Live Audio] AudioContext init notice:', e);
    return null;
  }
}

/**
 * Ascending harmonic chime played when entering / opening Live Mode (ChatGPT style)
 */
export function playLiveOpenSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master bus with warm acoustic filter
    const masterGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4200, now);
    filter.Q.setValueAtTime(1.0, now);

    masterGain.connect(filter);
    filter.connect(ctx.destination);

    // Initial silent gain to prevent click
    masterGain.gain.setValueAtTime(0.0001, now);

    // Note 1: C5 (523.25Hz) + E5 (659.25Hz)
    const osc1 = ctx.createOscillator();
    const osc1Harmonic = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    osc1Harmonic.type = 'triangle';
    osc1Harmonic.frequency.setValueAtTime(659.25, now);

    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc1.connect(gain1);
    osc1Harmonic.connect(gain1);
    gain1.connect(masterGain);

    osc1.start(now);
    osc1Harmonic.start(now);
    osc1.stop(now + 0.38);
    osc1Harmonic.stop(now + 0.38);

    // Note 2 (Ascending): G5 (783.99Hz) + C6 (1046.50Hz) + soft sparkle (1567.98Hz)
    const t2 = now + 0.08;
    const osc2 = ctx.createOscillator();
    const osc2Harmonic = ctx.createOscillator();
    const osc2Sparkle = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, t2);
    osc2Harmonic.type = 'sine';
    osc2Harmonic.frequency.setValueAtTime(1046.50, t2);
    osc2Sparkle.type = 'sine';
    osc2Sparkle.frequency.setValueAtTime(1567.98, t2);

    gain2.gain.setValueAtTime(0.0001, t2);
    gain2.gain.exponentialRampToValueAtTime(0.15, t2 + 0.025);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.48);

    osc2.connect(gain2);
    osc2Harmonic.connect(gain2);
    osc2Sparkle.connect(gain2);
    gain2.connect(masterGain);

    osc2.start(t2);
    osc2Harmonic.start(t2);
    osc2Sparkle.start(t2);
    osc2.stop(t2 + 0.52);
    osc2Harmonic.stop(t2 + 0.52);
    osc2Sparkle.stop(t2 + 0.52);

  } catch (err) {
    console.warn('[Live Audio] playLiveOpenSound error:', err);
  }
}

/**
 * Descending harmonic chime played when exiting / closing Live Mode (ChatGPT style)
 */
export function playLiveCloseSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master bus with warm soft filter
    const masterGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, now);
    filter.Q.setValueAtTime(0.8, now);

    masterGain.connect(filter);
    filter.connect(ctx.destination);

    masterGain.gain.setValueAtTime(0.0001, now);

    // Note 1 (Higher): G5 (783.99Hz) + E5 (659.25Hz)
    const osc1 = ctx.createOscillator();
    const osc1Harmonic = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, now);
    osc1Harmonic.type = 'sine';
    osc1Harmonic.frequency.setValueAtTime(659.25, now);

    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    osc1.connect(gain1);
    osc1Harmonic.connect(gain1);
    gain1.connect(masterGain);

    osc1.start(now);
    osc1Harmonic.start(now);
    osc1.stop(now + 0.35);
    osc1Harmonic.stop(now + 0.35);

    // Note 2 (Descending Resolution): C5 (523.25Hz) + G4 (392.00Hz)
    const t2 = now + 0.085;
    const osc2 = ctx.createOscillator();
    const osc2Harmonic = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(523.25, t2);
    osc2Harmonic.type = 'triangle';
    osc2Harmonic.frequency.setValueAtTime(392.00, t2);

    gain2.gain.setValueAtTime(0.0001, t2);
    gain2.gain.exponentialRampToValueAtTime(0.14, t2 + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.42);

    osc2.connect(gain2);
    osc2Harmonic.connect(gain2);
    gain2.connect(masterGain);

    osc2.start(t2);
    osc2Harmonic.start(t2);
    osc2.stop(t2 + 0.46);
    osc2Harmonic.stop(t2 + 0.46);

  } catch (err) {
    console.warn('[Live Audio] playLiveCloseSound error:', err);
  }
}
