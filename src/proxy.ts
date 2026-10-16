import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, safeEqual, tokenFor } from "@/lib/auth-token";

// Personal tool: one password protects every page and API route.
// Signing in on /login sets a cookie that lasts 90 days on that device.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();

  const password = process.env.APP_PASSWORD;
  if (!password) {
    return new NextResponse("APP_PASSWORD לא הוגדר בשרת — הגישה חסומה.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const cookie = request.cookies.get(AUTH_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await tokenFor(password))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
