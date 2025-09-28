'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';

import { env } from '../lib/env';
import { Button } from './ui/button';

const baseNavItems = [
  { href: '/', label: 'Home' },
  { href: '/activities', label: 'Activities' },
  { href: '/activities/compare', label: 'Compare' },
  { href: '/activities/trends', label: 'Trends' },
  { href: '/metrics', label: 'Metrics' },
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
  const pathname = usePathname();
  const { status } = useSession();

  const navItems =
    status === 'authenticated' ? [...baseNavItems, { href: '/profile', label: 'Profile' }] : baseNavItems;

  return (
    <header className="border-b">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold">
          Cycling Custom Metrics
        </Link>
        <nav className="flex items-center space-x-4 text-sm font-medium">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                pathname === item.href
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div>{env.authEnabled ? <AuthControls /> : null}</div>
      </div>
    </header>
  );
}
