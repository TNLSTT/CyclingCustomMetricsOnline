import { useId } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface MetricInsightDetail {
  label: string;
  value: string;
}

interface MetricInsight {
  calculation: string;
  importance: string;
  usage: string;
  technicalDetails?: MetricInsightDetail[];
  notes?: string[];
}

interface MetricSummaryCardProps {
  title: string;
  value: string | number | null | undefined;
  description?: string;
  units?: string | null;
  insight?: MetricInsight;
}

export function MetricSummaryCard({ title, value, description, units, insight }: MetricSummaryCardProps) {
  const tooltipId = useId();

  const formattedValue =
    value == null || Number.isNaN(Number(value)) ? '—' : value;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-start gap-2 text-base font-semibold">
          <span className="leading-tight">{title}</span>
          {insight ? (
            <span className="relative flex-shrink-0">
              <button
                type="button"
                className="peer inline-flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/40 bg-background text-[0.65rem] font-semibold leading-none text-muted-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label={`How ${title} is calculated`}
                aria-describedby={tooltipId}
              >
                ↗
              </button>
              <div
                id={tooltipId}
                role="tooltip"
                className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-72 max-w-[18rem] rounded-md border border-border bg-background p-3 text-xs text-foreground opacity-0 shadow-lg transition-opacity duration-200 peer-focus-visible:opacity-100 peer-hover:opacity-100"
              >
                <div className="space-y-2">
                  <section>
                    <h3 className="text-[0.7rem] font-semibold uppercase tracking-wide text-foreground">
                      Calculation
                    </h3>
                    <p className="mt-1 leading-relaxed text-muted-foreground">{insight.calculation}</p>
                  </section>
                  <section>
                    <h3 className="text-[0.7rem] font-semibold uppercase tracking-wide text-foreground">
                      Why it matters
                    </h3>
                    <p className="mt-1 leading-relaxed text-muted-foreground">{insight.importance}</p>
                  </section>
                  <section>
                    <h3 className="text-[0.7rem] font-semibold uppercase tracking-wide text-foreground">
                      How to use it
                    </h3>
                    <p className="mt-1 leading-relaxed text-muted-foreground">{insight.usage}</p>
                  </section>
                  {insight.technicalDetails && insight.technicalDetails.length > 0 ? (
                    <section>
                      <h3 className="text-[0.7rem] font-semibold uppercase tracking-wide text-foreground">
                        Technical details
                      </h3>
                      <dl className="mt-1 space-y-1">
                        {insight.technicalDetails.map((detail) => (
                          <div key={`${detail.label}-${detail.value}`} className="flex items-start justify-between gap-2">
                            <dt className="text-[0.7rem] font-medium text-foreground">{detail.label}</dt>
                            <dd className="text-right text-[0.7rem] text-muted-foreground">{detail.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ) : null}
                  {insight.notes && insight.notes.length > 0 ? (
                    <section>
                      <h3 className="text-[0.7rem] font-semibold uppercase tracking-wide text-foreground">
                        Notes
                      </h3>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-[0.7rem] text-muted-foreground">
                        {insight.notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              </div>
            </span>
          ) : null}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">
          {formattedValue}
          {units ? (
            <span className="ml-1 text-base font-normal text-muted-foreground">{units}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
