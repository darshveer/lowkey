import './SvgDecor.css';

/**
 * Minimal SVG decorative elements for LowKey.
 * Variants:
 *   "hero"     — Large aurora arc + floating dots for hero sections
 *   "section"  — Horizontal wave divider between sections
 *   "ambient"  — Subtle background orbs for general pages
 *   "corner"   — Corner accent for cards / containers
 */
export default function SvgDecor({ variant = 'hero', className = '' }) {
  switch (variant) {
    case 'hero':
      return (
        <div className={`svg-decor svg-decor--hero ${className}`} aria-hidden="true">
          <svg viewBox="0 0 800 200" preserveAspectRatio="none" className="svg-decor__canvas">
            {/* Aurora arc */}
            <defs>
              <linearGradient id="aurora-arc" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#4D7CFF" stopOpacity="0.4" />
                <stop offset="35%" stopColor="#8B5CF6" stopOpacity="0.3" />
                <stop offset="70%" stopColor="#FF007F" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#CCFF00" stopOpacity="0.15" />
              </linearGradient>
              <linearGradient id="line-fade" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0" />
                <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,180 Q200,40 400,100 T800,60"
              fill="none"
              stroke="url(#aurora-arc)"
              strokeWidth="1.5"
              className="svg-decor__arc"
            />
            <path
              d="M0,160 Q300,80 600,120 T800,90"
              fill="none"
              stroke="url(#aurora-arc)"
              strokeWidth="0.8"
              opacity="0.5"
              className="svg-decor__arc svg-decor__arc--delay"
            />
            {/* Floating dots */}
            <circle cx="120" cy="60" r="2" fill="#4D7CFF" opacity="0.6" className="svg-decor__dot" />
            <circle cx="340" cy="130" r="1.5" fill="#8B5CF6" opacity="0.5" className="svg-decor__dot svg-decor__dot--d1" />
            <circle cx="580" cy="50" r="2.5" fill="#FF007F" opacity="0.4" className="svg-decor__dot svg-decor__dot--d2" />
            <circle cx="700" cy="120" r="1.8" fill="#CCFF00" opacity="0.35" className="svg-decor__dot svg-decor__dot--d3" />
            <circle cx="60" cy="140" r="1.2" fill="#00D4FF" opacity="0.45" className="svg-decor__dot svg-decor__dot--d4" />
            <circle cx="460" cy="80" r="1" fill="#E6E6FA" opacity="0.3" className="svg-decor__dot svg-decor__dot--d1" />
          </svg>
        </div>
      );

    case 'section':
      return (
        <div className={`svg-decor svg-decor--section ${className}`} aria-hidden="true">
          <svg viewBox="0 0 1200 40" preserveAspectRatio="none" className="svg-decor__canvas">
            <defs>
              <linearGradient id="wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0" />
                <stop offset="30%" stopColor="#8B5CF6" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#FF007F" stopOpacity="0.15" />
                <stop offset="70%" stopColor="#4D7CFF" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#4D7CFF" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,20 C200,5 400,35 600,20 S1000,10 1200,20"
              fill="none"
              stroke="url(#wave-grad)"
              strokeWidth="1"
            />
          </svg>
        </div>
      );

    case 'ambient':
      return (
        <div className={`svg-decor svg-decor--ambient ${className}`} aria-hidden="true">
          <svg viewBox="0 0 600 600" className="svg-decor__canvas">
            <defs>
              <radialGradient id="orb-purple" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="orb-pink" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FF007F" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#FF007F" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="orb-blue" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#4D7CFF" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#4D7CFF" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="150" cy="150" r="120" fill="url(#orb-purple)" className="svg-decor__orb" />
            <circle cx="450" cy="100" r="80" fill="url(#orb-pink)" className="svg-decor__orb svg-decor__orb--d1" />
            <circle cx="300" cy="400" r="100" fill="url(#orb-blue)" className="svg-decor__orb svg-decor__orb--d2" />
            {/* Scattered micro-dots */}
            <circle cx="80" cy="320" r="1.5" fill="#CCFF00" opacity="0.25" className="svg-decor__dot svg-decor__dot--d2" />
            <circle cx="520" cy="280" r="1" fill="#8B5CF6" opacity="0.3" className="svg-decor__dot svg-decor__dot--d3" />
            <circle cx="200" cy="500" r="1.2" fill="#FF007F" opacity="0.2" className="svg-decor__dot svg-decor__dot--d4" />
          </svg>
        </div>
      );

    case 'grid':
      return (
        <div className={`svg-decor svg-decor--grid ${className}`} aria-hidden="true">
          <svg viewBox="0 0 400 400" className="svg-decor__canvas">
            <defs>
              <pattern id="grid-dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="0.8" fill="rgba(139,92,246,0.15)" />
              </pattern>
            </defs>
            <rect width="400" height="400" fill="url(#grid-dots)" />
          </svg>
        </div>
      );

    default:
      return null;
  }
}
