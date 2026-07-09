import { createContext } from 'react';

/**
 * Page-transition context. Value: { playTransition(action?) }.
 *
 * `playTransition` runs the split-curtain overlay: two panels sweep in to meet at
 * center behind the LowKey logo, the optional `action` callback fires while the
 * screen is fully covered (navigate / sign in / sign out), then the panels split
 * apart to reveal the new state. Returns a Promise that resolves once `action`
 * has run (i.e. mid-transition), so callers can await the covered moment.
 */
export const TransitionContext = createContext({
  playTransition: async (action) => { action?.(); },
  // Reveal-only: panels start covering the screen then split apart. Used for
  // "arrivals" like returning from Google OAuth, where there's no action to run
  // mid-cover — the app is already there, we just uncover it.
  playReveal: async () => {},
});
