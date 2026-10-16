import { NextResponse } from "next/server";
import { AUTH_COOKIE, safeEqual, tokenFor } from "@/lib/auth-token";

export async function POST(request: Request) {
  const fd = await request.formData();
  const given = String(fd.get("password") ?? "");
  const password = process.env.APP_PASSWORD;

  if (!password || !safeEqual(await tokenFor(given), await tokenFor(password))) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  const res = NextResponse.redirect(new URL("/", request.url), 303);
  res.cookies.set(AUTH_COOKIE, await tokenFor(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return res;
}
