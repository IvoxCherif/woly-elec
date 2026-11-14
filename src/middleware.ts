import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, sessionSecret, verifySessionToken } from "@/lib/admin-session";

/**
 * 1. www.wolyelec.com → wolyelec.com (adresse unique : Google n'accepte qu'une adresse de retour).
 * 2. Toute page /admin (sauf /admin/login) exige une session administrateur valide.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
  if (host.startsWith("www.")) return NextResponse.redirect(`https://${host.slice(4)}${pathname}${search}`, 308);

  if (!pathname.startsWith("/admin")) return NextResponse.next();
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

// Toutes les routes sauf les fichiers statiques de Next.js
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
