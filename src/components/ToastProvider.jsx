import { useState, useCallback, useRef } from 'react';
import { ToastContext } from '../context/toast-context';
import './ToastProvider.css';

let counter = 0;

/**
 * Global toast provider. Wrap the app once; anywhere below, call:
 *   const { show } = useToast();
 *   show('Saved!', 'success');
 */
export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message, type = 'info', duration = 3000) => {
      const id = ++counter;
      setToasts((list) => [...list, { id, message, type }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="toast-stack" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item toast-item--${t.type}`} role="status">
            <span className="toast-item__icon" aria-hidden="true">
              {t.type === 'success' ? '✓' : t.type === 'error' ? '⚠' : '✦'}
            </span>
            <span className="toast-item__msg">{t.message}</span>
            <button
              className="toast-item__close"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
