import { type HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export interface SkeletonEditorialProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'title' | 'card' | 'image' | 'avatar';
}

export const SkeletonEditorial = ({
  variant = 'text',
  className,
  ...props
}: SkeletonEditorialProps) => {
  return (
    <div
      className={cn(
        'skeleton',
        variant === 'text' && 'h-4 rounded',
        variant === 'title' && 'h-7 rounded-lg',
        variant === 'card' && 'rounded-squircle',
        variant === 'image' && 'rounded-squircle aspect-[4/3]',
        variant === 'avatar' && 'rounded-full aspect-square',
        className
      )}
      {...props}
    />
  );
};

SkeletonEditorial.displayName = 'SkeletonEditorial';
