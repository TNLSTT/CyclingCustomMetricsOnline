import type { Metadata } from 'next';

import { AchievementSection } from '../../components/achievement-section';

export const metadata: Metadata = {
  title: 'Achievements | Cycling Custom Metrics',
  description:
    'Track cycling milestones across climbing, durability, and freshness with the Cycling Custom Metrics achievement tracker.',
};

export default function AchievementsPage() {
  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border bg-card/70 p-8 shadow-lg shadow-primary/10 backdrop-blur md:p-12">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 hidden h-full w-[600px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl md:block" />
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Achievement hub
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Celebrate standout efforts</h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              Use the categories below to understand the milestones our analytics highlight. Whether you are chasing vert-heavy adventures or defending freshness for race day, you&apos;ll find the next target here.
            </p>
          </div>
        </div>
      </section>

      <AchievementSection className="shadow-lg shadow-primary/5" />
    </div>
  );
}
