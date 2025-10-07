// @ts-nocheck
'use client';

import { createContext, useContext, useEffect, useId, useMemo, useState } from 'react';
import { motion } from './framer-motion';
import { cn } from './utils';

type ToastVariant = 'default' | 'success' | 'error';

type ToastRecord = {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
  createdAt: number;
  duration: number;
};

type ToastListener = (records: ToastRecord[]) => void;

const listeners = new Set<ToastListener>();
let queue: ToastRecord[] = [];

function emit() {
  const snapshot = [...queue];
  listeners.forEach((listener) => listener(snapshot));
}

function enqueue(record: ToastRecord) {
  queue = [...queue, record];
  emit();
  const timeout = setTimeout(() => {
    queue = queue.filter((item) => item.id !== record.id);
    emit();
  }, record.duration);
  return () => clearTimeout(timeout);
}

type ToastInput = string | { title?: string; description?: string; duration?: number };

type ToastApi = {
  (input: ToastInput): void;
  success(input: ToastInput): void;
  error(input: ToastInput): void;
};

function resolveRecord(input: ToastInput, variant: ToastVariant): ToastRecord {
  if (typeof input === 'string') {
    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: input,
      variant,
      createdAt: Date.now(),
      duration: 5000,
    } satisfies ToastRecord;
  }

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: input.title,
    description: input.description,
    variant,
    createdAt: Date.now(),
    duration: input.duration ?? 5000,
  } satisfies ToastRecord;
}

function pushToast(input: ToastInput, variant: ToastVariant) {
  const record = resolveRecord(input, variant);
  enqueue(record);
}

export const toast: ToastApi = Object.assign(
  (input: ToastInput) => pushToast(input, 'default'),
  {
    success(input: ToastInput) {
      pushToast(input, 'success');
    },
    error(input: ToastInput) {
      pushToast(input, 'error');
    },
  },
);

const ToastContext = createContext<ToastRecord[] | null>(null);

export function Toaster({ position = 'top-right' }: { position?: 'top-right' | 'bottom-right' | 'top-left' }) {
  const [records, setRecords] = useState<ToastRecord[]>([]);

  useEffect(() => {
    const listener: ToastListener = (items) => setRecords(items);
    listeners.add(listener);
    setRecords(queue);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const containerClass = useMemo(() => {
    const base = 'pointer-events-none fixed z-50 flex flex-col gap-2 p-4';
    switch (position) {
      case 'bottom-right':
        return `${base} bottom-0 right-0 items-end`;
      case 'top-left':
        return `${base} top-0 left-0 items-start`;
      default:
        return `${base} top-0 right-0 items-end`;
    }
  }, [position]);

  if (records.length === 0) {
    return null;
  }

  return (
    <ToastContext.Provider value={records}>
      <div className={containerClass} role="region" aria-live="polite">
        {records.map((record) => (
          <motion.div
            key={record.id}
            initial={{ opacity: 0, translateY: -8, scale: 0.98 }}
            animate={{ opacity: 1, translateY: 0, scale: 1 }}
            exit={{ opacity: 0, translateY: -4, scale: 0.96 }}
            className={cn(
              'pointer-events-auto min-w-[240px] max-w-sm rounded-md border bg-background/95 px-4 py-3 text-sm shadow-lg backdrop-blur',
              record.variant === 'success' && 'border-emerald-500/40 text-emerald-50 bg-emerald-950/90',
              record.variant === 'error' && 'border-destructive/60 text-destructive-foreground bg-destructive/90',
            )}
          >
            <ToastContent record={record} />
          </motion.div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastContent({ record }: { record: ToastRecord }) {
  const labelledBy = useId();
  const describedBy = useId();
  return (
    <div className="space-y-1" aria-live="assertive">
      {record.title ? (
        <p id={labelledBy} className="font-semibold">
          {record.title}
        </p>
      ) : null}
      {record.description ? (
        <p id={describedBy} className="text-xs opacity-80">
          {record.description}
        </p>
      ) : null}
      {!record.title && !record.description ? (
        <p id={labelledBy} className="font-semibold">
          Notification
        </p>
      ) : null}
    </div>
  );
}

export function useToasts() {
  const context = useContext(ToastContext);
  if (!context) {
    return [] as ToastRecord[];
  }
  return context;
}
