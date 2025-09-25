import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // sem login e tentando acessar áreas privadas
  const needsAuth = pathname.startsWith("/admin") || pathname.startsWith("/medico");
  if (!token && needsAuth) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (token) {
    const role = (token as any).role as "ADMIN" | "MEDICO";

    // /admin só para ADMIN
    if (pathname.startsWith("/admin") && role !== "ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/medico";
      return NextResponse.redirect(url);
    }

    // /medico só para MEDICO
    if (pathname.startsWith("/medico") && role !== "MEDICO") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    // Home: manda para o painel certo
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
