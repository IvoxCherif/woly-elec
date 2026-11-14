import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, sessionSecret, verifySessionToken } from "@/lib/admin-session";

/** Toute page /admin (sauf /admin/login) exige une session administrateur valide. */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const secret = sessionSecret();
  const ok = secret ? await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value, secret) : false;
  if (ok) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
