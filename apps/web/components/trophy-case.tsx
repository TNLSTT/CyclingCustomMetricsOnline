import type { LucideIcon } from 'lucide-react';
import { Award, Crown, Medal, Trophy } from 'lucide-react';

import { cn } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

type TrophyHighlight = {
  title: string;
  description: string;
  metricHighlight: string;
  activity: string;
  icon: LucideIcon;
};

const trophyHighlights: TrophyHighlight[] = [
  {
    title: 'Gran Fondo Guardian',
    description: 'Completed four consecutive 160km rides with rising normalized power each week.',
    metricHighlight: 'Best four-week fatigue resistance trend',
    activity: 'Anchored by the Coast-to-Summit Gran Fondo',
    icon: Trophy,
  },
  {
    title: 'Efficiency Maestro',
    description: 'Delivered a 1.1% improvement in aerobic decoupling during a five-hour endurance ride.',
    metricHighlight: 'Lowest heart-rate drift at endurance pace',
    activity: 'Captured on the Highlands base miles expedition',
    icon: Medal,
  },
  {
    title: 'Sprint Closer',
    description: 'Executed back-to-back 15-second sprints above 1300 watts deep into a training crit.',
    metricHighlight: 'Peak late-ride neuromuscular output',
    activity: 'Sealed in the Riverside twilight criterium',
    icon: Crown,
  },
  {
    title: 'Climb Consistency Laureate',
    description: 'Matched pacing within 2% variance across all switchbacks of a 45-minute climb effort.',
    metricHighlight: 'Most stable climb pacing score',
    activity: 'Logged during the Monte Verde pacing rehearsal',
    icon: Award,
  },
];

type TrophyCaseProps = {
  className?: string;
  id?: string;
};

export function TrophyCase({ className, id }: TrophyCaseProps) {
  return (
    <section
      id={id}
      className={cn(
        'space-y-8 rounded-3xl border bg-primary/5 p-8 shadow-lg shadow-primary/5 md:p-12',
        className,
      )}
    >
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Trophy case
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Showcase of standout rides</h2>
          <p className="text-sm text-muted-foreground">
            These highlights surface the rides that unlocked recent trophies. Use them as inspiration for what to
            chase next or to revisit the files that set new standards for your training.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {trophyHighlights.map((trophy) => (
          <Card key={trophy.title} className="h-full border-primary/20 bg-background/90">
            <CardHeader className="flex flex-row items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <trophy.icon className="h-6 w-6" aria-hidden />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg font-semibold text-foreground">{trophy.title}</CardTitle>
                <CardDescription>{trophy.metricHighlight}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{trophy.description}</p>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary/80">{trophy.activity}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
