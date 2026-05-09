import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  let authUser;

  try {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    authUser = result.data.user;
  } catch {
    return null;
  }

  if (!authUser?.email) {
    return null;
  }

  const email = normalizeEmail(authUser.email);
  const name =
    typeof authUser.user_metadata?.name === "string"
      ? authUser.user_metadata.name
      : null;

  const existingAuthUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true },
  });

  if (!existingAuthUser) {
    const legacyUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (legacyUser && legacyUser.id !== authUser.id) {
      await prisma.user.update({
        where: { id: legacyUser.id },
        data: { id: authUser.id, email, name },
      });
    }
  }

  return prisma.user.upsert({
    where: { id: authUser.id },
    update: { email, name },
    create: { id: authUser.id, email, name },
    select: { id: true, email: true, name: true },
  });
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
