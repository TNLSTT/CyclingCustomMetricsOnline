import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import AnalyticsHubPage from './page';

describe('AnalyticsHubPage', () => {
  it('renders the Generate Insight Report CTA', () => {
    const html = renderToString(<AnalyticsHubPage />);

    expect(html).toContain('Generate Insight Report');
    expect(html).toContain('/analytics/insight-report');
  });
});
