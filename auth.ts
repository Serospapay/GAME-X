import type { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import DiscordProvider from "next-auth/providers/discord";
import CredentialsProvider from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "@/lib/mongodb-adapter";
import { isAdmin } from "@/lib/admin";

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) {
  throw new Error(
    "AUTH_SECRET має бути встановлено в .env.local (мінімум 16 символів)"
  );
}

declare module "next-auth" {
  interface Session {
    user: { id: string; isAdmin?: boolean } & import("next-auth").DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isAdmin?: boolean;
  }
}

const hasGoogleProvider =
  Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET);
const hasDiscordProvider =
  Boolean(process.env.DISCORD_CLIENT_ID) && Boolean(process.env.DISCORD_CLIENT_SECRET);
const enableLocalCredentials =
  process.env.ENABLE_LOCAL_CREDENTIALS === "true" ||
  process.env.NODE_ENV !== "production";

const devAdminEmail = process.env.DEV_ADMIN_EMAIL ?? "admin@game-x.local";
const devAdminPassword = process.env.DEV_ADMIN_PASSWORD ?? "admin12345";
const devUserEmail = process.env.DEV_USER_EMAIL ?? "user@game-x.local";
const devUserPassword = process.env.DEV_USER_PASSWORD ?? "user12345";

const providers: NextAuthOptions["providers"] = [];

if (hasGoogleProvider) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    })
  );
}

if (hasDiscordProvider) {
  providers.push(
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
    })
  );
}

if (enableLocalCredentials) {
  providers.push(
    CredentialsProvider({
      name: "Local Dev Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        if (
          email === devAdminEmail.toLowerCase() &&
          password === devAdminPassword
        ) {
          return {
            id: "dev-admin-user",
            name: "Demo Admin",
            email: devAdminEmail,
          };
        }

        if (
          email === devUserEmail.toLowerCase() &&
          password === devUserPassword
        ) {
          return {
            id: "dev-regular-user",
            name: "Demo User",
            email: devUserEmail,
          };
        }

        return null;
      },
    })
  );
}

if (providers.length === 0) {
  throw new Error(
    "Не налаштовано жодного провайдера авторизації. Додайте OAuth ключі або увімкніть dev-режим."
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  adapter: MongoDBAdapter(clientPromise),
  providers,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? token.sub;
        token.isAdmin = isAdmin(user.email ?? undefined);
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? token.sub ?? "";
        session.user.isAdmin = Boolean(token.isAdmin);
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};
