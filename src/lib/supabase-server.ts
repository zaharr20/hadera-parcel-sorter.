import "server-only";
import { createClient } from "@supabase/supabase-js";

// Explains in Hebrew what is wrong with the server settings, without revealing the values.
export function configProblem(): string | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  const missing = [!url && "SUPABASE_URL", !key && "SUPABASE_SECRET_KEY"].filter(Boolean);
  if (missing.length) return `חסר משתנה בהגדרות השרת: ${missing.join(", ")}`;
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url!)) {
    return "הערך של SUPABASE_URL לא תקין — צריך להיות בדיוק https://ekflgxwpuoyjomzxmvve.supabase.co";
  }
  if (key!.startsWith("sb_publishable_")) {
    return "SUPABASE_SECRET_KEY מכיל את המפתח הציבורי (sb_publishable_). צריך את ה-Secret key שמתחיל ב-sb_secret_";
  }
  return null;
}

export function supabaseServer() {
  const problem = configProblem();
  if (problem) throw new Error(problem);
  return createClient(process.env.SUPABASE_URL!.trim(), process.env.SUPABASE_SECRET_KEY!.trim(), {
    auth: { persistSession: false },
  });
}
