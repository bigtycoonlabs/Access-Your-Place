interface PennyPresenceProps {
  /** Positioning / offset utilities, e.g. "top-0 right-0 -translate-y-1/3". */
  className?: string;
  /** Diameter of the glow in px. */
  size?: number;
  /** Peak opacity of the warm core, 0..1. Keep low; this lives behind content. */
  intensity?: number;
}

/**
 * Penny's ambient presence: a large, soft, ethereal glow of her coin, drifting
 * behind a section so a client feels she is still with them even when she isn't
 * speaking. Purely decorative — absolutely positioned, aria-hidden, and
 * pointer-events-none, so it never interferes with layout or interaction.
 *
 * Drop it as the first child of a `relative` container and keep real content
 * above it (e.g. wrap content in a `relative z-10`). Respects reduced-motion.
 */
export function PennyPresence({ className = '', size = 520, intensity = 0.16 }: PennyPresenceProps) {
  const core = Math.min(0.6, Math.max(0, intensity));
  const mid = core * 0.7;
  return (
    <div
      aria-hidden="true"
      className={`penny-presence pointer-events-none absolute ${className}`}
      style={{
        width: size, height: size, borderRadius: '50%', zIndex: 0,
        background: `radial-gradient(circle at 42% 38%, rgba(212,165,116,${core}) 0%, rgba(45,74,124,${mid}) 44%, rgba(26,54,93,0) 72%)`,
        filter: 'blur(8px)',
        animation: 'pennyAura 7.5s ease-in-out infinite',
      }}
    >
      <style>{`
        @keyframes pennyAura { 0%,100%{transform:scale(1);opacity:.85} 50%{transform:scale(1.09);opacity:1} }
        @media (prefers-reduced-motion: reduce){ .penny-presence{animation:none!important} }
      `}</style>
    </div>
  );
}

export default PennyPresence;
