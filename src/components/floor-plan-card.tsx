import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bath, Compass, Home } from "lucide-react";
import type { FloorPlan } from "@/lib/types";
import { FavoriteButton } from "@/components/favorite-button";

export function FloorPlanCard({ floorPlan }: { floorPlan: FloorPlan }) {
  return (
    <article className="grid overflow-hidden rounded-xl border border-ink/10 bg-white/74 shadow-soft md:grid-cols-[320px_1fr]">
      <div className="relative min-h-64 bg-pearl">
        <Image
          src={floorPlan.imageUrl}
          alt={`${floorPlan.name}户型图`}
          fill
          className="object-contain p-4"
          sizes="(max-width: 768px) 100vw, 320px"
        />
      </div>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-bold text-ink">{floorPlan.name}</h3>
            <p className="mt-2 text-sm leading-6 text-ink/62">
              {floorPlan.highlights.join(" · ")}
            </p>
          </div>
          <FavoriteButton floorPlanId={floorPlan.id} compact />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Fact icon={<Home size={17} />} label="户型" value={floorPlan.layout} />
          <Fact icon={<Compass size={17} />} label="朝向" value={floorPlan.orientation} />
          <Fact icon={<Bath size={17} />} label="卫浴" value={`${floorPlan.bathrooms} 卫`} />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/floor-plans/${floorPlan.id}`}
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-ink/12 bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-pearl"
          >
            户型详情
            <ArrowRight size={16} />
          </Link>
          <Link
            href={`/viewer/${floorPlan.id}`}
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-jade px-4 py-2 text-sm font-bold text-white transition hover:bg-moss"
          >
            进入看房
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-pearl/72 p-3">
      <div className="flex items-center gap-2 text-xs font-bold text-ink/52">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-bold text-ink">{value}</p>
    </div>
  );
}
