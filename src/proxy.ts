import { NextResponse, type NextRequest } from "next/server";

// Personal tool: one password protects every page and API route (HTTP Basic Auth).
// The phone's browser asks once and remembers it. Any user name works.
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    return new NextResponse("APP_PASSWORD לא הוגדר בשרת — הגישה חסומה.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (given === password) return NextResponse.next();
  }

  return new NextResponse("נדרשת סיסמה", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="parcel-sorter", charset="UTF-8"',
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
