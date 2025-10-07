import Link from 'next/link';

import { Activity, BarChart3, BrainCircuit, Gauge, Layers3, Quote, Route, Sparkles, Timer } from 'lucide-react';

import { LandingUpload } from '../components/landing-upload';
import { AchievementSection } from '../components/achievement-section';
import { MetricSpotlight } from '../components/metric-spotlight';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const heroHighlights = [
  {
    value: '1 Hz streams',
    label: 'Normalized FIT telemetry stored for every second of your ride.',
  },
  {
    value: '15+ metrics',
    label: 'Launch fatigue, durability, and interval intelligence in one click.',
  },
  {
    value: '<2 min ingest',
    label: 'Optimized pipeline pushes results before your recovery shake is ready.',
  },
];

const experienceHighlights = [
  {
    title: 'Parse & normalize effortlessly',
    description: 'Resample FIT files to pristine 1 Hz streams with automated anomaly scrubbing and secure storage.',
    icon: Activity,
  },
  {
    title: 'Design your own metrics',
    description: 'Drop metric definitions into the registry to unlock new analytics without touching ingestion code.',
    icon: Layers3,
  },
  {
    title: 'Coach-level storytelling',
    description: 'Blend cadence scaling, interval efficiency, and trend dashboards into shareable athlete narratives.',
    icon: Sparkles,
  },
];

const workflow = [
  {
    title: 'Upload & validate',
    description:
      'Drag, drop, and automatically deduplicate FIT files. We check file integrity, athlete IDs, and activity metadata instantly.',
    icon: Gauge,
  },
  {
    title: 'Compute custom insights',
    description:
      'Trigger built-in durability analytics or run bespoke formulas with one action—from HR drift to frontier exploration.',
    icon: BrainCircuit,
  },
  {
    title: 'Share stories & iterate',
    description:
      'Sync visualizations, export highlights, and keep improving your playbook with feedback-ready dashboards.',
    icon: Route,
  },
];

const workspaceSections = [
  {
    title: 'Activities workspace',
    description: 'Review uploads, check processing status, and open detailed ride summaries.',
    href: '/activities',
    action: 'Go to activities',
  },
  {
    title: 'Analytics hub',
    description: 'Choose the right dashboard to explore trends, moving averages, and durability insights.',
    href: '/analytics',
    action: 'Explore analytics',
  },
  {
    title: 'Metric library',
    description: 'Understand every computed metric and enable new calculations for upcoming rides.',
    href: '/metrics/registry',
    action: 'Browse metrics',
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
    <div className="space-y-24">
      <section className="relative overflow-hidden rounded-3xl border bg-card/70 p-8 shadow-lg shadow-primary/10 backdrop-blur md:p-12">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 hidden h-full w-[600px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl md:block" />
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Built for endurance engineers
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Cycling Custom Metrics
              </h1>
              <p className="text-lg text-muted-foreground">
                Upload Garmin FIT rides, compute novel endurance metrics, and iterate on your own analytics extensions—without rewriting the ingestion pipeline.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/activities" className="group inline-flex items-center gap-2">
                  View activities
                  <Timer className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/analytics" className="group inline-flex items-center gap-2">
                  Explore analytics hub
                  <BarChart3 className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" aria-hidden />
                </Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {heroHighlights.map((item) => (
                <div key={item.value} className="rounded-2xl border border-primary/20 bg-background/80 p-4">
                  <p className="text-sm font-semibold text-primary">{item.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
          <Card className="relative overflow-hidden border-primary/30 bg-background/80 shadow-xl shadow-primary/20">
            <div className="pointer-events-none absolute -right-24 -top-24 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
            <CardHeader>
              <CardTitle className="text-base font-semibold">Upload your ride</CardTitle>
              <CardDescription>Start the pipeline and watch metrics populate automatically.</CardDescription>
            </CardHeader>
            <CardContent>
              <LandingUpload />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {experienceHighlights.map((feature) => (
          <Card key={feature.title} className="relative overflow-hidden border-primary/10 bg-background/70">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/80 via-primary to-primary/80" />
            <CardHeader className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <feature.icon className="h-5 w-5" aria-hidden />
              </div>
              <CardTitle className="text-lg font-semibold">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{feature.description}</CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {workspaceSections.map((section) => (
          <Card key={section.title} className="group h-full border-primary/15 bg-background/80 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex justify-between pt-0 text-sm font-medium">
              <Button asChild size="sm" className="group">
                <Link href={section.href} className="inline-flex items-center gap-2">
                  {section.action}
                  <Route className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <MetricSpotlight />

      <AchievementSection />

      <section className="rounded-3xl border bg-background/70 p-8 shadow-inner shadow-primary/10 md:p-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xl space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">A workflow that keeps pace with your training</h2>
            <p className="text-sm text-muted-foreground">
              From ingestion to storytelling, each stage is built to surface clarity fast so you can get back on the bike—or coach the next interval.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/moving-averages" className="inline-flex items-center gap-2">
              Preview a moving average dashboard
              <Activity className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {workflow.map((step) => (
            <div
              key={step.title}
              className="relative flex flex-col gap-4 rounded-2xl border border-primary/15 bg-background/90 p-6 shadow-sm shadow-primary/10"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <Card className="relative overflow-hidden border-primary/30 bg-primary/5">
        <div className="absolute inset-y-0 right-0 h-full w-2/5 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.25),_rgba(59,130,246,0)_70%)]" />
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-primary">Your analytics cockpit</CardTitle>
          <CardDescription className="max-w-2xl text-base text-muted-foreground">
            Build a feedback loop between training load and durability with curated moving averages, fatigue checks, and cadence insights. Every dataset stays private to your account by default.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            Stay in command with alerts when durability drops, comparison views for key events, and exports that respect your privacy model.
          </div>
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

      <section className="grid gap-6 md:grid-cols-2">
        {testimonials.map((testimonial) => (
          <Card key={testimonial.name} className="relative overflow-hidden border-primary/15 bg-background/80">
            <div className="absolute -left-10 top-0 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Quote className="h-5 w-5" aria-hidden />
                </span>
                {testimonial.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="leading-relaxed">{testimonial.quote}</p>
              <p className="text-xs uppercase tracking-[0.3em] text-primary/80">
                Built for long rides, stage races, and data-curious adventures.
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
