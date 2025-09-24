export interface NormalizedActivitySample {
  t: number;
  heartRate?: number | null;
  cadence?: number | null;
  power?: number | null;
  speed?: number | null;
  elevation?: number | null;
}

export interface NormalizedActivity {
  source: string;
  startTime: Date;
  durationSec: number;
  sampleRateHz?: number | null;
  samples: NormalizedActivitySample[];
}
