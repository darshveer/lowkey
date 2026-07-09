import { useContext } from 'react';
import { TransitionContext } from '../context/transition-context';

/** Access the global page-transition API: const { playTransition } = useTransition(). */
export function useTransition() {
  return useContext(TransitionContext);
}
