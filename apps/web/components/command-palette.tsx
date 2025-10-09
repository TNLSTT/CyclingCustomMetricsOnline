'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { Command, Compass, LineChart, Map, ShieldCheck, UploadCloud } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { Input } from './ui/input';
import { Button } from './ui/button';

interface CommandItem {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

const BASE_COMMANDS: CommandItem[] = [
  {
    title: 'Activities overview',
    description: 'Browse uploaded rides and computed metrics.',
    href: '/activities',
    icon: Compass,
  },
  {
    title: 'Analytics dashboard',
    description: 'Review global trends and charts.',
    href: '/analytics',
    icon: LineChart,
  },
  {
    title: 'Upload FIT files',
    description: 'Send new rides to the processing queue.',
    href: '/',
    icon: UploadCloud,
  },
  {
    title: 'Durability analysis',
    description: 'Inspect late-ride aerobic durability windows.',
    href: '/durability-analysis',
    icon: Map,
  },
];

export function CommandPalette() {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const commands = useMemo(() => {
    const base = [...BASE_COMMANDS];
    if (session?.user?.role === 'ADMIN') {
      base.push({
        title: 'Admin dashboard',
        description: 'Manage user accounts and permissions.',
        href: '/admin/users',
        icon: ShieldCheck,
      });
    }
    return base;
  }, [session?.user?.role]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return commands;
    }
    return commands.filter((command) => fuzzyMatch(normalized, `${command.title} ${command.description}`));
  }, [commands, query]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    if ((isMac && event.metaKey && event.key.toLowerCase() === 'k') || (!isMac && event.ctrlKey && event.key.toLowerCase() === 'k')) {
      event.preventDefault();
      setOpen((previous) => !previous);
      setQuery('');
      setHighlighted(0);
    }
    if (!open) {
      return;
    }
    if (event.key === 'ArrowDown' && filtered.length > 0) {
      event.preventDefault();
      setHighlighted((index) => Math.min(filtered.length - 1, index + 1));
    }
    if (event.key === 'ArrowUp' && filtered.length > 0) {
      event.preventDefault();
      setHighlighted((index) => Math.max(0, index - 1));
    }
    if (event.key === 'Enter' && filtered.length > 0) {
      event.preventDefault();
      const command = filtered[highlighted];
      if (command) {
        router.push(command.href);
        setOpen(false);
        setQuery('');
      }
    }
    if (event.key === 'Escape') {
      setOpen(false);
    }
  }, [filtered, highlighted, open, router]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 p-4 pt-24 backdrop-blur" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-2xl border border-border/60 bg-background/95 shadow-xl">
        <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Command className="h-4 w-4" aria-hidden="true" />
            Command Palette
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Esc
          </Button>
        </header>
        <div className="space-y-4 p-4">
          <Input
            autoFocus
            placeholder="Type to search destinations..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlighted(0);
            }}
            aria-label="Command palette search"
          />
          <div className="max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matches. Try a different keyword.</p>
            ) : (
              <ul className="space-y-2">
                {filtered.map((command, index) => {
                  const Icon = command.icon;
                  const active = index === highlighted;
                  return (
                    <li key={command.href}>
                      <button
                        type="button"
                        onClick={() => {
                          router.push(command.href);
                          setOpen(false);
                          setQuery('');
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all ${
                          active ? 'border-primary/60 bg-primary/10 text-primary' : 'border-transparent hover:border-border/60 hover:bg-muted'
                        }`}
                        aria-pressed={active}
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">{command.title}</span>
                          <span className="text-xs text-muted-foreground">{command.description}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function fuzzyMatch(query: string, text: string) {
  if (!query) {
    return true;
  }
  const haystack = text.toLowerCase();
  let index = 0;
  for (const char of query) {
    const match = haystack.indexOf(char, index);
    if (match === -1) {
      return false;
    }
    index = match + 1;
  }
  return true;
}
