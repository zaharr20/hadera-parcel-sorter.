import { NextResponse } from "next/server";
import { connection } from "next/server";

// Diagnostics behind the app password: reports which settings exist, never their values.
export async function GET() {
  await connection();
  const expected = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "APP_PASSWORD", "GOOGLE_MAPS_API_KEY"];
  const present = Object.fromEntries(expected.map((k) => [k, Boolean(process.env[k]?.trim())]));
  // Names (not values) that look like a mistyped Google key, e.g. a trailing space or a missing S.
  const lookalikes = Object.keys(process.env).filter(
    (k) => /GOOGLE|MAPS|API_KEY/i.test(k) && !expected.includes(k),
  );
  return NextResponse.json({
    present,
    lookalikes,
    googleKeyShape: process.env.GOOGLE_MAPS_API_KEY?.trim().startsWith("AIza") ?? false,
    env: process.env.VERCEL_ENV ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  });
}
