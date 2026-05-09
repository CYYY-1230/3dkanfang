import { Building2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-[calc(100dvh-72px)] px-4 py-10 sm:px-6 lg:px-8 2xl:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white/78 px-4 py-3 text-sm font-bold text-ink shadow-soft">
          <span className="grid size-9 place-items-center rounded-lg bg-mist text-jade">
            <Building2 size={18} />
          </span>
          正在加载页面
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="h-[520px] animate-pulse rounded-2xl bg-ink/10" />
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-xl bg-ink/10" />
            <div className="h-36 animate-pulse rounded-xl bg-ink/10" />
            <div className="h-36 animate-pulse rounded-xl bg-ink/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
