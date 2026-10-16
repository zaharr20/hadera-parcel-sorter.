import "server-only";
import { createClient } from "@supabase/supabase-js";

// Accepts the common ways the project address gets pasted: with or without https://,
// with an extra path (/rest/v1), or a dashboard link (supabase.com/dashboard/project/<ref>).
export function normalizeSupabaseUrl(raw: string | undefined): string | null {
  const v = (raw ?? "").trim().replace(/^["']|["']$/g, "");
  const ref =
    v.match(/([a-z0-9]{20})\.supabase\.co/i)?.[1] ??
    v.match(/dashboard\/project\/([a-z0-9]{20})/i)?.[1] ??
    (/^[a-z0-9]{20}$/i.test(v) ? v : null);
  return ref ? `https://${ref.toLowerCase()}.supabase.co` : null;
}

// Explains in Hebrew what is wrong with the server settings, without revealing the values.
export function configProblem(): string | null {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  const missing = [!rawUrl && "SUPABASE_URL", !key && "SUPABASE_SECRET_KEY"].filter(Boolean);
  if (missing.length) return `חסר משתנה בהגדרות השרת: ${missing.join(", ")}`;
  if (rawUrl!.startsWith("sb_") || rawUrl!.startsWith("eyJ")) {
    return "בשדה SUPABASE_URL הודבק מפתח במקום כתובת. צריך: https://ekflgxwpuoyjomzxmvve.supabase.co";
  }
  if (!normalizeSupabaseUrl(rawUrl)) {
    return `הערך של SUPABASE_URL לא תקין (מתחיל ב: "${rawUrl!.slice(0, 12)}…") — צריך להיות https://ekflgxwpuoyjomzxmvve.supabase.co`;
  }
  if (key!.startsWith("sb_publishable_")) {
    return "SUPABASE_SECRET_KEY מכיל את המפתח הציבורי (sb_publishable_). צריך את ה-Secret key שמתחיל ב-sb_secret_";
  }
  return null;
}

export function supabaseServer() {
  const problem = configProblem();
  if (problem) throw new Error(problem);
  return createClient(normalizeSupabaseUrl(process.env.SUPABASE_URL)!, process.env.SUPABASE_SECRET_KEY!.trim(), {
    auth: { persistSession: false },
  });
}
