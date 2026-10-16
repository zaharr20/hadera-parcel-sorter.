import "server-only";
import { createClient } from "@supabase/supabase-js";

export function supabaseServer() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("חסרים SUPABASE_URL או SUPABASE_SECRET_KEY בקובץ .env.local");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
