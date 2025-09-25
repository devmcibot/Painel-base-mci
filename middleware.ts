// middleware.ts
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const isPrivate = url.pathname.startsWith("/admin") || url.pathname.startsWith("/medico");

  // precisa estar logado para áreas privadas
  if (isPrivate && !token) {
    const loginUrl = new URL("/", req.url);
    loginUrl.searchParams.set("callbackUrl", url.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // se bloqueado, joga pra /bloqueado
  if (token?.status === "BLOCKED") {
    const b = new URL("/bloqueado", req.url);
    return NextResponse.redirect(b);
  }

  // rota admin só para ADMIN
  if (url.pathname.startsWith("/admin") && token?.role !== "ADMIN") {
    const m = new URL("/medico", req.url);
    return NextResponse.redirect(m);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/medico/:path*"],
};
