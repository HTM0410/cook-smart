import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

export interface EyebrowTagProps extends HTMLAttributes<HTMLSpanElement> {
  dot?: boolean;
  dotColor?: string;
}

export const EyebrowTag = forwardRef<HTMLSpanElement, EyebrowTagProps>(
  ({ children, className, dot = true, dotColor = 'bg-[#ff4f00]', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'eyebrow-tag',
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              dotColor
            )}
            aria-hidden
          />
        )}
        {children}
      </span>
    );
  }
);

EyebrowTag.displayName = 'EyebrowTag';
