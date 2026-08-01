/**
 * Penny's voice-signature: a swift, warm, coin-like "ding" she plays the instant
 * her reply drops in. Synthesized with the Web Audio API (no audio file), so it
 * stays tiny and sounds the same on every Penny surface.
 *
 * For a screen-reader-first product this is a real feature, not decoration: a
 * blind operator hears "that's Penny" the moment she speaks. Design goals: warm,
 * coin-like, quick (~0.35s), and easy on the ear — never overbearing.
 *
 * Safe by design — feature-detected, fully wrapped, low volume, and only ever
 * triggered right after a user action (sending a message), so browser autoplay
 * policies are satisfied. It can never throw into the caller.
 */
export function playPennyChime(volume = 0.13): void {
  try {
    const Ctx = (window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.value = volume;
    // A gentle low-pass keeps the metal warm rather than harsh.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4200;
    lp.Q.value = 0.7;
    master.connect(lp);
    lp.connect(ctx.destination);

    // One small voice: quick attack, fast exponential decay — like a struck coin.
    const voice = (freq: number, at: number, dur: number, peak: number, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now + at);
      g.gain.exponentialRampToValueAtTime(peak, now + at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(now + at);
      osc.stop(now + at + dur + 0.02);
    };

    // Two quick notes a warm third apart — arrival, then a swift settle.
    // A soft low body under the first note gives warmth; a faint inharmonic
    // partial (x2.76, bell/coin ratio) gives the metallic glint. Total ~0.35s.
    voice(1046.5, 0.0, 0.26, 1.0);                 // C6 arrival
    voice(523.25, 0.0, 0.18, 0.26, 'triangle');    // C5 warm body
    voice(1046.5 * 2.76, 0.0, 0.11, 0.05);         // metallic glint
    voice(1318.51, 0.055, 0.30, 0.68);             // E6 settle
    voice(1318.51 * 2.76, 0.055, 0.11, 0.035);     // glint

    window.setTimeout(() => { ctx.close().catch(() => { /* already closed */ }); }, 900);
  } catch {
    /* audio unavailable — stay silent, never throw */
  }
}

export default playPennyChime;
