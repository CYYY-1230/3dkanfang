import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/session";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    email?: string;
    name?: string;
    redirectTo?: string;
  };
  const email = normalizeEmail(payload.email ?? "");
  const name = payload.name?.trim() || "看房用户";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "请输入有效邮箱。" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const redirectTo = payload.redirectTo?.startsWith(origin)
    ? payload.redirectTo
    : `${origin}/auth/callback`;
  let error;

  try {
    const supabase = await createClient();
    const result = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        data: { name },
      },
    });
    error = result.error;
  } catch (supabaseError) {
    return NextResponse.json(
      {
        error:
          supabaseError instanceof Error
            ? supabaseError.message
            : "Supabase Auth 尚未配置。",
      },
      { status: 500 },
    );
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "登录链接已发送，请打开邮箱完成登录。",
  });
}
