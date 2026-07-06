import { createContext } from 'react';

/**
 * Toast context. Value: { show(message, type?, duration?), dismiss(id) }.
 * `type` is one of 'success' | 'error' | 'info'.
 */
export const ToastContext = createContext({
  show: () => {},
  dismiss: () => {},
});
