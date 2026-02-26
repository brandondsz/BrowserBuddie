function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${secs}s`;
}

function faviconUrl(domain) {
  return `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}`;
}

function isToday(timestamp) {
  const now = new Date();
  const d = new Date(timestamp);
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

async function render() {
  const period = document.getElementById("period").value;
  let data;

  if (period === "today") {
    const { dailyData = {} } = await chrome.storage.local.get("dailyData");
    const todayKey = new Date().toISOString().slice(0, 10);
    data = dailyData[todayKey] || {};
  } else {
    const { timeData = {} } = await chrome.storage.local.get("timeData");
    data = timeData;
  }

  const entries = Object.entries(data)
    .map(([domain, ms]) => ({ domain, ms }))
    .sort((a, b) => b.ms - a.ms);

  const totalMs = entries.reduce((sum, e) => sum + e.ms, 0);
  const maxMs = entries.length > 0 ? entries[0].ms : 1;

  document.getElementById("totalTime").textContent = formatTime(totalMs);

  const list = document.getElementById("siteList");

  if (entries.length === 0) {
    list.innerHTML = '<div class="empty">No browsing data yet. Start browsing!</div>';
    return;
  }

  list.innerHTML = entries.map((e, i) => `
    <div class="site-row">
      <div class="rank">${i + 1}</div>
      <img class="favicon" src="${faviconUrl(e.domain)}" alt="">
      <div class="site-info">
        <div class="site-domain">${e.domain}</div>
        <div class="site-bar-bg">
          <div class="site-bar-fill" style="width: ${(e.ms / maxMs * 100).toFixed(1)}%"></div>
        </div>
      </div>
      <div class="site-time">${formatTime(e.ms)}</div>
    </div>
  `).join("");
}

document.getElementById("period").addEventListener("change", render);

document.getElementById("clearBtn").addEventListener("click", async () => {
  if (confirm("Clear all tracking data?")) {
    await chrome.storage.local.clear();
    render();
  }
});

render();
