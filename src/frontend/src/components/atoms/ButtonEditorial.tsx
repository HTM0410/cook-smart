import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../../utils/cn';

export type ButtonEditorialVariant = 'primary' | 'ghost' | 'inverse';
export type ButtonEditorialSize = 'sm' | 'md' | 'lg';

export interface ButtonEditorialProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonEditorialVariant;
  size?: ButtonEditorialSize;
  trailingIcon?: ReactNode;
  leadingIcon?: ReactNode;
  iconOnly?: boolean;
}

const sizeMap: Record<ButtonEditorialSize, string> = {
  sm: 'pl-5 pr-1.5 py-1.5 text-sm',
  md: 'pl-7 pr-2 py-2 text-base',
  lg: 'pl-8 pr-2.5 py-2.5 text-lg',
};

const iconSizeMap: Record<ButtonEditorialSize, string> = {
  sm: 'w-7 h-7',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

const iconSizeIcon: Record<ButtonEditorialSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

export const ButtonEditorial = forwardRef<HTMLButtonElement, ButtonEditorialProps>(
  (
    {
      children,
      className,
      variant = 'primary',
      size = 'md',
      trailingIcon,
      leadingIcon,
      iconOnly,
      ...props
    },
    ref
  ) => {
    const baseClass = {
      primary: 'btn-editorial-primary',
      ghost: 'btn-editorial-ghost',
      inverse: 'btn-editorial-inverse',
    }[variant];

    const defaultIcon =
      variant === 'inverse' ? (
        <svg
          width={iconSizeIcon[size]}
          height={iconSizeIcon[size]}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M7 17L17 7" />
          <path d="M8 7h9v9" />
        </svg>
      ) : (
        <svg
          width={iconSizeIcon[size]}
          height={iconSizeIcon[size]}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12h14" />
          <path d="M13 5l7 7-7 7" />
        </svg>
      );

    return (
      <button
        ref={ref}
        className={cn(
          'group',
          baseClass,
          sizeMap[size],
          iconOnly && 'p-0 aspect-square',
          className
        )}
        {...props}
      >
        {leadingIcon && <span className="flex-shrink-0">{leadingIcon}</span>}
        {!iconOnly && <span className="whitespace-nowrap">{children}</span>}
        <span
          className={cn(
            'btn-icon-wrap flex-shrink-0',
            iconSizeMap[size]
          )}
        >
          {trailingIcon ?? defaultIcon}
        </span>
      </button>
    );
  }
);

ButtonEditorial.displayName = 'ButtonEditorial';
