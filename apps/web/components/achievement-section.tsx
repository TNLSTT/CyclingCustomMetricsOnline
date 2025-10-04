import { Leaf, Mountain, ShieldCheck } from 'lucide-react';

import { cn } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export const achievementCategories = [
  {
    title: 'Climbing',
    description: 'Benchmark vertical strength with elevation-focused challenges.',
    icon: Mountain,
    achievements: [
      {
        name: 'Summit seeker',
        detail: 'Complete a ride with over 1,000 meters of elevation gain.',
      },
    ],
  },
  {
    title: 'Durability',
    description: 'Stress-test fatigue resistance during long endurance days.',
    icon: ShieldCheck,
    achievements: [
      {
        name: 'FTP endurance',
        detail: 'Hold 90% of FTP for an hour after accumulating three hours of Zone 2 kilojoules.',
      },
      {
        name: 'VO2 staying power',
        detail: 'Hold 90% of your five-minute power best after three hours of Zone 2 kilojoules.',
      },
    ],
  },
  {
    title: 'With Freshness',
    description: 'Track top-end execution when legs are recharged and ready.',
    icon: Leaf,
    achievements: [
      {
        name: 'Fresh legs framework',
        detail: 'We will add freshness-focused achievements soon—this category is built to expand.',
      },
    ],
  },
];

type AchievementSectionProps = {
  className?: string;
};

export function AchievementSection({ className }: AchievementSectionProps) {
  return (
    <section
      className={cn(
        'space-y-8 rounded-3xl border bg-background/70 p-8 shadow-inner shadow-primary/10 md:p-12',
        className,
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Achievement tracker</h2>
          <p className="text-sm text-muted-foreground">
            Celebrate standout efforts across climbing, durability, and freshness. Achievements refresh every six months so
            riders always have new benchmarks to chase.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
          6-month reset
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {achievementCategories.map((category) => (
          <Card key={category.title} className="h-full border-primary/15 bg-background/80">
            <CardHeader className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <category.icon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-foreground">{category.title}</CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {category.achievements.map((achievement) => (
                  <li key={achievement.name} className="rounded-xl border border-primary/10 bg-background/90 p-3">
                    <p className="text-sm font-semibold text-foreground">{achievement.name}</p>
                    <p className="text-xs text-muted-foreground">{achievement.detail}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
