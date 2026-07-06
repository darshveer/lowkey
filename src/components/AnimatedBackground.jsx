import './AnimatedBackground.css';

/**
 * AnimatedBackground — a living, layered backdrop that sits behind all content:
 *   - three large blurred gradient orbs drifting on independent paths
 *   - a slow-panning dotted grid for subtle parallax texture
 *   - a faint noise/grain vignette
 *
 * Purely decorative and non-interactive. Motion is paused for users who
 * prefer reduced motion (handled in CSS).
 */
export default function AnimatedBackground() {
  return (
    <div className="animated-bg" aria-hidden="true">
      <div className="animated-bg__grid" />
      <div className="animated-bg__orb animated-bg__orb--purple" />
      <div className="animated-bg__orb animated-bg__orb--blue" />
      <div className="animated-bg__orb animated-bg__orb--pink" />
      <div className="animated-bg__orb animated-bg__orb--lime" />
      <div className="animated-bg__vignette" />
    </div>
  );
}
