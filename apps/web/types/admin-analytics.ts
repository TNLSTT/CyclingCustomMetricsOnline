export type SignupSparklinePoint = { date: string; count: number };

export type SignupFunnelStep = { label: 'D0' | 'D1' | 'D7'; count: number; conversion: number };

export type AdminAnalyticsOverview = {
  generatedAt: string;
  acquisition: {
    newSignups: {
      daily: SignupSparklinePoint[];
      average7d: number;
      average30d: number;
    };
    signupToFirstUpload: {
      totalSignups: number;
      usersWithUpload: number;
      reachedWithin24h: number;
      reachedWithin7d: number;
      conversion24h: number;
      conversion7d: number;
      steps: SignupFunnelStep[];
    };
    timeToFirstValue: { label: string; count: number }[];
    signupsBySource: { source: string; count: number; percentage: number }[];
  };
  engagement: {
    activeUsers: {
      current: {
        dau: number;
        wau: number;
        mau: number;
        stickiness: number;
      };
      series: {
        date: string;
        dau: number;
        wau: number;
        mau: number;
        stickiness: number;
      }[];
    };
    retentionCohorts: {
      cohort: string;
      size: number;
      retention: { label: string; value: number }[];
    }[];
    returningUsers: {
      userId: string;
      email: string;
      activeDays: number;
      activityCount: number;
    }[];
    sessions: {
      averageSessionsPerUser: number;
      medianSessionMinutes: number;
      totalSessions: number;
      windowDays: number;
    };
  };
  usage: {
    uploadsPerDay: { date: string; success: number; failed: number }[];
    uploadsPerUser: { userId: string; email: string; success: number; failed: number }[];
    recompute: {
      daily: { date: string; count: number; uniqueUsers: number }[];
      topUsers: { userId: string; email: string; count: number; lastRunAt: string | null }[];
    };
    topActivities: {
      activityId: string;
      title: string | null;
      owner: string;
      views: number;
      window: '7d' | '30d';
    }[];
    metricCoverage: {
      metricKey: string;
      metricName: string;
      coverage: number;
      totalActivities: number;
    }[];
  };
  quality: {
    parseFailures: { errorCode: string; count: number; percentage: number }[];
    latency: {
      upload: { p50: number; p95: number; p99: number; series: { date: string; p95: number }[] };
      recompute: { p50: number; p95: number; p99: number; series: { date: string; p95: number }[] };
    };
    retry: { retryRate: number; meanRetries: number; sampleSize: number };
    badData: { userId: string; email: string; failureRate: number; totalUploads: number }[];
  };
  performance: {
    db: {
      method: string;
      path: string;
      avgDurationMs: number;
      avgQueryCount: number;
      avgQueryDurationMs: number;
      requestCount: number;
    }[];
    storage: {
      uploadsDirBytes: number;
      postgresBytes: number | null;
      sevenDaySlopeBytesPerDay: number;
      dailyTotals: { date: string; bytes: number }[];
    };
    recomputeCost: {
      totalMinutes: number;
      estimatedUsd: number;
      dailyMinutes: { date: string; minutes: number }[];
    };
  };
  cohorts: {
    devices: { device: string; count: number; percentage: number; window: '7d' | '30d' }[];
    userSegments: {
      label: string;
      count: number;
      centroid: { uploads: number; views: number; recomputes: number };
      sample: { userId: string; email: string }[];
    }[];
    geo: { country: string; count: number; percentage: number }[];
  };
  conversion: {
    funnel: { step: string; currentCount: number; previousWeekCount: number }[];
    activation: { cohort: string; activationRate: number; cohortSize: number }[];
  };
  reliability: {
    availability: {
      current: number;
      errorRatio: number;
      burnRate: number;
      series: { timestamp: string; availability: number; total: number; errors: number }[];
    };
    queue: { depth: number; oldestMinutes: number | null };
    exceptions: { name: string; count: number; sampleStack: string | null }[];
  };
  safety: {
    suspicious: { userId: string; email: string; uploads: number; windowStart: string }[];
    storage: { orphanCount: number; dbActivityCount: number; scannedAt: string };
  };
  ux: {
    featureClicks: { feature: string; count: number; percentage: number }[];
    emptyStates: { rate: number; totalSessions: number; emptySessions: number };
  };
  alerts: {
    banners: { type: 'latency' | 'quality'; message: string }[];
  };
};
