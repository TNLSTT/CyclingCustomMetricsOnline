import * as React from 'react';

import { cn } from '../../lib/utils';

const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative overflow-hidden rounded-md bg-muted/70',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer',
        "before:bg-gradient-to-r before:from-transparent before:via-foreground/10 before:to-transparent before:content-['']",
        className,
      )}
      {...props}
    />
  ),
);
Skeleton.displayName = 'Skeleton';

export { Skeleton };
