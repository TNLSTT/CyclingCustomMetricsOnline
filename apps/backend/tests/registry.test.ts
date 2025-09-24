import { describe, expect, it } from 'vitest';

import { listMetricDefinitions, metricRegistry } from '../src/metrics/registry.js';

describe('metric registry', () => {
  it('includes hcsr metric and stubs for future metrics', () => {
    expect(metricRegistry).toHaveProperty('hcsr');
    expect(metricRegistry).toHaveProperty('tvi');
    expect(metricRegistry).toHaveProperty('whr-efficiency');

    const definitions = listMetricDefinitions();
    const keys = definitions.map((definition) => definition.key);
    expect(keys).toContain('hcsr');
    expect(keys).toContain('tvi');
    expect(keys).toContain('whr-efficiency');
  });
});
