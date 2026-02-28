const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/** Format milliseconds into a human-readable string (e.g. "2h 15m", "45s") */
export function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < SECONDS_PER_MINUTE) return `${totalSec}s`;

  const hours = Math.floor(totalSec / SECONDS_PER_HOUR);
  const mins = Math.floor((totalSec % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = totalSec % SECONDS_PER_MINUTE;

  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${secs}s`;
}

/** Return today's date as an ISO date string (YYYY-MM-DD) */
export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
