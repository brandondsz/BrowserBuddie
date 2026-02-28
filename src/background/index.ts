import { flushTime, getActiveTabId, restoreState, switchTo } from "./tracker";

/** Periodic flush interval (ms) so data isn't lost if the SW dies */
const FLUSH_INTERVAL_MS = 30_000;

/** Idle detection threshold in seconds (5 min — generous enough for video/reading) */
const IDLE_DETECTION_SECONDS = 300;

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

// Initialize: restore state, flush stale time, then sync with current tab
restoreState().then(() => {
  flushTime().then(() => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id != null) {
        switchTo(tabs[0].id);
      }
    });
  });
});
