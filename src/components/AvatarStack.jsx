import React from 'react';
import { getInitials, getAvatarGradient } from '../utils/helpers.js';
import './AvatarStack.css';

/**
 * AvatarStack — Overlapping circular avatars with initials
 *
 * @param {Object} props
 * @param {string[]} props.names - Array of names to display
 * @param {number} [props.maxDisplay=5] - Max avatars before overflow
 * @param {'sm'|'md'} [props.size='md'] - Avatar size
 */
export default function AvatarStack({
  names = [],
  maxDisplay = 5,
  size = 'md',
}) {
  const visible = names.slice(0, maxDisplay);
  const overflow = names.length - maxDisplay;

  return (
    <div className={`avatar-stack avatar-stack--${size}`} aria-label={`${names.length} people`}>
      <div className="avatar-stack__list">
        {visible.map((name, i) => (
          <div
            key={`${name}-${i}`}
            className="avatar-stack__circle"
            style={{ background: getAvatarGradient(name), zIndex: maxDisplay - i }}
            title={name}
            aria-label={name}
          >
            {getInitials(name)}
          </div>
        ))}
        {overflow > 0 && (
          <div className="avatar-stack__overflow" style={{ zIndex: 0 }} title={`${overflow} more`}>
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
