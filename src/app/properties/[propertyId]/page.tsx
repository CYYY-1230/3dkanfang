import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FloorPlanCard } from "@/components/floor-plan-card";
import { NearbyPoiPanel } from "@/components/nearby-poi-panel";
import { getPropertyNearbyPois } from "@/lib/amap-nearby-pois";
import { getCommunityNearbyPoiSummary } from "@/lib/community-nearby-pois";
import { getCommunityProperty } from "@/lib/community-property";
import { getProperty } from "@/lib/data";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const property = getProperty(propertyId) ?? (await getCommunityProperty(propertyId));

  if (!property) {
    notFound();
  }

  const nearbyPois =
    property.pois.length > 0
      ? property.pois
      : property.id.startsWith("amap-")
        ? await getCommunityNearbyPoiSummary(property.id)
        : await getPropertyNearbyPois({
            longitude: property.longitude,
            latitude: property.latitude,
          });

  return (
    <AppShell>
      <section className="w-full px-4 py-8 sm:px-6 lg:px-8 2xl:px-10">
        <Link
          href="/"
          className="focus-ring mb-5 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-bold text-ink/62 hover:text-ink"
        >
          <ArrowLeft size={16} />
          返回地图
        </Link>

        <div className="grid overflow-hidden rounded-2xl bg-white/72 shadow-soft lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative min-h-[360px]">
            <Image
              src={property.coverImage}
              alt={`${property.name}楼盘示意图`}
              fill
              className="object-cover"
              priority
            />
          </div>
          <div className="p-6 sm:p-8">
            <p className="inline-flex items-center gap-2 rounded-md bg-mist px-3 py-1 text-sm font-bold text-moss">
              <Building2 size={16} />
              {property.city} · {property.district}
            </p>
            <h1 className="mt-5 text-4xl font-bold text-ink">{property.name}</h1>
            <p className="mt-4 text-base leading-7 text-ink/66">{property.summary}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Info label="参考总价" value={property.priceRange} />
              <Info label="地址" value={property.address} />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {property.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-ink/10 bg-pearl px-3 py-1 text-sm font-bold text-ink/65"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <NearbyPoiPanel pois={nearbyPois} />

          <section>
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-ink">可选户型</h2>
              <p className="mt-2 text-sm leading-6 text-ink/62">
                点击户型可以看户型图和进入模拟 VR 看房。
              </p>
            </div>
            <div className="space-y-4">
              {property.floorPlans.map((floorPlan) => (
                <FloorPlanCard key={floorPlan.id} floorPlan={floorPlan} />
              ))}
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-pearl/72 p-4">
      <p className="text-xs font-bold text-ink/48">{label}</p>
      <p className="mt-1 text-sm font-bold text-ink">{value}</p>
    </div>
  );
}
