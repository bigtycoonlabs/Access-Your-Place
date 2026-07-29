interface AypLogoProps {
  className?: string;
  markSize?: number; // px height of the mark
  showWordmark?: boolean;
}

/**
 * Access Your Place — flagship mark.
 * The "YP" signature that the whole family carries (Access YP Flow, Access YP Labs)
 * was born here: Your Place. So the flagship owns it — a gold YP monogram on the
 * family's navy foundation, with a living gold glow. Same bloodline as its siblings
 * (dark navy + one signature accent + glow), but gold, and the origin.
 * Wordmark is real text for accessibility.
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
          <linearGradient id="aypGold" x1="0" y1="4" x2="40" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#f0d9b5" />
            <stop offset="0.55" stopColor="#d4a574" />
            <stop offset="1" stopColor="#b8895a" />
          </linearGradient>
          <linearGradient id="aypNavy" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#16223d" />
            <stop offset="1" stopColor="#0a0f1a" />
          </linearGradient>
          <radialGradient id="aypGlow" cx="0.5" cy="0.5" r="0.55">
            <stop offset="0" stopColor="#d4a574" stopOpacity="0.5" />
            <stop offset="1" stopColor="#d4a574" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="20" cy="20" r="19" fill="url(#aypGlow)" />
        {/* navy tile — the family foundation */}
        <rect
          x="4"
          y="4"
          width="32"
          height="32"
          rx="9"
          fill="url(#aypNavy)"
          stroke="#d4a574"
          strokeOpacity="0.5"
          strokeWidth="1.25"
        />
        {/* YP monogram in gold — the family signature, born here */}
        <text
          x="20"
          y="20.5"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
          fontSize="16.5"
          fontWeight="800"
          letterSpacing="-0.5"
          fill="url(#aypGold)"
        >
          YP
        </text>
      </svg>
      {showWordmark && (
        <span className="text-xl font-bold leading-none tracking-tight">
          <span className="text-white">Access </span>
          <span className="text-[#d4a574]">Your Place</span>
        </span>
      )}
    </span>
  );
}
