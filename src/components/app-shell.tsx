import Link from "next/link";
import { Building2, Heart, Map, UserRound } from "lucide-react";

const navItems = [
  { href: "/#map-search", label: "地图", icon: Map },
  { href: "/favorites", label: "收藏", icon: Heart },
  { href: "/login", label: "登录", icon: UserRound },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-ink/10 bg-[#fffcf7]/94 shadow-sm backdrop-blur-xl">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 lg:px-8 2xl:px-10">
          <Link href="/" className="focus-ring flex items-center gap-3 rounded-lg">
            <span className="grid size-10 place-items-center rounded-lg bg-jade text-white">
              <Building2 size={21} />
            </span>
            <span>
              <span className="block text-base font-bold leading-tight text-ink">
                3d-house-viewer
              </span>
              <span className="hidden text-xs text-ink/60 sm:block">
                地图找房 · 户型 · 模拟 VR 看房
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 rounded-lg border border-ink/10 bg-white/70 p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="focus-ring flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-ink/72 transition hover:bg-white hover:text-ink"
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-jade">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-4xl font-bold text-ink sm:text-5xl">{title}</h1>
      <p className="mt-4 text-base leading-7 text-ink/68 sm:text-lg">
        {description}
      </p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="glass-panel mx-auto max-w-2xl rounded-xl px-6 py-12 text-center">
      {icon ? (
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-lg bg-mist text-jade">
          {icon}
        </div>
      ) : null}
      <h2 className="text-2xl font-bold text-ink">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/64">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}
