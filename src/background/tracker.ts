import type { DailyData, DailySummaries, DailySummary, StorageSchema, TimeData, WorkerState } from "../types/storage";
import { getDomain } from "../utils/domain";
import { getTodayKey } from "../utils/time";

/** Ignore tracking intervals shorter than this */
const FLUSH_THRESHOLD_MS = 500;

/** Discard elapsed gaps larger than this (covers system sleep/hibernate) */
const MAX_TRACKABLE_ELAPSED_MS = 10 * 60 * 1000; // 10 minutes

/** Number of days of daily data to retain */
const DAILY_DATA_RETENTION_DAYS = 30;

// ---- In-memory tracking state ----
let activeTabId: number | null = null;
let activeDomain: string | null = null;
let activeStart: number | null = null;

/** Flush elapsed time for the current domain into storage */
export async function flushTime(): Promise<void> {
  // Snapshot state before any async work — a concurrent switchTo() can
  // mutate the module-level variables while we await storage.
  const domain = activeDomain;
  const start = activeStart;
  if (!domain || !start) return;

  const now = Date.now();
  const elapsed = now - start;
  activeStart = now;

  if (elapsed < FLUSH_THRESHOLD_MS) return;

  // If the gap is unreasonably large the system was likely asleep — discard.
  if (elapsed > MAX_TRACKABLE_ELAPSED_MS) return;

  const result = await chrome.storage.local.get(["timeData", "dailyData", "dailySummaries"]) as
    Pick<StorageSchema, "timeData" | "dailyData" | "dailySummaries">;

  const timeData: TimeData = result.timeData ?? {};
  const dailyData: DailyData = result.dailyData ?? {};
  const dailySummaries: DailySummaries = result.dailySummaries ?? {};

  // All-time totals (use snapshotted domain, not the module variable)
  timeData[domain] = (timeData[domain] ?? 0) + elapsed;

  // Daily totals
  const todayKey = getTodayKey();
  if (!dailyData[todayKey]) dailyData[todayKey] = {};
  dailyData[todayKey][domain] = (dailyData[todayKey][domain] ?? 0) + elapsed;

  // Update today's summary from the current daily breakdown
  dailySummaries[todayKey] = buildSummary(dailyData[todayKey]);

  // Prune daily data older than retention window
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAILY_DATA_RETENTION_DAYS);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  for (const key of Object.keys(dailyData)) {
    if (key < cutoffKey) delete dailyData[key];
  }

  // Persist data AND updated worker state together so activeStart stays
  // in sync with storage — prevents stale timestamps after SW restarts.
  await chrome.storage.local.set({
    timeData,
    dailyData,
    dailySummaries,
    _state: { activeTabId, activeDomain, activeStart } satisfies WorkerState,
  });
}

/** Persist tracking state so it survives service-worker restarts */
export async function saveState(): Promise<void> {
  await chrome.storage.local.set({
    _state: { activeTabId, activeDomain, activeStart } satisfies WorkerState,
  });
}

/** Restore tracking state from storage after SW restart */
export async function restoreState(): Promise<void> {
  const { _state } = await chrome.storage.local.get("_state") as
    Pick<StorageSchema, "_state">;

  if (_state?.activeDomain && _state.activeStart) {
    activeTabId = _state.activeTabId;
    activeDomain = _state.activeDomain;
    activeStart = _state.activeStart;
  }
}

/** Switch tracking to a new tab (or null to pause) */
export async function switchTo(tabId: number | null): Promise<void> {
  await flushTime();

  if (tabId == null) {
    activeDomain = null;
    activeTabId = null;
    activeStart = null;
    await saveState();
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    activeTabId = tabId;
    activeDomain = getDomain(tab.url);
    activeStart = activeDomain ? Date.now() : null;
  } catch {
    activeDomain = null;
    activeTabId = null;
    activeStart = null;
  }

  await saveState();
}

/** Return the current active tab ID (for comparison in event listeners) */
export function getActiveTabId(): number | null {
  return activeTabId;
}

/** Compute a compact summary from a day's domain → ms breakdown */
function buildSummary(dayData: Record<string, number>): DailySummary {
  const entries = Object.entries(dayData);
  let totalMs = 0;
  let topSite: string | null = null;
  let topSiteMs = 0;

  for (const [site, ms] of entries) {
    totalMs += ms;
    if (ms > topSiteMs) {
      topSite = site;
      topSiteMs = ms;
    }
  }

  return { totalMs, sites: entries.length, topSite, topSiteMs };
}
