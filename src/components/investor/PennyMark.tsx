interface PennyMarkProps {
  size?: number;
  speaking?: boolean;
  still?: boolean;
  className?: string;
  label?: string;
}

/**
 * Penny's visual identity: a calm navy-to-gold glowing disc — a presence, not a
 * piece of clip-art robot. She breathes gently at rest and pulses a little
 * brighter while she is thinking or speaking. Paired with her penny-drop chime
 * (see lib/pennyChime), this gives Penny an identity you can HEAR as well as see.
 * Respects prefers-reduced-motion. Pass `still` for inline/repeated placements
 * (e.g. one per chat message) so a long list of discs doesn't shimmer at once.
 * Purely decorative layers are aria-hidden; the wrapper carries one "Penny" label.
 */
export function PennyMark({ size = 40, speaking = false, still = false, className = '', label = 'Penny' }: PennyMarkProps) {
  const dur = speaking ? '1.2s' : '2.6s';
  const glowInset = -Math.round(size * 0.28);
  const dot = Math.max(2, Math.round(size * 0.16));
  const glowAnim = still ? 'none' : `pennyGlow ${dur} ease-in-out infinite`;
  const orbAnim = still ? 'none' : `pennyBreathe ${dur} ease-in-out infinite`;
  return (
    <span
      role="img"
      aria-label={label}
      className={`penny-mark ${className}`}
      style={{ position: 'relative', display: 'inline-block', width: size, height: size, flex: '0 0 auto' }}
    >
      <style>{`
        @keyframes pennyBreathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes pennyGlow { 0%,100%{opacity:.4} 50%{opacity:.85} }
        @media (prefers-reduced-motion: reduce){ .penny-mark-orb,.penny-mark-glow{animation:none!important} }
      `}</style>
      <span
        className="penny-mark-glow"
        aria-hidden="true"
        style={{
          position: 'absolute', inset: glowInset, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,165,116,0.75) 0%, rgba(212,165,116,0) 68%)',
          animation: glowAnim,
          pointerEvents: 'none',
        }}
      />
      <span
        className="penny-mark-orb"
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #d4a574 0%, #b98a52 26%, #2d4a7c 68%, #1a365d 100%)',
          boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.35), inset 0 -3px 6px rgba(0,0,0,0.35)',
          animation: orbAnim,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', top: '22%', left: '26%', width: dot, height: dot,
          borderRadius: '50%', background: 'rgba(255,255,255,0.7)', filter: 'blur(0.5px)',
        }}
      />
    </span>
  );
}

export default PennyMark;
