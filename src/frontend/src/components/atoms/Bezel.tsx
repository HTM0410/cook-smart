import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../../utils/cn';

export interface BezelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  innerClassName?: string;
  as?: 'div' | 'article' | 'section';
}

/**
 * Double-Bezel (Doppelrand) container.
 * Outer shell with hairline ring + inner core with inset highlight.
 */
export const Bezel = forwardRef<HTMLDivElement, BezelProps>(
  ({ children, className, innerClassName, as: As = 'div', ...props }, ref) => {
    return (
      <As
        ref={ref}
        className={cn(
          'card-bezel',
          className
        )}
        {...props}
      >
        <div className={cn('card-bezel-inner', innerClassName)}>
          {children}
        </div>
      </As>
    );
  }
);

Bezel.displayName = 'Bezel';

export default Bezel;
