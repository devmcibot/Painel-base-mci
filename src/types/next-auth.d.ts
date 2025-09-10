import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: "ADMIN" | "MEDICO";
      status?: "ACTIVE" | "BLOCKED";
      medicoId?: number | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "ADMIN" | "MEDICO";
    status?: "ACTIVE" | "BLOCKED";
    medicoId?: number | null;
  }
}
