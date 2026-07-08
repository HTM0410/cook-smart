import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface FloatingNavPillProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Floating glass pill wrapper for navigation.
 * Detached from the top edge with generous margin and rounded-full radius.
 */
export const FloatingNavPill = ({ children, className, ...props }: FloatingNavPillProps) => {
  return (
    <div
      className={cn(
        'floating-nav-pill w-max max-w-[calc(100vw-2rem)] px-2 py-2',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

FloatingNavPill.displayName = 'FloatingNavPill';
