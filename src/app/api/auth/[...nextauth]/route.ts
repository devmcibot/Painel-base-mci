// ... imports iguais
import NextAuth, { type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: "Login",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) return null;
        if (user.status === "BLOCKED") throw new Error("Usuário bloqueado pelo administrador.");
        const ok = await bcrypt.compare(credentials.password, user.hashedPwd);
        if (!ok) return null;

        const medico = await prisma.medico.findUnique({ where: { userId: user.id } });

        return {
          id: String(user.id),           // <— vamos propagar isso para o token
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          medicoId: medico?.id ?? null,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId  = (user as any).id ?? (user as any).userId ?? null;  // <—
        token.role    = (user as any).role;
        token.status  = (user as any).status;
        token.medicoId = (user as any).medicoId ?? null;
      }
      return token as any;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id       = (token as any).userId ?? null;     // <—
        (session.user as any).role     = (token as any).role;
        (session.user as any).status   = (token as any).status;
        (session.user as any).medicoId = (token as any).medicoId ?? null;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
