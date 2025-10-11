import React from 'react';
import Link from 'next/link';

import { PageHeader } from '../../components/page-header';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';

const analyticsTools = [
  {
    title: 'Activity trends',
    description:
      'Track changes in ride duration, training load, and computed metrics across your entire history.',
    href: '/activities/trends',
    action: 'Open trends',
  },
  {
    title: 'Insight reports',
    description:
      'Generate AI summaries for any ride and capture tomorrow\'s recommendation tailored to your goals.',
    href: '/analytics/insight-report',
    action: 'Generate Insight Report',
  },
  {
    title: 'Moving averages',
    description: 'Smooth noisy metrics to reveal durable baselines for power, cadence, and heart rate.',
    href: '/moving-averages',
    action: 'Explore moving averages',
  },
  {
    title: 'Durability analysis',
    description: 'Quantify how fatigue shifts your performance by comparing early and late-ride efficiency.',
    href: '/durability-analysis',
    action: 'Run durability checks',
  },
  {
    title: 'Durable TSS explorer',
    description: 'Plot late-ride training load by calculating TSS only after your chosen kilojoule marker.',
    href: '/durable-tss',
    action: 'Inspect durable TSS',
  },
  {
    title: 'Training frontiers',
    description: 'Identify your peak duration-power, durability, efficiency, and repeatability records by recency.',
    href: '/training-frontiers',
    action: 'Explore training frontiers',
  },
  {
    title: 'Metric library',
    description: 'See the definitions behind each computed metric and discover new analytics to enable.',
    href: '/metrics/registry',
    action: 'Browse metrics',
  },
];

export default function AnalyticsHubPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Analytics hub"
        description="Pick the right lens for your training data. Start with trends to understand the big picture, then dive deeper into moving averages, durability checks, and the full metric registry when you need specifics."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recommended workflow</CardTitle>
          <CardDescription>
            Upload fresh rides, review completion status on the activities page, and then iterate through each
            analytics surface below to turn raw numbers into actionable insights.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Confirm your latest uploads are processed on the activities workspace.</li>
            <li>Open the trends dashboard to spot long-term shifts in volume and intensity.</li>
            <li>
              Use moving averages to compare baseline fitness before testing durability against late-ride fatigue.
            </li>
            <li>Review the metric library to enable additional calculations for your next batch of rides.</li>
          </ol>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {analyticsTools.map((tool) => (
          <Card key={tool.title} className="flex h-full flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-lg">{tool.title}</CardTitle>
              <CardDescription>{tool.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-0">
              <Button asChild className="w-full">
                <Link href={tool.href}>{tool.action}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
