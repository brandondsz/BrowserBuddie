import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase credentials are injected at build time from .env file
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client singleton
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

/**
 * Database schema type for the daily_data table
 * You'll need to create this table in Supabase with:
 *
 * CREATE TABLE daily_data (
 *   id BIGSERIAL PRIMARY KEY,
 *   date TEXT NOT NULL,
 *   domain TEXT NOT NULL,
 *   milliseconds BIGINT NOT NULL,
 *   synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   UNIQUE(date, domain)
 * );
 *
 * CREATE INDEX idx_daily_data_date ON daily_data(date);
 */
export interface DailyDataRow {
  id?: number;
  date: string;
  domain: string;
  milliseconds: number;
  synced_at?: string;
}
