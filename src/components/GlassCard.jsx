import './GlassCard.css';

/**
 * GlassCard — Reusable glassmorphism card wrapper
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className] - Additional class names
 * @param {Function} [props.onClick] - Click handler
 * @param {'default'|'strong'|'gradient'} [props.variant='default'] - Visual variant
 * @param {'sm'|'md'|'lg'} [props.padding='md'] - Inner padding size
 * @param {boolean} [props.animate=false] - Animate entrance
 */
export default function GlassCard({
  children,
  className = '',
  onClick,
  variant = 'default',
  padding = 'md',
  animate = false,
}) {
  const classes = [
    'glass-card',
    variant !== 'default' && `glass-card--${variant}`,
    `glass-card--pad-${padding}`,
    onClick && 'glass-card--clickable',
    animate && 'glass-card--animate',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      {children}
    </div>
  );
}
