import Link from "next/link";
import { Map } from "lucide-react";
import { AppShell, EmptyState } from "@/components/app-shell";

export default function NotFound() {
  return (
    <AppShell>
      <section className="px-4 py-16">
        <EmptyState
          icon={<Map size={22} />}
          title="没有找到这个页面"
          description="这个楼盘或户型可能不在当前测试数据里。"
          action={
            <Link
              href="/"
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2 text-sm font-bold text-pearl"
            >
              <Map size={16} />
              回到地图
            </Link>
          }
        />
      </section>
    </AppShell>
  );
}
