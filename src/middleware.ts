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

  // Lê o token do NextAuth (JWT) com tipagem segura
  const token = (await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })) as TokenShape | null;

  // Áreas privadas
  const needsAuth = pathname.startsWith("/admin") || pathname.startsWith("/medico");

  // Sem login tentando acessar área privada -> /login (com callback opcional)
  if (!token && needsAuth) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Se logado, aplica regras por papel
  if (token) {
    const role = token.role ?? null;

    // /admin só para ADMIN
    if (pathname.startsWith("/admin") && role !== "ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/medico";
      return NextResponse.redirect(url);
    }

    // /medico só para MÉDICO (aceita "MEDICO" sem acento também)
    const isMedicoRole = role === "MÉDICO" || role === "MEDICO";
    if (pathname.startsWith("/medico") && !isMedicoRole) {
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

// Importante: não intercepta /login, /api/auth, /_next, etc.
// Mantém a sua regra de pegar "/" para redirecionar para o painel
export const config = {
  matcher: ["/", "/admin/:path*", "/medico/:path*"],
};
