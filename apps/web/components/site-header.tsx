'use client';

import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';

import { env } from '../lib/env';
import { cn } from '../lib/utils';
import { useSafePathname } from '../hooks/use-safe-pathname';
import { Button } from './ui/button';

type NavItem = {
  href: string;
  label: string;
  matchers?: string[];
};

const baseNavItems: NavItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/activities', label: 'Activities' },
  {
    href: '/analytics',
    label: 'Analytics',
    matchers: ['/activities/trends', '/moving-averages', '/durability-analysis', '/training-frontiers'],
  },
  { href: '/achievements', label: 'Achievements' },
  {
    href: '/metrics/registry',
    label: 'Metric library',
    matchers: ['/metrics'],
  },
];

function AuthControls() {
  const { status } = useSession();

  if (status === 'loading') {
    return <span className="text-sm text-muted-foreground">Loading...</span>;
  }

  if (status === 'authenticated') {
    return (
      <Button variant="ghost" size="sm" onClick={() => signOut()}>
        Sign out
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={() => signIn()}>
        Sign in
      </Button>
      <Button size="sm" asChild>
        <Link href="/register">Register</Link>
      </Button>
    </div>
  );
}

export function SiteHeader() {
  const pathname = useSafePathname();
  const { status } = useSession();

  const navItems: NavItem[] =
    status === 'authenticated'
      ? [...baseNavItems, { href: '/profile', label: 'Profile', matchers: ['/profile'] }]
      : baseNavItems;

  return (
    <header className="border-b">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold">
          Cycling Custom Metrics
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          {navItems.map((item) => {
            const matchers = item.matchers ?? [];
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(`${item.href}/`)) ||
              matchers.some(
                (matcher) =>
                  pathname === matcher ||
                  (matcher !== '/' && pathname.startsWith(`${matcher}/`)),
              );
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative rounded-md px-3 py-2 transition-colors',
                  isActive
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
                {isActive ? (
                  <span className="absolute inset-x-1 bottom-1 h-0.5 rounded-full bg-primary" aria-hidden />
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div>{env.authEnabled ? <AuthControls /> : null}</div>
      </div>
    </header>
  );
}
