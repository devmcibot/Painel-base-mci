import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(params.id);
  const { status } = await req.json(); // "ACTIVE" | "BLOCKED"
  if (!["ACTIVE", "BLOCKED"].includes(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { status },
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  return NextResponse.json(user);
}
