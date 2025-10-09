import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContextState = {
  id: string;
  path: string;
  method: string;
  userId?: string | null;
  startedAt: number;
  queryCount: number;
  totalQueryDurationMs: number;
};

const storage = new AsyncLocalStorage<RequestContextState>();

export function runWithRequestContext<T>(state: RequestContextState, callback: () => T): T {
  return storage.run(state, callback);
}

export function getRequestContext(): RequestContextState | undefined {
  return storage.getStore();
}

export function incrementQuery(durationMs: number): void {
  const context = storage.getStore();
  if (context) {
    context.queryCount += 1;
    context.totalQueryDurationMs += durationMs;
  }
}
