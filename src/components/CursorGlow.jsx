import { useEffect, useRef } from 'react';
import './CursorGlow.css';

/**
 * CursorGlow — a soft neon light that trails the pointer, plus a small
 * precise ring. Adds depth/interactivity without hurting readability.
 *
 * - Pointer position is written straight to the DOM via rAF (no React state,
 *   so it never triggers re-renders).
 * - Auto-disabled on touch devices and when the user prefers reduced motion.
 */
export default function CursorGlow() {
  const glowRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;

    const glow = glowRef.current;
    const ring = ringRef.current;
    if (!glow || !ring) return;

    // Target (actual cursor) vs. rendered (eased) positions
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let gx = tx;
    let gy = ty;
    let raf = 0;
    let visible = false;

    const onMove = (e) => {
      tx = e.clientX;
      ty = e.clientY;
      // The ring tracks the cursor exactly (crisp), the glow eases behind it.
      ring.style.transform = `translate(${tx}px, ${ty}px)`;
      if (!visible) {
        visible = true;
        glow.style.opacity = '1';
        ring.style.opacity = '1';
      }
    };

    const onLeave = () => {
      visible = false;
      glow.style.opacity = '0';
      ring.style.opacity = '0';
    };

    // Grow the ring over interactive elements for a tactile feel
    const onOver = (e) => {
      const interactive = e.target.closest(
        'a, button, input, textarea, select, [role="button"], .pressable'
      );
      ring.classList.toggle('cursor-glow__ring--active', !!interactive);
    };

    const tick = () => {
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      glow.style.transform = `translate(${gx}px, ${gy}px)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerover', onOver, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={glowRef} className="cursor-glow" aria-hidden="true" />
      <div ref={ringRef} className="cursor-glow__ring" aria-hidden="true" />
    </>
  );
}
