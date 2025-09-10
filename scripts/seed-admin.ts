// scripts/seed-admin.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL!;
  const password = process.env.ADMIN_PASSWORD!;
  const name = process.env.ADMIN_NAME || "Administrador";

  if (!email || !password) {
    throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no .env antes de rodar o seed.");
  }

  const hash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { hashedPwd: hash, role: "ADMIN", status: "ACTIVE", name },
    create: { email, name, hashedPwd: hash, role: "ADMIN", status: "ACTIVE" },
  });

  console.log(`✅ Admin seed OK: ${email}`);
}

main()
  .catch((e) => {
    console.error("Seed falhou:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
