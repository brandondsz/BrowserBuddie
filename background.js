let activeTabId = null;
let activeDomain = null;
let activeStart = null;

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function flushTime() {
  if (!activeDomain || !activeStart) return;

  const elapsed = Date.now() - activeStart;
  activeStart = Date.now();

  if (elapsed < 500) return; // ignore trivial durations

  const { timeData = {}, dailyData = {} } = await chrome.storage.local.get(["timeData", "dailyData"]);

  // All-time totals
  timeData[activeDomain] = (timeData[activeDomain] || 0) + elapsed;

  // Daily totals
  const todayKey = new Date().toISOString().slice(0, 10);
  if (!dailyData[todayKey]) dailyData[todayKey] = {};
  dailyData[todayKey][activeDomain] = (dailyData[todayKey][activeDomain] || 0) + elapsed;

  // Prune daily data older than 30 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  for (const key of Object.keys(dailyData)) {
    if (key < cutoffKey) delete dailyData[key];
  }

  await chrome.storage.local.set({ timeData, dailyData });
}

async function switchTo(tabId) {
  await flushTime();

  if (!tabId) {
    activeDomain = null;
    activeTabId = null;
    activeStart = null;
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
}

// Track tab activation
chrome.tabs.onActivated.addListener(({ tabId }) => {
  switchTo(tabId);
});

// Track navigation within the active tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === activeTabId && changeInfo.url) {
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
    if (tabs.length > 0) {
      switchTo(tabs[0].id);
    }
  });
});

// Pause tracking when user goes idle (2 minutes)
chrome.idle.setDetectionInterval(120);
chrome.idle.onStateChanged.addListener((state) => {
  if (state === "active") {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs.length > 0) switchTo(tabs[0].id);
    });
  } else {
    switchTo(null);
  }
});

// Periodic flush every 30s so data isn't lost if the service worker dies
setInterval(flushTime, 30_000);

// Initialize on startup
chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
  if (tabs.length > 0) switchTo(tabs[0].id);
});
