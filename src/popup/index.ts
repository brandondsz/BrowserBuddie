import type { DailyData, DailySummaries, TimeData } from "../types/storage";
import { faviconUrl } from "../utils/domain";
import { formatTime, getTodayKey } from "../utils/time";

const periodEl = document.getElementById("period") as HTMLSelectElement;
const totalLabel = document.getElementById("totalLabel")!;
const totalTime = document.getElementById("totalTime")!;
const list = document.getElementById("siteList")!;
const backBtn = document.getElementById("backBtn")!;

/** When set, we're drilling into a specific day from the history view */
let drillDate: string | null = null;

// ---- Rendering helpers ----

function renderSiteList(data: Record<string, number>): void {
  const entries = Object.entries(data)
    .filter(([d]) => d !== "null" && d !== "undefined")
    .map(([domain, ms]) => ({ domain, ms }))
    .sort((a, b) => b.ms - a.ms);

  const totalMs = entries.reduce((sum, e) => sum + e.ms, 0);
  const maxMs = entries.length > 0 ? entries[0].ms : 1;

  totalTime.textContent = formatTime(totalMs);

  if (entries.length === 0) {
    list.innerHTML = '<div class="empty">No browsing data yet. Start browsing!</div>';
    return;
  }

  list.innerHTML = entries
    .map(
      (e, i) => `
    <div class="site-row">
      <div class="rank">${i + 1}</div>
      <img class="favicon" src="${faviconUrl(e.domain)}" alt="">
      <div class="site-info">
        <div class="site-domain">${e.domain}</div>
        <div class="site-bar-bg">
          <div class="site-bar-fill" style="width: ${((e.ms / maxMs) * 100).toFixed(1)}%"></div>
        </div>
      </div>
      <div class="site-time">${formatTime(e.ms)}</div>
    </div>
  `,
    )
    .join("");
}

function formatDateLabel(isoDate: string): string {
  const today = getTodayKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  if (isoDate === today) return "Today";
  if (isoDate === yesterdayKey) return "Yesterday";

  const d = new Date(isoDate + "T00:00:00");
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  return `${weekday}, ${month} ${day}`;
}

function renderHistory(summaries: DailySummaries): void {
  const days = Object.keys(summaries).sort((a, b) => (b > a ? 1 : -1));

  if (days.length === 0) {
    list.innerHTML = '<div class="empty">No history yet. Keep browsing!</div>';
    return;
  }

  const maxMs = Math.max(...days.map((d) => summaries[d].totalMs));

  list.innerHTML = days
    .map((date) => {
      const s = summaries[date];
      const pct = maxMs > 0 ? ((s.totalMs / maxMs) * 100).toFixed(1) : "0";
      const topLabel = s.topSite ?? "\u2014";
      return `
    <div class="history-row" data-date="${date}">
      <div class="history-date">
        ${formatDateLabel(date)}
      </div>
      <div class="history-meta">
        <div class="history-top">${topLabel}</div>
        <div class="site-bar-bg">
          <div class="site-bar-fill" style="width: ${pct}%"></div>
        </div>
        <div class="history-stats">
          <span>${s.sites} site${s.sites !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <div class="history-time">${formatTime(s.totalMs)}</div>
    </div>
  `;
    })
    .join("");
}

// ---- Main render ----

async function render(): Promise<void> {
  const period = periodEl.value;

  backBtn.classList.toggle("hidden", !drillDate);

  if (drillDate) {
    const { dailyData = {} } = (await chrome.storage.local.get("dailyData")) as {
      dailyData?: DailyData;
    };
    const data = dailyData[drillDate] ?? {};
    totalLabel.textContent = `${formatDateLabel(drillDate)}:`;
    renderSiteList(data);
    return;
  }

  if (period === "history") {
    const { dailySummaries = {} } = (await chrome.storage.local.get("dailySummaries")) as {
      dailySummaries?: DailySummaries;
    };
    const count = Object.keys(dailySummaries).length;
    totalLabel.textContent = "Days:";
    totalTime.textContent = `${count}`;
    renderHistory(dailySummaries);
    return;
  }

  totalLabel.textContent = "Total:";

  let data: Record<string, number>;

  if (period === "today") {
    const { dailyData = {} } = (await chrome.storage.local.get("dailyData")) as {
      dailyData?: DailyData;
    };
    data = dailyData[getTodayKey()] ?? {};
  } else {
    const { timeData = {} } = (await chrome.storage.local.get("timeData")) as {
      timeData?: TimeData;
    };
    data = timeData;
  }

  renderSiteList(data);
}

// ---- Event listeners ----

periodEl.addEventListener("change", () => {
  drillDate = null;
  render();
});

backBtn.addEventListener("click", () => {
  drillDate = null;
  periodEl.value = "history";
  render();
});

list.addEventListener("click", (e) => {
  const row = (e.target as HTMLElement).closest<HTMLElement>(".history-row");
  if (!row?.dataset.date) return;
  drillDate = row.dataset.date;
  render();
});

document.getElementById("clearBtn")!.addEventListener("click", async () => {
  if (confirm("Clear all tracking data?")) {
    await chrome.storage.local.clear();
    drillDate = null;
    render();
  }
});

render();
