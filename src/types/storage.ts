/** All-time totals: domain → cumulative milliseconds */
export type TimeData = Record<string, number>;

/** Daily totals: ISO date key → { domain → milliseconds } */
export type DailyData = Record<string, Record<string, number>>;

/** Persisted worker state so we can resume tracking after SW restarts */
export interface WorkerState {
  activeTabId: number | null;
  activeDomain: string | null;
  activeStart: number | null;
}

/** Compact summary for a single day */
export interface DailySummary {
  totalMs: number;
  sites: number;
  topSite: string | null;
  topSiteMs: number;
}

/** ISO date key → summary */
export type DailySummaries = Record<string, DailySummary>;

/** Shape of what we store in chrome.storage.local */
export interface StorageSchema {
  timeData: TimeData;
  dailyData: DailyData;
  dailySummaries: DailySummaries;
  _state: WorkerState;
}
