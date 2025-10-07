'use client';

import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type MouseEventHandler,
  type FocusEventHandler,
  type ReactNode,
} from 'react';

import { cn } from '../../lib/utils';

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function Tooltip({ content, children, className, side = 'top' }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  if (!isValidElement(children)) {
    throw new Error('Tooltip expects a single React element child.');
  }

  const childProps = children.props as Record<string, unknown>;

  const offsets: Record<'top' | 'right' | 'bottom' | 'left', string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 -translate-y-2 origin-bottom',
    right: 'left-full top-1/2 translate-x-2 -translate-y-1/2 origin-left',
    bottom: 'top-full left-1/2 -translate-x-1/2 translate-y-2 origin-top',
    left: 'right-full top-1/2 -translate-x-2 -translate-y-1/2 origin-right',
  } as const;

  const triggerProps = {
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
      (childProps.onMouseEnter as MouseEventHandler<HTMLElement> | undefined)?.(event);
      setOpen(true);
    },
    onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
      (childProps.onMouseLeave as MouseEventHandler<HTMLElement> | undefined)?.(event);
      setOpen(false);
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      (childProps.onFocus as FocusEventHandler<HTMLElement> | undefined)?.(event);
      setOpen(true);
    },
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      (childProps.onBlur as FocusEventHandler<HTMLElement> | undefined)?.(event);
      setOpen(false);
    },
    'aria-describedby': open ? tooltipId : undefined,
  } satisfies Record<string, unknown>;

  return (
    <span className="relative inline-flex">
      {cloneElement(children, triggerProps)}
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 min-w-[160px] rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-lg transition-all duration-150',
          offsets[side],
          open ? 'opacity-100 scale-100' : 'pointer-events-none scale-95 opacity-0',
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
