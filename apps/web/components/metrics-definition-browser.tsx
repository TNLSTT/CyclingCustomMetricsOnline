'use client';

import { useMemo, useState } from 'react';
import { ArrowDownAZ, ArrowDownWideNarrow, Copy, Info } from 'lucide-react';

import type { MetricDefinition } from '../types/activity';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';

interface MetricsDefinitionBrowserProps {
  definitions: MetricDefinition[];
}

type SortOption = 'alphabetical' | 'version';

type CopyState = {
  key: string;
  timestamp: number;
};

export function MetricsDefinitionBrowser({ definitions }: MetricsDefinitionBrowserProps) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('alphabetical');
  const [copied, setCopied] = useState<CopyState | null>(null);

  const filtered = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    const sorted = [...definitions].sort((a, b) => {
      if (sort === 'alphabetical') {
        return a.name.localeCompare(b.name);
      }
      if (a.version === b.version) {
        return a.name.localeCompare(b.name);
      }
      return b.version - a.version;
    });

    if (!trimmedQuery) {
      return sorted;
    }

    return sorted.filter((definition) => {
      const haystack = [
        definition.name,
        definition.key,
        definition.description,
        definition.units ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(trimmedQuery);
    });
  }, [definitions, query, sort]);

  const handleCopy = async (metricKey: string) => {
    try {
      await navigator.clipboard?.writeText(metricKey);
      setCopied({ key: metricKey, timestamp: Date.now() });
      setTimeout(() => {
        setCopied((current) => {
          if (!current) {
            return null;
          }
          if (Date.now() - current.timestamp >= 2000) {
            return null;
          }
          return current;
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to copy metric key', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, key, units, or description"
            aria-label="Search metric definitions"
          />
          {query ? (
            <Button variant="ghost" size="sm" onClick={() => setQuery('')}>Clear</Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span className="hidden sm:inline">Sort definitions:</span>
          <Button
            size="sm"
            variant={sort === 'alphabetical' ? 'default' : 'outline'}
            onClick={() => setSort('alphabetical')}
            className="gap-2"
            aria-pressed={sort === 'alphabetical'}
          >
            <ArrowDownAZ className="h-4 w-4" /> A → Z
          </Button>
          <Button
            size="sm"
            variant={sort === 'version' ? 'default' : 'outline'}
            onClick={() => setSort('version')}
            className="gap-2"
            aria-pressed={sort === 'version'}
          >
            <ArrowDownWideNarrow className="h-4 w-4" /> Latest version
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No metric definitions match your filters yet. Try searching for a different keyword or clear the
            filters above.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((definition) => {
            const isCopied = copied?.key === definition.key;
            return (
              <Card key={definition.key} className="flex flex-col">
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-base font-semibold">
                      {definition.name}
                      <span className="ml-2 text-xs text-muted-foreground">v{definition.version}</span>
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleCopy(definition.key)}
                      aria-label={`Copy ${definition.key} to clipboard`}
                    >
                      <Copy className="h-4 w-4" />
                      {isCopied ? 'Copied!' : 'Copy key'}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{definition.key}</Badge>
                    <span>
                      Units:{' '}
                      <span className="font-medium text-foreground">{definition.units ?? 'Not provided'}</span>
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 text-sm text-muted-foreground">
                  <p>{definition.description}</p>
                  {definition.computeConfig ? (
                    <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">
                      {JSON.stringify(definition.computeConfig, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-xs italic">No compute config provided.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
