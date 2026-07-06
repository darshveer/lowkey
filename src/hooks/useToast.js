import { useContext } from 'react';
import { ToastContext } from '../context/toast-context';

/** Access the global toast API: const { show, dismiss } = useToast(). */
export function useToast() {
  return useContext(ToastContext);
}
