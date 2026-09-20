import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/supabase/database.types";

export function getSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase público não configurado.");
  }

  return createClient<Database>(url, key);
}
