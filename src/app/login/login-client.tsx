"use client";

import { LogIn, LogOut, Mail, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useFavorites } from "@/components/favorites-provider";

type LocalUser = {
  email: string;
  name: string | null;
};

export function LoginClient() {
  const { clearFavorites, refreshFavorites } = useFavorites();
  const [user, setUser] = useState<LocalUser | null>(null);
  const [email, setEmail] = useState("buyer@example.com");
  const [name, setName] = useState("看房用户");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadSession() {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const payload = (await response.json()) as { user: LocalUser | null };
      setUser(payload.user);
    }

    loadSession();
  }, []);

  async function login() {
    setIsSubmitting(true);
    setMessage("");

    try {
      const nextPath = new URLSearchParams(window.location.search).get("next");
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      if (nextPath?.startsWith("/")) {
        callbackUrl.searchParams.set("next", nextPath);
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          redirectTo: callbackUrl.toString(),
        }),
      });
      const payload = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "登录邮件发送失败，请稍后再试。");
        return;
      }

      setMessage(payload.message ?? "登录链接已发送，请打开邮箱完成登录。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    clearFavorites();
  }

  async function refreshSession() {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    const payload = (await response.json()) as { user: LocalUser | null };
    setUser(payload.user);
    await refreshFavorites();
  }

  return (
    <div className="glass-panel mx-auto max-w-xl rounded-2xl p-6 sm:p-8">
      <div className="mx-auto grid size-14 place-items-center rounded-xl bg-mist text-jade">
        <UserRound size={26} />
      </div>
      {user ? (
        <div className="mt-6 text-center">
          <h2 className="text-2xl font-bold text-ink">已登录</h2>
          <p className="mt-2 text-sm leading-6 text-ink/62">
            当前用户：{user.name ?? "看房用户"} · {user.email}
          </p>
          <button
            type="button"
            onClick={logout}
            className="focus-ring mt-6 inline-flex items-center gap-2 rounded-lg border border-ink/12 bg-white px-5 py-2 text-sm font-bold text-ink"
          >
            <LogOut size={16} />
            退出登录
          </button>
        </div>
      ) : (
        <div className="mt-6">
          <h2 className="text-center text-2xl font-bold text-ink">邮箱登录</h2>
          <p className="mt-2 text-center text-sm leading-6 text-ink/62">
            输入邮箱后会收到 Supabase 发送的登录链接，打开链接后收藏会绑定到你的正式账号。
          </p>
          <label className="mt-6 block text-sm font-bold text-ink/70">
            昵称
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="focus-ring mt-2 w-full rounded-lg border border-ink/12 bg-white px-4 py-3 text-ink"
            />
          </label>
          <label className="mt-4 block text-sm font-bold text-ink/70">
            邮箱
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="focus-ring mt-2 w-full rounded-lg border border-ink/12 bg-white px-4 py-3 text-ink"
            />
          </label>
          <button
            type="button"
            onClick={login}
            disabled={isSubmitting}
            className="focus-ring mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-bold text-pearl disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Mail size={16} />
            {isSubmitting ? "发送中..." : "发送登录链接"}
          </button>
          <button
            type="button"
            onClick={refreshSession}
            className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-ink/12 bg-white px-5 py-3 text-sm font-bold text-ink"
          >
            <LogIn size={16} />
            我已完成邮箱登录，刷新状态
          </button>
          {message ? <p className="mt-3 text-sm font-bold text-[#8a5313]">{message}</p> : null}
        </div>
      )}
    </div>
  );
}
