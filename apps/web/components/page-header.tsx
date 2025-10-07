import * as React from 'react';

import { cn } from '../lib/utils';

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  align = 'left',
  className,
}: PageHeaderProps) {
  const isCentered = align === 'center';

  return (
    <div
      className={cn(
        'space-y-4',
        isCentered ? 'text-center' : 'text-left',
        className,
      )}
    >
      {eyebrow ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary">
          {eyebrow}
        </span>
      ) : null}
      <div className={cn('space-y-3', isCentered ? 'mx-auto max-w-2xl' : 'max-w-3xl')}>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="text-base text-muted-foreground sm:text-lg">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
