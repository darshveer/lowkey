import { useId } from 'react';

/**
 * Logo — the LowKey brand mark (aurora squircle + crescent moon + sparkles),
 * matching the favicon. Gradient/mask ids are unique per instance so multiple
 * logos can render on the same page without clashing.
 *
 * @param {Object} props
 * @param {number} [props.size=32]
 * @param {string} [props.className]
 */
export default function Logo({ size = 32, className = '' }) {
  const uid = useId().replace(/:/g, '');
  const aurora = `lk-aurora-${uid}`;
  const moon = `lk-moon-${uid}`;
  const sheen = `lk-sheen-${uid}`;
  const crescent = `lk-crescent-${uid}`;
  const glow = `lk-glow-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      role="img"
      aria-label="LowKey"
    >
      <defs>
        <linearGradient id={aurora} x1="40" y1="60" x2="470" y2="470" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4D7CFF" />
          <stop offset="0.35" stopColor="#8B5CF6" />
          <stop offset="0.7" stopColor="#FF007F" />
          <stop offset="1" stopColor="#CCFF00" />
        </linearGradient>
        <linearGradient id={moon} x1="150" y1="150" x2="380" y2="380" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#E6E6FA" />
          <stop offset="0.5" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#FF007F" />
        </linearGradient>
        <radialGradient id={sheen} cx="0.3" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <mask id={crescent}>
          <rect width="512" height="512" fill="black" />
          <circle cx="248" cy="256" r="116" fill="white" />
          <circle cx="300" cy="226" r="104" fill="black" />
        </mask>
        <filter id={glow} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="16" y="16" width="480" height="480" rx="132" fill="#0B0B14" />
      <rect x="16" y="16" width="480" height="480" rx="132" fill={`url(#${aurora})`} opacity="0.16" />
      <rect x="26" y="26" width="460" height="460" rx="122" fill="none" stroke={`url(#${aurora})`} strokeWidth="10" />
      <rect x="16" y="16" width="480" height="480" rx="132" fill={`url(#${sheen})`} />

      <g mask={`url(#${crescent})`} filter={`url(#${glow})`}>
        <rect x="120" y="128" width="256" height="256" fill={`url(#${moon})`} />
      </g>

      <g filter={`url(#${glow})`}>
        <path d="M348 150 C352 178 360 186 388 190 C360 194 352 202 348 230 C344 202 336 194 308 190 C336 186 344 178 348 150 Z" fill="#CCFF00" />
        <path d="M372 268 C374 284 379 289 395 291 C379 293 374 298 372 314 C370 298 365 293 349 291 C365 289 370 284 372 268 Z" fill="#00D4FF" />
      </g>
    </svg>
  );
}
