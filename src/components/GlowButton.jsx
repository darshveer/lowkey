import React from 'react';
import './GlowButton.css';

/**
 * GlowButton — Primary CTA with animated neon glow
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {Function} [props.onClick]
 * @param {'purple'|'pink'|'lime'|'blue'} [props.variant='purple']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.fullWidth=false]
 * @param {boolean} [props.disabled=false]
 * @param {boolean} [props.loading=false]
 */
export default function GlowButton({
  children,
  onClick,
  variant = 'purple',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
}) {
  const classes = [
    'glow-button',
    `glow-button--${variant}`,
    `glow-button--${size}`,
    fullWidth && 'glow-button--full',
    disabled && 'glow-button--disabled',
    loading && 'glow-button--loading',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      type="button"
    >
      {loading && <span className="glow-button__spinner" aria-hidden="true" />}
      <span className="glow-button__label">{children}</span>
    </button>
  );
}
