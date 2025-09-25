// src/types/next-auth.d.ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      medicoId?: number | null;
      role?: "ADMIN" | "MEDICO" | "MÉDICO";
    } & DefaultSession["user"];
  }
}
