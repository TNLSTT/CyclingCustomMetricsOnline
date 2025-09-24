'use client';

import { SessionProvider } from 'next-auth/react';

import { env } from '../lib/env';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!env.authEnabled) {
    return <>{children}</>;
  }
  return <SessionProvider>{children}</SessionProvider>;
}
