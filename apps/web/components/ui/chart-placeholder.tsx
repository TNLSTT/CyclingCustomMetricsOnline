import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

interface ChartPlaceholderProps {
  message: string;
  helperText?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function ChartPlaceholder({
  message,
  helperText,
  icon,
  action,
  className,
}: ChartPlaceholderProps) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 px-6 text-center text-sm text-muted-foreground',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {icon}
      <p className="font-medium text-foreground/90">{message}</p>
      {helperText ? <p className="text-xs text-muted-foreground/80">{helperText}</p> : null}
      {action}
    </div>
  );
}
