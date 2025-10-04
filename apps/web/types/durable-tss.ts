export interface DurableTssRide {
  activityId: string;
  startTime: string;
  source: string;
  totalKj: number | null;
  postThresholdKj: number | null;
  postThresholdDurationSec: number | null;
  durableTss: number | null;
}

export interface DurableTssFilters {
  thresholdKj: number;
  startDate?: string;
  endDate?: string;
}

export interface DurableTssResponse {
  ftpWatts: number | null;
  thresholdKj: number;
  filters: DurableTssFilters;
  rides: DurableTssRide[];
}
