export type WeightPeriod = 'morning' | 'evening';

export interface WeightRecord {
  id: string;
  userId: string;
  date: string;
  period: WeightPeriod;
  weight: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
  weightDiff?: number | null;
}

export interface WeightStats {
  avgMorningWeight: number | null;
  avgEveningWeight: number | null;
  minWeight: number | null;
  maxWeight: number | null;
  change: number | null;
  avgWeightDiff: number | null;
}

export interface ApiResponse<T> {
  items: T[];
  total: number;
}