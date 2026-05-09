import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Bath, Compass, Home, Maximize2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FavoriteButton } from "@/components/favorite-button";
import { getCommunityFloorPlan } from "@/lib/community-property";
import { getFloorPlan } from "@/lib/data";

export default async function FloorPlanDetailPage({
  params,
}: {
  params: Promise<{ floorPlanId: string }>;
}) {
  const { floorPlanId } = await params;
  const result = getFloorPlan(floorPlanId) ?? (await getCommunityFloorPlan(floorPlanId));

  if (!result) {
    notFound();
  }

  const { property, floorPlan } = result;

  return (
    <AppShell>
      <section className="w-full px-4 py-8 sm:px-6 lg:px-8 2xl:px-10">
        <Link
          href={`/properties/${property.id}`}
          className="focus-ring mb-5 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-bold text-ink/62 hover:text-ink"
        >
          <ArrowLeft size={16} />
          返回楼盘
        </Link>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-ink/10 bg-white/72 p-4 shadow-soft">
            <div className="relative aspect-[4/3] rounded-xl bg-pearl">
              <Image
                src={floorPlan.imageUrl}
                alt={`${floorPlan.name}户型图`}
                fill
                className="object-contain p-4"
                priority
              />
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-6 sm:p-8">
            <p className="text-sm font-bold text-jade">{property.name}</p>
            <h1 className="mt-3 text-4xl font-bold text-ink">{floorPlan.name}</h1>
            <p className="mt-4 text-base leading-7 text-ink/66">
              这张户型图是测试素材，目标是让普通用户能快速看清房间关系、动线和主要空间。
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Info icon={<Maximize2 size={18} />} label="面积" value={`${floorPlan.area} 平`} />
              <Info icon={<Home size={18} />} label="户型" value={floorPlan.layout} />
              <Info icon={<Compass size={18} />} label="朝向" value={floorPlan.orientation} />
              <Info icon={<Bath size={18} />} label="卫生间" value={`${floorPlan.bathrooms} 个`} />
            </div>

            <div className="mt-6">
              <h2 className="text-lg font-bold text-ink">户型亮点</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {floorPlan.highlights.map((highlight) => (
                  <span
                    key={highlight}
                    className="rounded-md border border-ink/10 bg-white/70 px-3 py-1.5 text-sm font-bold text-ink/68"
                  >
                    {highlight}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <FavoriteButton floorPlanId={floorPlan.id} />
              <Link
                href={`/viewer/${floorPlan.id}`}
                className="focus-ring inline-flex items-center gap-2 rounded-lg bg-jade px-5 py-2 text-sm font-bold text-white transition hover:bg-moss"
              >
                进入模拟 VR 看房
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white/64 p-4">
      <div className="flex items-center gap-2 text-xs font-bold text-ink/48">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-bold text-ink">{value}</p>
    </div>
  );
}
