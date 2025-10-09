'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { signIn, signOut, useSession } from 'next-auth/react';

import { env } from '../lib/env';
import { cn } from '../lib/utils';
import { useSafePathname } from '../hooks/use-safe-pathname';
import { motion } from 'framer-motion';
import { Button } from './ui/button';

const navInteraction = { duration: 0.18, ease: [0.33, 1, 0.68, 1] as [number, number, number, number] };

type NavChild = {
  href: string;
  label: string;
};

type NavItem = {
  href: string;
  label: string;
  matchers?: string[];
  children?: NavChild[];
};

const analyticsChildren: NavChild[] = [
  { href: '/analytics', label: 'Analytics hub' },
  { href: '/activities/trends', label: 'Activity trends' },
  { href: '/moving-averages', label: 'Moving averages' },
  { href: '/durability-analysis', label: 'Durability analysis' },
  { href: '/durable-tss', label: 'Durable TSS explorer' },
  { href: '/training-frontiers', label: 'Training frontiers' },
];

const achievementsChildren: NavChild[] = [
  { href: '/achievements', label: 'Achievements hub' },
  { href: '/achievements#tracker', label: 'Achievement tracker' },
  { href: '/achievements#trophy-case', label: 'Trophy case' },
];

const baseNavItems: NavItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/activities', label: 'Activities' },
  {
    href: '/analytics',
    label: 'Analytics',
    matchers: ['/activities/trends', '/moving-averages', '/durability-analysis', '/training-frontiers', '/durable-tss'],
    children: analyticsChildren,
  },
  {
    href: '/achievements',
    label: 'Achievements',
    matchers: ['/achievements'],
    children: achievementsChildren,
  },
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
  const { status, data: session } = useSession();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const isAuthenticated = status === 'authenticated';
  const isAdmin = session?.user?.role === 'ADMIN';

  const navItems: NavItem[] = useMemo(() => {
    if (!isAuthenticated) {
      return baseNavItems;
    }

    const items = [...baseNavItems];
    if (isAdmin) {
      items.push({ href: '/admin/users', label: 'Admin', matchers: ['/admin'] });
    }
    items.push({ href: '/profile', label: 'Profile', matchers: ['/profile'] });
    return items;
  }, [isAdmin, isAuthenticated]);

  const closeDropdown = () => setOpenDropdown(null);

  return (
    <header className="border-b">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold">
          Cycling Custom Metrics
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          {navItems.map((item) => {
            const matchers = item.matchers ?? [];
            const childMatchers = item.children?.map((child) => child.href.split('#')[0]) ?? [];
            const normalizedMatchers = [...new Set([...matchers, ...childMatchers])];
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(`${item.href}/`)) ||
              normalizedMatchers.some(
                (matcher) => pathname === matcher || (matcher !== '/' && pathname.startsWith(`${matcher}/`)),
              );

            if (!item.children?.length) {
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
                  <motion.span
                    className="relative flex items-center gap-1"
                    whileHover={{ transform: 'translateY(-2px)' }}
                    whileFocus={{ transform: 'translateY(-2px)' }}
                    transition={navInteraction}
                  >
                    {item.label}
                    {isActive ? (
                      <span className="absolute inset-x-1 bottom-1 h-0.5 rounded-full bg-primary" aria-hidden />
                    ) : null}
                  </motion.span>
                </Link>
              );
            }

            const dropdownOpen = openDropdown === item.href;

            return (
              <div
                key={item.href}
                className="relative"
                onMouseEnter={() => setOpenDropdown(item.href)}
                onMouseLeave={closeDropdown}
                onFocus={() => setOpenDropdown(item.href)}
                onBlur={(event) => {
                  const nextFocus = event.relatedTarget as Node | null;
                  if (!nextFocus || !event.currentTarget.contains(nextFocus)) {
                    closeDropdown();
                  }
                }}
              >
                <motion.button
                  type="button"
                  className={cn(
                    'relative flex items-center gap-1 rounded-md px-3 py-2 transition-colors',
                    isActive
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  aria-haspopup="menu"
                  aria-expanded={dropdownOpen}
                  onClick={() =>
                    setOpenDropdown((current) => (current === item.href ? null : item.href))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.stopPropagation();
                      closeDropdown();
                    }
                  }}
                  whileHover={{ transform: 'translateY(-2px)' }}
                  whileFocus={{ transform: 'translateY(-2px)' }}
                  whileTap={{ transform: 'translateY(0)' }}
                  transition={navInteraction}
                >
                  {item.label}
                  <ChevronDown className="h-3 w-3" aria-hidden />
                  {isActive ? (
                    <span className="absolute inset-x-1 bottom-1 h-0.5 rounded-full bg-primary" aria-hidden />
                  ) : null}
                </motion.button>
                <div
                  className={cn(
                    'absolute right-0 z-20 mt-2 w-56 rounded-lg border bg-background p-2 text-sm shadow-lg transition-all duration-150',
                    dropdownOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0',
                  )}
                  role="menu"
                >
                  {item.children?.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block rounded-md px-3 py-2 text-left text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      onClick={closeDropdown}
                      role="menuitem"
                    >
                      <motion.span
                        className="inline-flex items-center"
                        whileHover={{ transform: 'translateX(4px)' }}
                        transition={navInteraction}
                      >
                        {child.label}
                      </motion.span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div>{env.authEnabled ? <AuthControls /> : null}</div>
      </div>
    </header>
  );
}
