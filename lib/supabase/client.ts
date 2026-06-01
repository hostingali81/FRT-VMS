import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseBrowserConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey && !supabaseAnonKey.includes("replace-with"));
}

export function createBrowserSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase browser env vars are missing");
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
