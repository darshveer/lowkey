import { useEffect, useRef } from 'react';
import './TurnstileWidget.css';

// Load Cloudflare's Turnstile script exactly once, shared across all instances.
let scriptPromise = null;
function loadTurnstileScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.turnstile) return resolve();
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Turnstile script failed to load'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * TurnstileWidget — renders a Cloudflare Turnstile CAPTCHA and reports its token.
 *
 * Renders nothing when `siteKey` is falsy, so the app's local-only mode (no
 * VITE_TURNSTILE_SITE_KEY) stays friction-free. The token is single-use; to force
 * a fresh challenge after a failed auth attempt, remount via a changing `key`.
 *
 * @param {Object} props
 * @param {string} props.siteKey    - Turnstile site key (public).
 * @param {(token: string|null) => void} props.onVerify - token on success, null on expiry/error.
 * @param {'dark'|'light'|'auto'} [props.theme='dark']
 */
export default function TurnstileWidget({ siteKey, onVerify, theme = 'dark' }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onVerifyRef = useRef(onVerify);

  // Keep the latest callback without re-rendering the widget.
  useEffect(() => { onVerifyRef.current = onVerify; }, [onVerify]);

  useEffect(() => {
    if (!siteKey) return undefined;
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          callback: (token) => onVerifyRef.current?.(token),
          'expired-callback': () => onVerifyRef.current?.(null),
          'error-callback': () => onVerifyRef.current?.(null),
        });
      })
      .catch((e) => console.warn('[Turnstile]', e.message));

    return () => {
      cancelled = true;
      try {
        if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      } catch { /* ignore */ }
      widgetIdRef.current = null;
    };
  }, [siteKey, theme]);

  if (!siteKey) return null;
  return <div className="turnstile-widget" ref={containerRef} />;
}
