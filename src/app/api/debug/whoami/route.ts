import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getServerSession(authOptions);
  return NextResponse.json({
    authenticated: !!s,
    user: s?.user ?? null,
    medicoId: (s?.user as any)?.medicoId ?? null,
    role: (s?.user as any)?.role ?? null,
  });
}
