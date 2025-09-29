import type { ReactNode } from 'react';

import { MetricTabsNav } from '../../../components/metric-tabs-nav';

export default function MetricsTabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <MetricTabsNav />
      {children}
    </div>
  );
}
