import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

const USER_PROTECTED_PREFIXES = ["/user", "/kyc"];
const ADMIN_PROTECTED_PREFIXES = ["/admin"];
// /admin/login is the entry point and must stay public
const ADMIN_PUBLIC_PATHS = ["/admin/login"];

const API_USER_PREFIXES = ["/api/kyc"];
const API_ADMIN_PREFIXES = ["/api/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminPublic = ADMIN_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isAdminProtected =
    !isAdminPublic && ADMIN_PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isUserProtected = USER_PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isApiAdmin = API_ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  const isApiUser = API_USER_PREFIXES.some((p) => pathname.startsWith(p));

  if (!isAdminProtected && !isUserProtected && !isApiAdmin && !isApiUser) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isApi = pathname.startsWith("/api");

  if (!session) {
    if (isApi) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const loginPath = isAdminProtected ? "/admin/login" : "/login";
    const url = req.nextUrl.clone();
    url.pathname = loginPath;
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const needsAdmin = isAdminProtected || isApiAdmin;
  if (needsAdmin && session.role !== "ADMIN") {
    if (isApi) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/user/:path*", "/kyc/:path*", "/admin/:path*", "/api/kyc/:path*", "/api/admin/:path*"],
};
