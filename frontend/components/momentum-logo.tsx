export function MomentumIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ml-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0e0920"/>
          <stop offset="100%" stopColor="#08051a"/>
        </linearGradient>
        <linearGradient id="ml-stroke" x1="18" y1="78" x2="82" y2="13" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5b21b6"/>
          <stop offset="50%" stopColor="#7c3aed"/>
          <stop offset="100%" stopColor="#e879f9"/>
        </linearGradient>
        <radialGradient id="ml-ambient" cx="78%" cy="16%" r="55%">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.28"/>
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0"/>
        </radialGradient>
        <filter id="ml-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="ml-line-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width="100" height="100" rx="24" fill="url(#ml-bg)"/>

      {/* Ambient glow top-right (where the peak is) */}
      <rect width="100" height="100" rx="24" fill="url(#ml-ambient)"/>

      {/* Subtle border */}
      <rect width="100" height="100" rx="24" stroke="rgba(139,92,246,0.2)" strokeWidth="1.5" fill="none"/>

      {/* M strokes — left peak lower (y=30), right peak higher (y=13) = upward momentum */}
      <path
        d="M18 78 L18 30 L50 57 L82 13 L82 78"
        stroke="url(#ml-stroke)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#ml-line-glow)"
      />

      {/* Glow halo behind apex dot */}
      <circle cx="82" cy="13" r="14" fill="#d946ef" opacity="0.15" filter="url(#ml-glow)"/>

      {/* Apex dot — the "now" point / current high */}
      <circle cx="82" cy="13" r="6" fill="#e879f9"/>
      <circle cx="82" cy="13" r="3" fill="white" opacity="0.95"/>
    </svg>
  );
}

export function MomentumWordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={className}
      style={{
        fontWeight: 800,
        letterSpacing: '-0.03em',
        background: 'linear-gradient(135deg, #ffffff 40%, #c4b5fd 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      MOMENTUM
    </span>
  );
}
