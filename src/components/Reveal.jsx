import { useRef, useEffect, useState } from 'react';
import './Reveal.css';

/**
 * Reveal — animates its children into view on scroll via IntersectionObserver.
 * Renders as a plain element (default <div>) so it drops into existing layouts.
 *
 * @param {Object} props
 * @param {React.ElementType} [props.as='div'] - Element/tag to render
 * @param {'up'|'left'|'right'|'zoom'} [props.variant='up'] - Entry direction
 * @param {number} [props.delay=0] - Stagger delay in ms
 * @param {boolean} [props.once=true] - Reveal only the first time it enters
 * @param {string} [props.className]
 */
export default function Reveal({
  as: Tag = 'div',
  variant = 'up',
  delay = 0,
  once = true,
  className = '',
  children,
  ...rest
}) {
  const ref = useRef(null);
  // Reduced-motion / unsupported environments start visible (no animation).
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    return reduced || typeof IntersectionObserver === 'undefined';
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Already shown at mount (reduced motion / no IO support) — nothing to observe.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  const { style: restStyle, ...restProps } = rest;
  return (
    <Tag
      ref={ref}
      {...restProps}
      className={`reveal reveal--${variant} ${visible ? 'reveal--visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms`, ...(restStyle || {}) }}
    >
      {children}
    </Tag>
  );
}
