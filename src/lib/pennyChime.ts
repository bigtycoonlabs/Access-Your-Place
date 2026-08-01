/**
 * Penny's voice-signature: a short, warm two-note "penny-drop" chime she plays
 * whenever she finishes speaking. Synthesized with the Web Audio API (no audio
 * file needed), so it stays tiny and works everywhere.
 *
 * For a screen-reader-first product this is a real feature, not decoration: a
 * blind operator hears "that's Penny" the instant she replies, before a single
 * word is read aloud.
 *
 * Safe by design — feature-detected, fully wrapped, low volume, and only ever
 * triggered right after a user action (sending a message), so browser autoplay
 * policies are satisfied. It can never throw into the caller.
 */
export function playPennyChime(volume = 0.16): void {
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);

    // Two bright notes a fifth apart: an arrival, then a settling shimmer.
    const notes = [
      { freq: 880.0, at: 0.0, dur: 0.4 },    // A5
      { freq: 1318.51, at: 0.1, dur: 0.55 }, // E6
    ];
    // Fundamental plus a faint inharmonic overtone gives it a coin-like ring.
    const partials = [
      { mult: 1, peak: 1 },
      { mult: 2.01, peak: 0.3 },
    ];

    for (const n of notes) {
      for (const p of partials) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = n.freq * p.mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now + n.at);
        g.gain.exponentialRampToValueAtTime(p.peak, now + n.at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, now + n.at + n.dur);
        osc.connect(g);
        g.connect(master);
        osc.start(now + n.at);
        osc.stop(now + n.at + n.dur + 0.03);
      }
    }

    window.setTimeout(() => { ctx.close().catch(() => { /* already closed */ }); }, 1200);
  } catch {
    /* audio unavailable — stay silent, never throw */
  }
}

export default playPennyChime;
