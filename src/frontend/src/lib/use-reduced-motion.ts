/**
 * useReducedMotion-safe wrapper hook for Framer Motion.
 * Returns false during SSR.
 */
import { useReducedMotion as useFramerReducedMotion } from 'framer-motion';

export function useReducedMotion(): boolean {
  const reduced = useFramerReducedMotion();
  return reduced ?? false;
}
