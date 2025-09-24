import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface MetricSummaryCardProps {
  title: string;
  value: string | number | null | undefined;
  description?: string;
  units?: string | null;
}

export function MetricSummaryCard({ title, value, description, units }: MetricSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">
          {value == null || Number.isNaN(Number(value)) ? '—' : value}
          {units ? <span className="ml-1 text-base font-normal text-muted-foreground">{units}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
