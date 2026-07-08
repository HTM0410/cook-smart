import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { EyebrowTag } from './EyebrowTag';

export interface SectionHeadingProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
  as?: 'h1' | 'h2' | 'h3';
  size?: 'lg' | 'xl' | '2xl';
}

const titleSizeMap = {
  lg: 'text-5xl md:text-6xl lg:text-7xl',
  xl: 'text-6xl md:text-7xl lg:text-8xl',
  '2xl': 'text-7xl md:text-8xl lg:text-9xl',
};

export const SectionHeading = ({
  eyebrow,
  title,
  description,
  align = 'left',
  as = 'h2',
  size = 'xl',
  className,
  ...props
}: SectionHeadingProps) => {
  const Tag = as;
  return (
    <div
      className={cn(
        'flex flex-col gap-5',
        align === 'center' && 'items-center text-center',
        align === 'left' && 'items-start text-left',
        className
      )}
      {...props}
    >
      {eyebrow && typeof eyebrow === 'string' ? (
        <EyebrowTag>{eyebrow}</EyebrowTag>
      ) : (
        eyebrow
      )}
      <Tag
        className={cn(
          'text-display text-ink-primary dark:text-ink-50 text-balance',
          titleSizeMap[size]
        )}
      >
        {title}
      </Tag>
      {description && (
        <p
          className={cn(
            'text-ink-secondary dark:text-ink-200 text-lg md:text-xl max-w-editorial text-pretty leading-relaxed'
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
};

SectionHeading.displayName = 'SectionHeading';
