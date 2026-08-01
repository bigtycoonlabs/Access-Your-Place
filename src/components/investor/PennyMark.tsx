interface PennyMarkProps {
  size?: number;
  speaking?: boolean;
  still?: boolean;
  className?: string;
  label?: string;
}

/**
 * Penny's visual identity: a luminous navy-to-gold coin — a presence, not a piece
 * of clip-art robot. A rich gradient gives it depth, a slow light-sweep gives it
 * an ethereal shimmer, and a soft aura makes her feel alive. She breathes gently
 * at rest and quickens while thinking or speaking. Paired with her penny-drop
 * chime (lib/pennyChime), Penny becomes an identity you can HEAR as well as see.
 *
 * Respects prefers-reduced-motion. Pass `still` for inline/repeated placements
 * (one per chat message) so a long list of coins doesn't shimmer at once.
 * Decorative layers are aria-hidden; the wrapper carries one "Penny" label.
 */
export function PennyMark({ size = 40, speaking = false, still = false, className = '', label = 'Penny' }: PennyMarkProps) {
  const dur = speaking ? '1.15s' : '2.8s';
  const glowInset = -Math.round(size * 0.32);
  const dot = Math.max(2, Math.round(size * 0.15));
  const glowAnim = still ? 'none' : `pennyGlow ${dur} ease-in-out infinite`;
  const orbAnim = still ? 'none' : `pennyBreathe ${dur} ease-in-out infinite`;
  const sheenAnim = still ? 'none' : `pennySheen ${speaking ? '3.2s' : '6s'} linear infinite`;

  return (
    <span
      role="img"
      aria-label={label}
      className={`penny-mark ${className}`}
      style={{ position: 'relative', display: 'inline-block', width: size, height: size, flex: '0 0 auto' }}
    >
      <style>{`
        @keyframes pennyBreathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.055)} }
        @keyframes pennyGlow { 0%,100%{opacity:.35} 50%{opacity:.8} }
        @keyframes pennySheen { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @media (prefers-reduced-motion: reduce){ .penny-mark-orb,.penny-mark-glow,.penny-mark-sheen{animation:none!important} }
      `}</style>

      <span
        className="penny-mark-glow"
        aria-hidden="true"
        style={{
          position: 'absolute', inset: glowInset, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,165,116,0.7) 0%, rgba(212,165,116,0) 70%)',
          animation: glowAnim, pointerEvents: 'none',
        }}
      />

      <span
        className="penny-mark-orb"
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden',
          background: 'radial-gradient(circle at 34% 28%, #f0d9b8 0%, #d4a574 24%, #9c7748 48%, #2d4a7c 74%, #1a365d 100%)',
          boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.45), inset 0 -3px 7px rgba(0,0,0,0.4)',
          animation: orbAnim,
        }}
      >
        <span
          className="penny-mark-sheen"
          aria-hidden="true"
          style={{
            position: 'absolute', inset: '-40%', borderRadius: '50%',
            background: 'conic-gradient(from 0deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.28) 40deg, rgba(255,255,255,0) 92deg, rgba(255,255,255,0) 360deg)',
            animation: sheenAnim, mixBlendMode: 'screen',
          }}
        />
      </span>

      <span
        aria-hidden="true"
        style={{
          position: 'absolute', top: '20%', left: '24%', width: dot, height: dot,
          borderRadius: '50%', background: 'rgba(255,255,255,0.85)', filter: 'blur(0.5px)',
        }}
      />
    </span>
  );
}

export default PennyMark;
