import { AppShell, PageIntro } from "@/components/app-shell";
import { LoginClient } from "./login-client";

export default function LoginPage() {
  return (
    <AppShell>
      <section className="w-full px-4 py-10 sm:px-6 lg:px-8 2xl:px-10">
        <PageIntro
          eyebrow="ACCOUNT"
          title="账号登录"
          description="使用 Supabase Auth 邮箱登录，收藏会跟随你的正式账号保存到服务器数据库。"
        />
        <div className="mt-8">
          <LoginClient />
        </div>
      </section>
    </AppShell>
  );
}
