import { type LucideIcon, Activity, Gauge, LineChart, Mountain, Sparkles, TrendingUp } from 'lucide-react';

import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const metricSpotlights: {
  key: string;
  name: string;
  blurb: string;
  highlight: string;
  statLabel: string;
  statValue: string;
  statDelta: string;
  icon: LucideIcon;
  points: string[];
}[] = [
  {
    key: 'hcsr',
    name: 'Heart rate ↔ cadence scaling',
    blurb:
      'Reveal where cadence becomes costly. HCSR exposes the slope of heart rate creep against cadence buckets so you can spot fatigue-driven drift early.',
    highlight: 'Cadence efficiency',
    statLabel: 'Last ride slope',
    statValue: '0.62 bpm/rpm',
    statDelta: '+0.05 vs. 6-week avg',
    icon: LineChart,
    points: [
      'Compare first vs. second half slopes to catch durability gaps.',
      'Quantify how steady-state cadence adjustments affect heart rate.',
      'Share annotated cadence buckets directly from the dashboard.',
    ],
  },
  {
    key: 'durability',
    name: 'FTP anchored durability',
    blurb:
      'Track how much high-intensity power survives after long aerobic builds. Durability scores combine FTP benchmarks with accumulated kilojoules.',
    highlight: 'Fatigue resistance',
    statLabel: 'Resilience score',
    statValue: '74 / 100',
    statDelta: '+6 since block start',
    icon: Mountain,
    points: [
      'Flag when endurance days degrade your finishing power.',
      'Isolate breakthrough rides with long-form fatigue overlays.',
      'Export before/after comparisons for athlete debriefs.',
    ],
  },
  {
    key: 'normalized-power',
    name: 'Interval normalized power',
    blurb:
      'Pinpoint where stochastic efforts pay off. Interval blocks compute rolling normalized power, heart rate lag, and recovery readiness markers.',
    highlight: 'Interval intelligence',
    statLabel: 'Peak NP window',
    statValue: '324 W · 20 min',
    statDelta: '+11 W from prior build',
    icon: Activity,
    points: [
      'Surface the exact windows that drive FTP breakthroughs.',
      'Balance work:recovery with automated block-level summaries.',
      'Sync highlights to moving average dashboards for context.',
    ],
  },
];

const quickWins = [
  {
    label: 'Automations live',
    value: '12 recipes',
    description: 'Pre-built recompute flows ready to run after each upload.',
    icon: Sparkles,
  },
  {
    label: 'Cadence buckets',
    value: '30+ segments',
    description: 'Every segment keeps medians, quartiles, and outlier filters.',
    icon: Gauge,
  },
  {
    label: 'Trend alerts',
    value: 'Weekly digest',
    description: 'Get nudges when durability or HR drift thresholds change.',
    icon: TrendingUp,
  },
];

export function MetricSpotlight() {
  return (
    <section className="space-y-10 rounded-3xl border bg-background/70 p-8 shadow-inner shadow-primary/10 md:p-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <Badge variant="outline" className="w-fit border-primary/40 bg-primary/10 text-xs font-semibold uppercase tracking-[0.35em] text-primary">
            Metric spotlight
          </Badge>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Built-in analytics you can extend in a single file
          </h2>
          <p className="text-sm text-muted-foreground">
            Start with ready-made endurance metrics and tailor the registry to your coaching philosophy. Each spotlight highlights the context athletes care about most—durability, cadence, and interval execution.
          </p>
        </div>
        <div className="text-sm text-muted-foreground md:max-w-sm">
          Write bespoke logic once, then re-run it across any historical ride. Every metric surfaces narrative-ready stats and exports without leaving the dashboard.
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {metricSpotlights.map((metric) => (
          <Card key={metric.key} className="relative flex h-full flex-col border-primary/15 bg-background/80">
            <CardHeader className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <metric.icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <CardTitle className="text-lg font-semibold text-foreground">{metric.name}</CardTitle>
                  <CardDescription>{metric.highlight}</CardDescription>
                </div>
              </div>
              <div className="rounded-xl border border-primary/10 bg-background/90 p-4 text-sm text-muted-foreground">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/80">{metric.statLabel}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold text-foreground">{metric.statValue}</span>
                  <span className="text-xs font-medium text-emerald-500">{metric.statDelta}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <p className="text-sm text-muted-foreground">{metric.blurb}</p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {metric.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 rounded-xl border border-primary/10 bg-background/90 p-3">
                    <span className="mt-0.5 text-primary">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {quickWins.map((item) => (
          <div
            key={item.label}
            className="flex flex-col gap-1 rounded-2xl border border-primary/15 bg-background/80 p-4 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2 text-primary">
              <item.icon className="h-4 w-4" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">{item.label}</span>
            </div>
            <div className="text-xl font-semibold text-foreground">{item.value}</div>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
