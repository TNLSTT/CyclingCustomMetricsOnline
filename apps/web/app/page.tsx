import Link from 'next/link';

import { LandingUpload } from '../components/landing-upload';
import { Button } from '../components/ui/button';
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

const onboardingSteps = [
  {
    title: '1. Upload a FIT ride',
    description:
      'Drag-and-drop one or more workouts to kick off ingestion. We automatically de-duplicate files and validate FIT integrity.',
  },
  {
    title: '2. Compute your favourite metrics',
    description:
      'Trigger the HR-to-Cadence Scaling Ratio, interval efficiency, normalized power, and any custom metrics you add to the registry.',
  },
  {
    title: '3. Explore insights & share',
    description:
      'Use ride maps, comparison tables, and trend visualizations to summarize durability for teammates or coaches.',
  },
];

const testimonials = [
  {
    name: 'Coach Maya',
    quote:
      '“The interval efficiency dashboard replaced three spreadsheets. My athletes finally understand how fatigue shifts their cadence strategy.”',
  },
  {
    name: 'Gravel racer Leo',
    quote:
      '“I can spin up a new metric file on Friday, run it on a Saturday ride, and review the results before Sunday training.”',
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
            <Button asChild>
              <Link href="/activities">View activities</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/metrics">Browse metric registry</Link>
            </Button>
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
      <section className="grid gap-4 md:grid-cols-3">
        {onboardingSteps.map((step) => (
          <Card key={step.title}>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{step.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{step.description}</CardContent>
          </Card>
        ))}
      </section>
      <Card className="border-primary/40 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Your analytics cockpit</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p className="md:max-w-xl">
            Build a feedback loop between training stress and durability with curated moving averages, fatigue
            checks, and cadence insights. Every dataset stays private to your account by default.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href="/register">Create free account</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/activities/trends">Preview trend tools</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      <section className="grid gap-4 md:grid-cols-2">
        {testimonials.map((testimonial) => (
          <Card key={testimonial.name}>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{testimonial.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{testimonial.quote}</p>
              <p className="text-xs">Built for long rides, stage races, and data-curious adventures.</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
