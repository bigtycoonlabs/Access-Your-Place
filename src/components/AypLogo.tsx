interface AypLogoProps {
  className?: string;
  markSize?: number; // px height of the mark
  showWordmark?: boolean;
}

/**
 * Access Your Place — flagship mark.
 * A gold doorway with a keyhole (you *access* your *place*) over a soft glow.
 * Same family language as Flow and Labs — dark foundation, one signature accent,
 * a living glow — but gold, and its own. Wordmark is real text for accessibility.
 */
export default function AypLogo({ className = '', markSize = 34, showWordmark = true }: AypLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="aypGold" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#f0d9b5" />
            <stop offset="0.5" stopColor="#d4a574" />
            <stop offset="1" stopColor="#b8895a" />
          </linearGradient>
          <radialGradient id="aypGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#d4a574" stopOpacity="0.45" />
            <stop offset="1" stopColor="#d4a574" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="20" cy="20" r="19" fill="url(#aypGlow)" />
        {/* doorway / portal */}
        <path
          d="M11 33 L11 19 A9 9 0 0 1 29 19 L29 33"
          stroke="url(#aypGold)"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* threshold */}
        <path d="M8 33 L32 33" stroke="url(#aypGold)" strokeWidth="2.75" strokeLinecap="round" />
        {/* keyhole — the key to access */}
        <circle cx="20" cy="19" r="2.4" fill="url(#aypGold)" />
        <path d="M20 21 L20 25" stroke="url(#aypGold)" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      {showWordmark && (
        <span className="text-xl font-bold leading-none tracking-tight">
          <span className="text-white">Access Your </span>
          <span className="text-[#d4a574]">Place</span>
        </span>
      )}
    </span>
  );
}
