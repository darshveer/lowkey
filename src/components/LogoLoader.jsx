import Logo from './Logo';
import './LogoLoader.css';

/**
 * LogoLoader — the brand loading indicator: the LowKey logo pulsing inside an
 * orbiting gradient ring. Use anywhere content is loading. Honors reduced motion.
 *
 * @param {Object} props
 * @param {number} [props.size=48] - logo size in px (the ring scales around it)
 * @param {string} [props.label='Loading…'] - accessible status label
 * @param {string} [props.className]
 */
export default function LogoLoader({ size = 48, label = 'Loading…', className = '' }) {
  const ring = Math.round(size * 1.7);
  return (
    <div className={`logo-loader ${className}`} role="status" aria-live="polite">
      <div className="logo-loader__orbit" style={{ width: ring, height: ring }}>
        <span className="logo-loader__ring" />
        <Logo size={size} className="logo-loader__mark" />
      </div>
      {label && <span className="logo-loader__label">{label}</span>}
    </div>
  );
}
