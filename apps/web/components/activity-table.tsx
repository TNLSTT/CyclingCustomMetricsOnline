'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Filter, RefreshCcw, Search, X } from 'lucide-react';

import { formatDuration } from '../lib/utils';
import type { ActivitySummary } from '../types/activity';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

type StatusFilter = 'all' | 'ready' | 'pending';

interface ActivityTableProps {
  activities: ActivitySummary[];
}

interface AugmentedActivity {
  activity: ActivitySummary;
  formattedStart: string;
  uploadedAt: string;
  hasMetrics: boolean;
}

export function ActivityTable({ activities }: ActivityTableProps) {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [selectedMetric, setSelectedMetric] = useState<string>('all');
  const [query, setQuery] = useState('');

  const augmented = useMemo<AugmentedActivity[]>(() => {
    return activities
      .map((activity) => {
        const formattedStart = new Date(activity.startTime).toLocaleString();
        const uploadedAt = new Date(activity.createdAt).toLocaleString();
        return {
          activity,
          formattedStart,
          uploadedAt,
          hasMetrics: activity.metrics.length > 0,
        };
      })
      .sort((a, b) => {
        return new Date(b.activity.startTime).getTime() - new Date(a.activity.startTime).getTime();
      });
  }, [activities]);

  const metricKeys = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((activity) => {
      activity.metrics.forEach((metric) => {
        set.add(metric.key);
      });
    });
    return Array.from(set).sort();
  }, [activities]);

  const filtered = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();

    return augmented.filter(({ activity, formattedStart }) => {
      const hasMetrics = activity.metrics.length > 0;
      if (status === 'ready' && !hasMetrics) {
        return false;
      }
      if (status === 'pending' && hasMetrics) {
        return false;
      }

      if (selectedMetric !== 'all' && !activity.metrics.some((metric) => metric.key === selectedMetric)) {
        return false;
      }

      if (trimmedQuery.length > 0) {
        const haystack = [
          activity.source,
          formattedStart,
          formatDuration(activity.durationSec),
          activity.metrics.map((metric) => metric.key).join(' '),
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(trimmedQuery)) {
          return false;
        }
      }

      return true;
    });
  }, [augmented, status, selectedMetric, query]);

  const handleResetFilters = () => {
    setStatus('all');
    setSelectedMetric('all');
    setQuery('');
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by source, start time, or metric key"
                className="pl-9"
                aria-label="Search activities"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span>Show:</span>
              {([
                { value: 'all', label: 'All' },
                { value: 'ready', label: 'Metrics ready' },
                { value: 'pending', label: 'Waiting' },
              ] as const).map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={status === option.value ? 'default' : 'outline'}
                  onClick={() => setStatus(option.value)}
                  aria-pressed={status === option.value}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Metric focus:</span>
            <Button
              size="sm"
              variant={selectedMetric === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedMetric('all')}
              aria-pressed={selectedMetric === 'all'}
            >
              All
            </Button>
            {metricKeys.map((key) => (
              <Button
                key={key}
                size="sm"
                variant={selectedMetric === key ? 'default' : 'outline'}
                onClick={() => setSelectedMetric(key)}
                aria-pressed={selectedMetric === key}
              >
                {key}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Showing {filtered.length} of {augmented.length} activities
            {selectedMetric !== 'all' ? ` with ${selectedMetric}` : ''}.
          </span>
          <Button variant="ghost" size="sm" onClick={handleResetFilters} className="gap-2">
            <RefreshCcw className="h-3 w-3" /> Reset
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Start time</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Metrics</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No activities match your filters yet. Try adjusting the search or compute metrics from the
                    activity detail page.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(({ activity, formattedStart, uploadedAt, hasMetrics }) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{formattedStart}</TableCell>
                    <TableCell>{activity.source}</TableCell>
                    <TableCell>{formatDuration(activity.durationSec)}</TableCell>
                    <TableCell className="space-x-2">
                      {activity.metrics.length === 0 ? (
                        <Badge variant="outline">Pending</Badge>
                      ) : (
                        activity.metrics.map((metric) => (
                          <Badge key={metric.key} variant="secondary">
                            {metric.key}
                          </Badge>
                        ))
                      )}
                    </TableCell>
                    <TableCell>
                      {hasMetrics ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700">Ready</Badge>
                      ) : (
                        <Badge variant="outline">Awaiting compute</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{uploadedAt}</TableCell>
                    <TableCell className="text-right">
                      <Link className="text-primary underline" href={`/activities/${activity.id}`}>
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
