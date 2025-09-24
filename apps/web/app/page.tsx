import Link from 'next/link';

import { LandingUpload } from '../components/landing-upload';
import { buttonVariants } from '../components/ui/button';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const features = [
  {
    title: 'Parse & Normalize',
    description: 'Resample FIT data to 1 Hz, clean anomalies, and store every second in Postgres.',
  },
  {
    title: 'Extensible Metrics',
    description: 'Add new metrics by dropping a single file into the registry with tests and definitions.',
  },
  {
    title: 'Actionable Insights',
    description:
      'Visualize the HR-to-Cadence Scaling Ratio with fatigue diagnostics to guide cadence drills.',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Cycling Custom Metrics
          </h1>
          <p className="text-lg text-muted-foreground">
            Upload Garmin FIT rides, compute novel endurance metrics, and build your own analytics
            extensions without touching the core ingestion pipeline.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/activities"
              className={cn(buttonVariants({ variant: 'default' }))}
            >
              View activities
            </Link>
            <Link
              href="/metrics"
              className={cn(buttonVariants({ variant: 'secondary' }))}
            >
              Browse metric registry
            </Link>
          </div>
        </div>
        <LandingUpload />
      </section>
      <section className="grid gap-6 md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {feature.description}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
