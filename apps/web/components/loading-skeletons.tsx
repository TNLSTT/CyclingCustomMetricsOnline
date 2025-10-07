import { cn } from '../lib/utils';
import { Skeleton } from './ui/skeleton';

export function PageHeaderSkeleton({
  align = 'left',
  descriptionLines = 2,
  eyebrow = false,
  className,
}: {
  align?: 'left' | 'center';
  descriptionLines?: number;
  eyebrow?: boolean;
  className?: string;
}) {
  const isCentered = align === 'center';
  const descriptionCount = Math.max(0, descriptionLines);

  return (
    <div className={cn('space-y-4', isCentered ? 'text-center' : 'text-left', className)}>
      {eyebrow ? (
        <Skeleton
          className={cn(
            'h-5 w-32 rounded-full',
            isCentered ? 'mx-auto' : undefined,
          )}
        />
      ) : null}
      <div className={cn('space-y-3', isCentered ? 'mx-auto max-w-2xl' : 'max-w-3xl')}>
        <Skeleton
          className={cn(
            'h-9 w-3/4 sm:w-2/3',
            isCentered ? 'mx-auto' : undefined,
          )}
        />
        {Array.from({ length: descriptionCount }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn(
              'h-5',
              index === descriptionCount - 1 ? 'w-1/2 sm:w-2/3' : 'w-full',
              isCentered ? 'mx-auto' : undefined,
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function MiniStatSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border bg-card/70 p-5 shadow-sm', className)}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-7 w-16" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  );
}

export function CardSkeleton({
  className,
  headerLines = 2,
  bodyLines = 4,
  bodyHeight,
}: {
  className?: string;
  headerLines?: number;
  bodyLines?: number;
  bodyHeight?: string;
}) {
  const headerCount = Math.max(0, headerLines);
  const bodyCount = Math.max(0, bodyLines);

  return (
    <div className={cn('rounded-2xl border bg-card/70 p-6 shadow-sm', className)}>
      <div className="space-y-4">
        {headerCount > 0 ? (
          <div className="space-y-2">
            {Array.from({ length: headerCount }).map((_, index) => (
              <Skeleton
                key={index}
                className={cn(
                  'h-5',
                  index === 0 ? 'w-1/3' : index === headerCount - 1 ? 'w-1/4' : 'w-2/5',
                )}
              />
            ))}
          </div>
        ) : null}
        {bodyHeight ? (
          <Skeleton className={cn('w-full rounded-xl', bodyHeight)} />
        ) : (
          <div className="space-y-2">
            {Array.from({ length: bodyCount }).map((_, index) => (
              <Skeleton
                key={index}
                className={cn(
                  'h-4',
                  index === bodyCount - 1 ? 'w-2/3' : index % 2 === 0 ? 'w-full' : 'w-5/6',
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChartSkeleton({
  className,
  height = 'h-64',
  headerLines = 2,
}: {
  className?: string;
  height?: string;
  headerLines?: number;
}) {
  return (
    <CardSkeleton className={className} headerLines={headerLines} bodyHeight={height} />
  );
}

export function TableSkeleton({
  className,
  columns = 5,
  rows = 6,
}: {
  className?: string;
  columns?: number;
  rows?: number;
}) {
  const safeColumns = Math.max(1, columns);
  const safeRows = Math.max(1, rows);

  return (
    <div className={cn('overflow-hidden rounded-2xl border bg-card/70 shadow-sm', className)}>
      <div className="border-b border-border/60 bg-muted/50 px-6 py-3">
        <div
          className="grid items-center gap-4"
          style={{ gridTemplateColumns: `repeat(${safeColumns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: safeColumns }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-4/5" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border/60">
        {Array.from({ length: safeRows }).map((_, rowIndex) => (
          <div key={rowIndex} className="px-6 py-4">
            <div
              className="grid items-center gap-4"
              style={{ gridTemplateColumns: `repeat(${safeColumns}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: safeColumns }).map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  className={cn('h-4', colIndex === safeColumns - 1 ? 'w-1/2' : 'w-4/5')}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton({
  className,
  fieldCount = 4,
  includeAvatar = false,
}: {
  className?: string;
  fieldCount?: number;
  includeAvatar?: boolean;
}) {
  const safeFields = Math.max(0, fieldCount);

  return (
    <div className={cn('rounded-2xl border bg-card/70 p-6 shadow-sm', className)}>
      <div className="space-y-6">
        {includeAvatar ? (
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ) : null}
        <div className="space-y-5">
          {Array.from({ length: safeFields }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </div>
  );
}
