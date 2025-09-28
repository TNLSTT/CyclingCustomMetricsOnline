export type PeakPowerDurationKey = '60' | '300' | '1200' | '3600';

export interface MovingAverageDay {
  date: string;
  totalKj: number;
  bestPower: Record<PeakPowerDurationKey, number | null>;
}

export interface MovingAveragesResponse {
  days: MovingAverageDay[];
}
