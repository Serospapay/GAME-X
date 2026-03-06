import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { fail } from "@/lib/api-response";

export async function requireAuth(): Promise<
  { session: Session; response: null } | { session: null; response: ReturnType<typeof fail> }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return {
      session: null,
      response: fail("Потрібна авторизація", 401, "UNAUTHORIZED"),
    };
  }
  return { session, response: null };
}

export async function requireAdmin(): Promise<
  { session: Session; response: null } | { session: null; response: ReturnType<typeof fail> }
> {
  const auth = await requireAuth();
  if (auth.response) return auth;

  if (!isAdmin(auth.session.user.email)) {
    return {
      session: null,
      response: fail("Доступ заборонено", 403, "FORBIDDEN"),
    };
  }

  return auth;
}
