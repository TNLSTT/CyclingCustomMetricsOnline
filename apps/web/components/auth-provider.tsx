'use client';

import { SessionProvider } from 'next-auth/react';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Always wrap in SessionProvider so hooks like useSession() don’t crash
  return <SessionProvider>{children}</SessionProvider>;
}
