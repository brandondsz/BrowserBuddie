import type { DailyData } from "../types/storage";
import { getSupabaseClient, type DailyDataRow } from "../config/supabase";

/**
 * Sync all daily data to Supabase
 * This will push all dailyData entries to the database
 */
export async function syncDailyDataToSupabase(): Promise<{
  success: boolean;
  synced: number;
  error?: string;
}> {
  try {
    // Get dailyData from local storage
    const { dailyData = {} } = (await chrome.storage.local.get("dailyData")) as {
      dailyData?: DailyData;
    };

    if (Object.keys(dailyData).length === 0) {
      console.log("[Sync] No daily data to sync");
      return { success: true, synced: 0 };
    }

    // Transform dailyData into rows for Supabase
    const rows: DailyDataRow[] = [];
    for (const [date, domains] of Object.entries(dailyData)) {
      for (const [domain, milliseconds] of Object.entries(domains)) {
        // Skip invalid domains
        if (domain === "null" || domain === "undefined") continue;

        rows.push({
          date,
          domain,
          milliseconds,
        });
      }
    }

    if (rows.length === 0) {
      console.log("[Sync] No valid data to sync");
      return { success: true, synced: 0 };
    }

    console.log(`[Sync] Syncing ${rows.length} rows to Supabase...`);

    // Push to Supabase using upsert (will update if date+domain already exists)
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("daily_data").upsert(rows, {
      onConflict: "date,domain",
    });

    if (error) {
      console.error("[Sync] Supabase error:", error);
      return {
        success: false,
        synced: 0,
        error: error.message,
      };
    }

    console.log(`[Sync] Successfully synced ${rows.length} rows`);
    return { success: true, synced: rows.length };
  } catch (error) {
    console.error("[Sync] Unexpected error:", error);
    return {
      success: false,
      synced: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Sync only today's data to Supabase
 * Useful for incremental syncing throughout the day
 */
export async function syncTodayToSupabase(todayKey: string): Promise<{
  success: boolean;
  synced: number;
  error?: string;
}> {
  try {
    const { dailyData = {} } = (await chrome.storage.local.get("dailyData")) as {
      dailyData?: DailyData;
    };

    const todayData = dailyData[todayKey];
    if (!todayData || Object.keys(todayData).length === 0) {
      console.log("[Sync] No data for today to sync");
      return { success: true, synced: 0 };
    }

    const rows: DailyDataRow[] = [];
    for (const [domain, milliseconds] of Object.entries(todayData)) {
      if (domain === "null" || domain === "undefined") continue;

      rows.push({
        date: todayKey,
        domain,
        milliseconds,
      });
    }

    if (rows.length === 0) {
      return { success: true, synced: 0 };
    }

    console.log(`[Sync] Syncing ${rows.length} rows for ${todayKey}...`);

    const supabase = getSupabaseClient();
    const { error } = await supabase.from("daily_data").upsert(rows, {
      onConflict: "date,domain",
    });

    if (error) {
      console.error("[Sync] Supabase error:", error);
      return {
        success: false,
        synced: 0,
        error: error.message,
      };
    }

    console.log(`[Sync] Successfully synced ${rows.length} rows for today`);
    return { success: true, synced: rows.length };
  } catch (error) {
    console.error("[Sync] Unexpected error:", error);
    return {
      success: false,
      synced: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
