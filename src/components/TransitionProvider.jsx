import { useState, useCallback, useRef } from 'react';
import { TransitionContext } from '../context/transition-context';
import Logo from './Logo';
import './TransitionProvider.css';

// Timings (kept in sync with the keyframe durations in TransitionProvider.css).
const COVER_MS = 560;   // panels sweep in + logo appears
const HOLD_MS = 180;    // fully-covered beat where `action` runs
const REVEAL_MS = 560;  // panels split apart

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Global split-curtain transition provider. Wrap the app once; anywhere below:
 *   const { playTransition } = useTransition();
 *   await playTransition(() => navigate('/'));   // runs the nav while covered
 *
 * Honors prefers-reduced-motion by running `action` immediately with no overlay.
 */
export default function TransitionProvider({ children }) {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'cover' | 'reveal'
  const busy = useRef(false);
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const playTransition = useCallback((action) => {
    // No overlap and no motion when the user opts out — just run the action.
    // Promise.resolve adopts an async action so callers can still await its result.
    if (busy.current || prefersReducedMotion()) {
      return Promise.resolve(action?.());
    }
    busy.current = true;
    setPhase('cover');

    return new Promise((resolve) => {
      // Run the caller's action at the fully-covered moment. Awaited, so the
      // curtain masks async work (logout, account deletion) until it completes.
      timers.current.push(setTimeout(async () => {
        try { await action?.(); } catch (e) { console.warn('transition action failed:', e); }
        resolve();
        setPhase('reveal');
      }, COVER_MS + HOLD_MS));

      // Tear the overlay down after the reveal completes.
      timers.current.push(setTimeout(() => {
        setPhase('idle');
        busy.current = false;
        clearTimers();
      }, COVER_MS + HOLD_MS + REVEAL_MS));
    });
  }, []);

  // Reveal-only: mount the curtain already covering the screen, then split apart.
  // (The '.curtain--reveal' CSS starts the panels at translateY(0) — covered — and
  // animates them out, so rendering straight into the reveal phase is the uncover.)
  const playReveal = useCallback(() => {
    if (busy.current || prefersReducedMotion()) return Promise.resolve();
    busy.current = true;
    setPhase('reveal');
    return new Promise((resolve) => {
      timers.current.push(setTimeout(() => {
        setPhase('idle');
        busy.current = false;
        clearTimers();
        resolve();
      }, REVEAL_MS));
    });
  }, []);

  return (
    <TransitionContext.Provider value={{ playTransition, playReveal }}>
      {children}
      {phase !== 'idle' && (
        <div className={`curtain curtain--${phase}`} aria-hidden="true">
          <div className="curtain__panel curtain__panel--top" />
          <div className="curtain__panel curtain__panel--bottom" />
          <div className="curtain__logo">
            <Logo size={92} />
          </div>
        </div>
      )}
    </TransitionContext.Provider>
  );
}
