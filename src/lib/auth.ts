import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        try {
          const existing = await prisma.user.findUnique({
            where: { email: user.email },
            select: { id: true },
          });
          if (!existing) {
            await prisma.user.create({
              data: { email: user.email, name: user.name ?? null, image: user.image ?? null },
            });
          }
        } catch {
          // DB error (e.g. missing columns) — still allow sign-in; user record will be created on next request
        }
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        if (token.id) {
          session.user.id = token.id as string;
        } else if (session.user.email) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: session.user.email },
              select: { id: true },
            });
            if (dbUser) session.user.id = dbUser.id;
          } catch {
            // ignore
          }
        }
      }
      return session;
    },
  },
});
