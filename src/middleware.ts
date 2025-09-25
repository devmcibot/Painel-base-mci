// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

type Role = "ADMIN" | "MEDICO" | "MÉDICO";
type TokenShape = {
  role?: Role | null;
  status?: "ACTIVE" | "BLOCKED" | string | null;
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = (await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })) as TokenShape | null;

  const needsAuth = pathname.startsWith("/admin") || pathname.startsWith("/medico");

  if (!token && needsAuth) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (token) {
    const role = token.role ?? null;

    if (pathname.startsWith("/admin") && role !== "ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/medico";
      return NextResponse.redirect(url);
    }

    const isMedicoRole = role === "MEDICO" || role === "MÉDICO";
    if (pathname.startsWith("/medico") && !isMedicoRole) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = role === "ADMIN" ? "/admin" : "/medico";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*", "/medico/:path*"],
};
