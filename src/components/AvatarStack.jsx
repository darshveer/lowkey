import { getInitials, getAvatarGradient } from '../utils/helpers.js';
import './AvatarStack.css';

/**
 * AvatarStack — Overlapping circular avatars with initials
 *
 * @param {Object} props
 * @param {string[]} [props.names] - Array of names to display
 * @param {{ name: string, userId?: string }[]} [props.people] - Richer alternative
 *   to names; avatars with a userId become clickable when onSelect is set
 * @param {number} [props.maxDisplay=5] - Max avatars before overflow
 * @param {'sm'|'md'} [props.size='md'] - Avatar size
 * @param {(person: { name: string, userId: string }) => void} [props.onSelect]
 */
export default function AvatarStack({
  names = [],
  people = null,
  maxDisplay = 5,
  size = 'md',
  onSelect,
}) {
  const list = people || names.map((name) => ({ name }));
  const visible = list.slice(0, maxDisplay);
  const overflow = list.length - maxDisplay;

  return (
    <div className={`avatar-stack avatar-stack--${size}`} aria-label={`${list.length} people`}>
      <div className="avatar-stack__list">
        {visible.map((p, i) => {
          const clickable = !!(p.userId && onSelect);
          const Tag = clickable ? 'button' : 'div';
          return (
            <Tag
              key={`${p.name}-${i}`}
              type={clickable ? 'button' : undefined}
              className={`avatar-stack__circle${clickable ? ' avatar-stack__circle--clickable' : ''}`}
              style={{ background: getAvatarGradient(p.name), zIndex: maxDisplay - i }}
              title={clickable ? `View ${p.name}'s profile` : p.name}
              aria-label={clickable ? `View ${p.name}'s profile` : p.name}
              onClick={clickable ? () => onSelect(p) : undefined}
            >
              {getInitials(p.name)}
            </Tag>
          );
        })}
        {overflow > 0 && (
          <div className="avatar-stack__overflow" style={{ zIndex: 0 }} title={`${overflow} more`}>
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
