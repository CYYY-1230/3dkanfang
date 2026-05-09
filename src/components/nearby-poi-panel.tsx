"use client";

import { useMemo, useState } from "react";
import { Building2, GraduationCap, MapPin, Store, TrainFront, Trees } from "lucide-react";
import type { Poi } from "@/lib/types";

const poiFilters = [
  { id: "all", label: "全部", icon: MapPin },
  { id: "交通", label: "交通", icon: TrainFront },
  { id: "教育", label: "学校", icon: GraduationCap },
  { id: "商业", label: "商业", icon: Store },
  { id: "医疗", label: "医院", icon: Building2 },
  { id: "公园", label: "公园", icon: Trees },
] as const;

type PoiFilter = (typeof poiFilters)[number]["id"];

export function NearbyPoiPanel({ pois }: { pois: Poi[] }) {
  const [activeFilter, setActiveFilter] = useState<PoiFilter>("all");
  const filteredPois = useMemo(
    () => pois.filter((poi) => activeFilter === "all" || poi.category === activeFilter),
    [activeFilter, pois],
  );

  return (
    <section className="glass-panel rounded-2xl p-5 sm:p-6">
      <h2 className="text-2xl font-bold text-ink">周边配套</h2>
      <p className="mt-2 text-sm leading-6 text-ink/62">
        根据小区位置查询附近交通、学校、商业、医院和公园，帮助快速判断生活半径。
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {poiFilters.map((filter) => {
          const Icon = filter.icon;
          const count =
            filter.id === "all"
              ? pois.length
              : pois.filter((poi) => poi.category === filter.id).length;

          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${
                activeFilter === filter.id
                  ? "bg-ink text-pearl"
                  : "bg-white/70 text-ink/70 hover:bg-white"
              }`}
            >
              <Icon size={15} />
              {filter.label}
              <span className="text-xs opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-3">
        {filteredPois.map((poi) => (
          <PoiRow key={poi.id} poi={poi} />
        ))}
        {filteredPois.length === 0 ? (
          <div className="rounded-lg border border-ink/10 bg-white/64 p-4 text-sm leading-6 text-ink/58">
            当前分类下暂时没有查到配套，可以切换其他分类看看。
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PoiRow({ poi }: { poi: Poi }) {
  const Icon = poi.category === "交通" ? TrainFront : MapPin;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-ink/10 bg-white/64 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-mist text-jade">
          <Icon size={18} />
        </span>
        <div>
          <p className="font-bold text-ink">{poi.name}</p>
          <p className="text-sm text-ink/55">{poi.category}</p>
        </div>
      </div>
      <span className="text-sm font-bold text-moss">{poi.distance}</span>
    </div>
  );
}
