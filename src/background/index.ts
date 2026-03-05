import { flushTime, getActiveTabId, restoreState, switchTo } from "./tracker";
import { syncDailyDataToSupabase } from "../services/sync";
import { getTodayKey } from "../utils/time";

/** Periodic flush interval (ms) so data isn't lost if the SW dies */
const FLUSH_INTERVAL_MS = 30_000;

/** Idle detection threshold in seconds (5 min — generous enough for video/reading) */
const IDLE_DETECTION_SECONDS = 300;

/** Alarm name for daily sync */
const DAILY_SYNC_ALARM = "daily-sync";

// ---- Chrome event listeners ----

// Track tab activation
chrome.tabs.onActivated.addListener(({ tabId }) => {
  switchTo(tabId);
});

// Track navigation within the active tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === getActiveTabId() && changeInfo.url) {
    switchTo(tabId);
  }
});

// Track window focus changes
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    switchTo(null);
    return;
  }
  chrome.tabs.query({ active: true, windowId }, (tabs) => {
    if (tabs.length > 0 && tabs[0].id != null) {
      switchTo(tabs[0].id);
    }
  });
});

// Pause tracking when user goes idle
chrome.idle.setDetectionInterval(IDLE_DETECTION_SECONDS);
chrome.idle.onStateChanged.addListener((state) => {
  if (state === "active") {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id != null) {
        switchTo(tabs[0].id);
      }
    });
  } else {
    switchTo(null);
  }
});

// Periodic flush
setInterval(flushTime, FLUSH_INTERVAL_MS);

// ---- Daily Sync to Supabase ----

/** Set up daily alarm for syncing data to Supabase */
async function setupDailySync(): Promise<void> {
  // Create an alarm that fires daily at midnight
  await chrome.alarms.create(DAILY_SYNC_ALARM, {
    when: getNextMidnight(),
    periodInMinutes: 24 * 60, // Repeat every 24 hours
  });

  console.log("[Sync] Daily sync alarm created");
}

/** Get timestamp for next midnight (local time) */
function getNextMidnight(): number {
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0, 0
  );
  return midnight.getTime();
}

/** Handle alarm events */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === DAILY_SYNC_ALARM) {
    console.log("[Sync] Daily sync alarm triggered");
    const result = await syncDailyDataToSupabase();
    if (result.success) {
      console.log(`[Sync] Successfully synced ${result.synced} rows to Supabase`);
    } else {
      console.error(`[Sync] Failed to sync: ${result.error}`);
    }
  }
});

// Initialize: restore state, flush stale time, then sync with current tab
restoreState().then(() => {
  flushTime().then(() => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id != null) {
        switchTo(tabs[0].id);
      }
    });
  });

  // Set up daily sync alarm
  setupDailySync();
});
