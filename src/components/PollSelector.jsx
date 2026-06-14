import './PollSelector.css';

/**
 * PollSelector — Horizontal pill selector for polls
 *
 * @param {Object} props
 * @param {string} [props.label] - Label above the selector
 * @param {{ value: string, label: string, emoji?: string }[]} props.options
 * @param {string} props.value - Currently selected value
 * @param {(value: string) => void} props.onChange
 * @param {'purple'|'pink'|'lime'} [props.accentColor='purple']
 */
export default function PollSelector({
  label,
  options = [],
  value,
  onChange,
  accentColor = 'purple',
}) {
  return (
    <div className="poll-selector">
      {label && <span className="poll-selector__label">{label}</span>}
      <div className="poll-selector__options" role="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const isSelected = opt.value === value;
          const classes = [
            'poll-selector__pill',
            `poll-selector__pill--${accentColor}`,
            isSelected && 'poll-selector__pill--selected',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={opt.value}
              className={classes}
              onClick={() => onChange(opt.value)}
              role="radio"
              aria-checked={isSelected}
              type="button"
            >
              {opt.emoji && <span className="poll-selector__emoji" aria-hidden="true">{opt.emoji}</span>}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
