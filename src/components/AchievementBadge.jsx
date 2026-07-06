import './AchievementBadge.css';

/* Custom SVG glyphs, one per achievement key (viewBox 0 0 24 24). */
const ICONS = {
  first_party: (
    <>
      <path d="M3 21l6-14 9 9-15 5z" fill="currentColor" opacity="0.9" />
      <path d="M9 7l9 9" stroke="#0B0B14" strokeWidth="1.2" opacity="0.25" />
      <circle cx="16" cy="5" r="1.3" fill="currentColor" />
      <circle cx="20" cy="9" r="1" fill="currentColor" />
      <circle cx="19" cy="4" r="0.8" fill="currentColor" />
    </>
  ),
  seasoned_host: (
    <path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8z" fill="currentColor" />
  ),
  crowd_puller: (
    <>
      <circle cx="8" cy="8" r="3" fill="currentColor" />
      <circle cx="16" cy="8" r="3" fill="currentColor" opacity="0.85" />
      <path d="M3 20c0-3 2.5-5 5-5s5 2 5 5" fill="currentColor" />
      <path d="M11 20c0-3 2.5-5 5-5s5 2 5 5" fill="currentColor" opacity="0.85" />
    </>
  ),
  sold_out: (
    <path d="M12 2c1 4-2 5-2 8a4 4 0 108 0c0-1-.4-2-1-3 2 1 4 3 4 6a7 7 0 11-14 0c0-4 3-7 5-11z" fill="currentColor" />
  ),
  kitty_master: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" fill="currentColor" />
      <path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6" fill="currentColor" opacity="0.6" />
      <path d="M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" fill="currentColor" opacity="0.85" />
    </>
  ),
  night_owl: (
    <path d="M20 14.5A8 8 0 019.5 4 7 7 0 1020 14.5z" fill="currentColor" />
  ),
  shutterbug: (
    <>
      <rect x="3" y="7" width="18" height="12" rx="2.5" fill="currentColor" />
      <path d="M8 7l1.5-2h5L16 7" fill="currentColor" />
      <circle cx="12" cy="13" r="3.2" fill="#0B0B14" opacity="0.55" />
      <circle cx="12" cy="13" r="1.6" fill="currentColor" />
    </>
  ),
  socialite: (
    <path d="M12 21C6 16.5 3 13.5 3 9.5A4.5 4.5 0 0112 7a4.5 4.5 0 019 2.5c0 4-3 7-9 11.5z" fill="currentColor" />
  ),
  verified: (
    <>
      <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" fill="currentColor" />
      <path d="M8.5 12l2.5 2.5L16 9" stroke="#0B0B14" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.65" />
    </>
  ),
};

const FALLBACK = <circle cx="12" cy="12" r="8" fill="currentColor" />;

/**
 * AchievementBadge — a hexagon medal with a custom SVG glyph.
 *
 * @param {Object} props
 * @param {Object} props.achievement - { key, name, desc, tier }
 * @param {boolean} props.earned
 */
export default function AchievementBadge({ achievement, earned = false }) {
  const { key, name, desc, tier } = achievement;
  return (
    <div
      className={`ach-badge ach-badge--${tier} ${earned ? 'is-earned' : 'is-locked'}`}
      title={`${name} — ${desc}`}
    >
      <div className="ach-badge__medal">
        <svg viewBox="0 0 24 24" className="ach-badge__icon" aria-hidden="true">
          {ICONS[key] || FALLBACK}
        </svg>
        {!earned && <span className="ach-badge__lock" aria-hidden="true">🔒</span>}
      </div>
      <span className="ach-badge__name">{name}</span>
      <span className="ach-badge__desc">{desc}</span>
    </div>
  );
}
