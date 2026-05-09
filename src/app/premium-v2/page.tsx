"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bath,
  BedDouble,
  Building2,
  Check,
  ChevronRight,
  Compass,
  Eye,
  Heart,
  Home,
  MapPin,
  Maximize2,
  Navigation,
  Search,
  Sparkles,
} from "lucide-react";
import { designStyles, getMapPois, properties } from "@/lib/data";
import type { FloorPlan, Property, Room } from "@/lib/types";

const cityOptions = ["全部", "杭州"] as const;
const intentOptions = [
  { id: "all", label: "全部", icon: Search },
  { id: "commute", label: "通勤", icon: Navigation },
  { id: "family", label: "三房", icon: Home },
  { id: "immersive", label: "可看房", icon: Eye },
] as const;

type CityOption = (typeof cityOptions)[number];
type IntentOption = (typeof intentOptions)[number]["id"];

export default function PremiumV2Page() {
  const pois = getMapPois();
  const [city, setCity] = useState<CityOption>("全部");
  const [intent, setIntent] = useState<IntentOption>("all");
  const [propertyId, setPropertyId] = useState(properties[0].id);
  const [planId, setPlanId] = useState(properties[0].floorPlans[0].id);
  const [roomId, setRoomId] = useState(properties[0].floorPlans[0].rooms[0].id);
  const [styleId, setStyleId] = useState(designStyles[0].id);

  const filteredProperties = useMemo(
    () =>
      properties.filter((property) => {
        const cityMatch = city === "全部" || property.city === city;
        const intentMatch =
          intent === "all" ||
          (intent === "commute" &&
            (property.tags.some((tag) => tag.includes("通勤") || tag.includes("地铁")) ||
              property.pois.some((poi) => poi.category === "交通"))) ||
          (intent === "family" &&
            property.floorPlans.some((plan) => Number(plan.layout[0]) >= 3)) ||
          (intent === "immersive" &&
            property.floorPlans.some((plan) =>
              plan.rooms.some((room) => room.assets.length > 0),
            ));

        return cityMatch && intentMatch;
      }),
    [city, intent],
  );

  const selectedProperty =
    filteredProperties.find((property) => property.id === propertyId) ??
    filteredProperties[0] ??
    properties[0];

  const selectedPlan =
    selectedProperty.floorPlans.find((plan) => plan.id === planId) ??
    selectedProperty.floorPlans[0];

  const selectedRoom =
    selectedPlan.rooms.find((room) => room.id === roomId) ?? selectedPlan.rooms[0];

  const selectedStyle =
    designStyles.find((style) => style.id === styleId) ?? designStyles[0];

  const roomAsset =
    selectedRoom.assets.find((asset) => asset.styleId === selectedStyle.id) ??
    selectedRoom.assets[0];

  const filteredPois = pois.filter((poi) =>
    filteredProperties.some((property) => property.id === poi.id),
  );

  function chooseProperty(property: Property) {
    setPropertyId(property.id);
    setPlanId(property.floorPlans[0].id);
    setRoomId(property.floorPlans[0].rooms[0].id);
  }

  function choosePlan(plan: FloorPlan) {
    setPlanId(plan.id);
    setRoomId(plan.rooms[0].id);
  }

  function chooseRoom(room: Room) {
    setRoomId(room.id);
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] text-[#16130f]">
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-[#f5f0e8]/94 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 lg:px-6">
          <Link href="/premium-v2" className="focus-ring flex items-center gap-3 rounded-xl">
            <span className="grid size-10 place-items-center rounded-xl bg-[#171412] text-white">
              <Building2 size={21} />
            </span>
            <span>
              <span className="block text-base font-bold leading-tight">3D House Console</span>
              <span className="hidden text-xs text-stone-500 sm:block">
                高级看房控制台副本
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-xl border border-stone-200 bg-white/75 p-1 shadow-sm md:flex">
            <Link href="/premium" className="rounded-lg px-3 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100">
              Premium v1
            </Link>
            <Link href="/" className="rounded-lg px-3 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100">
              原版本
            </Link>
          </nav>

          <Link
            href={`/viewer/${selectedPlan.id}`}
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#171412] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#3f3a35]"
          >
            完整看房
            <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <section className="grid gap-4 px-4 py-4 sm:px-5 md:h-[calc(100dvh-69px)] md:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] md:overflow-hidden lg:px-6">
        <div className="grid min-h-0 gap-4 md:grid-rows-[auto_minmax(0,1fr)]">
          <section className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-[0_18px_60px_rgba(22,19,15,0.08)]">
            <div className="grid gap-4 xl:grid-cols-[0.74fr_1.26fr] xl:items-center">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-[#fbf2dd] px-3 py-1.5 text-xs font-bold text-[#8a5206]">
                  <Sparkles size={14} />
                  一屏式高级找房工作台
                </p>
                <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight lg:text-4xl">
                  选楼盘、看户型、进空间，一屏完成判断。
                </h1>
              </div>
              <div className="grid gap-2">
                <div className="grid gap-2 sm:grid-cols-4">
                  {cityOptions.map((option) => (
                    <Choice
                      key={option}
                      active={city === option}
                      icon={<MapPin size={15} />}
                      label={option === "全部" ? "全部城市" : option}
                      onClick={() => setCity(option)}
                    />
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-4">
                  {intentOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <Choice
                        key={option.id}
                        active={intent === option.id}
                        icon={<Icon size={15} />}
                        label={option.label}
                        onClick={() => setIntent(option.id)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="relative min-h-[560px] overflow-hidden rounded-[28px] bg-[#151713] text-white shadow-[0_22px_70px_rgba(22,19,15,0.18)] md:min-h-0">
            <div className="absolute inset-0 opacity-95">
              <div className="map-grid h-full w-full" />
            </div>

            <div className="relative z-10 flex items-start justify-between gap-4 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/44">
                  Location board
                </p>
                <h2 className="mt-2 text-2xl font-bold">城市沙盘</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-white/58">
                  点地图或右侧列表，楼盘、户型和房间预览会同步更新。
                </p>
              </div>
              <span className="rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/72">
                {filteredProperties.length} 个结果
              </span>
            </div>

            {filteredPois.map((poi) => {
              const property = filteredProperties.find((item) => item.id === poi.id);
              if (!property) return null;
              const active = selectedProperty.id === property.id;

              return (
                <button
                  key={poi.id}
                  type="button"
                  onClick={() => chooseProperty(property)}
                  className={`focus-ring absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-2 text-left shadow-xl transition hover:-translate-y-[calc(50%+4px)] ${
                    active
                      ? "bg-[#a16207] text-white ring-4 ring-[#a16207]/24"
                      : "bg-white text-[#171412] hover:bg-[#fbf2dd]"
                  }`}
                  style={{ left: `${poi.x}%`, top: `${poi.y}%` }}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`grid size-10 place-items-center rounded-xl ${
                        active ? "bg-white/18 text-white" : "bg-[#0f766e] text-white"
                      }`}
                    >
                      <Building2 size={17} />
                    </span>
                    <span>
                      <span className="block whitespace-nowrap text-sm font-bold">
                        {property.name}
                      </span>
                      <span
                        className={`block whitespace-nowrap text-xs ${
                          active ? "text-white/70" : "text-stone-500"
                        }`}
                      >
                        {property.district} · {property.priceRange}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}

            <div className="absolute bottom-4 left-4 right-4 rounded-3xl border border-white/14 bg-white/12 p-4 backdrop-blur-2xl sm:bottom-5 sm:left-5 sm:right-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <p className="text-xs font-bold text-white/44">当前选中</p>
                  <h3 className="mt-1 text-3xl font-bold">{selectedProperty.name}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
                    {selectedProperty.summary}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/properties/${selectedProperty.id}`}
                    className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#171412]"
                  >
                    楼盘详情
                    <ArrowRight size={15} />
                  </Link>
                  <Link
                    href={`/viewer/${selectedPlan.id}`}
                    className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0f766e] px-4 py-2 text-sm font-bold text-white"
                  >
                    直接看房
                    <Eye size={15} />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="grid min-h-0 gap-4 md:max-h-[calc(100dvh-92px)] md:grid-rows-[minmax(210px,0.34fr)_minmax(210px,0.31fr)_minmax(240px,0.35fr)] md:overflow-hidden md:pr-1">
          <section className="flex min-h-0 flex-col rounded-[24px] border border-stone-200 bg-white p-4 shadow-[0_18px_60px_rgba(22,19,15,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0f766e]">
                  Properties
                </p>
                <h2 className="mt-1 text-xl font-bold">楼盘候选</h2>
              </div>
              <span className="rounded-full bg-[#f0fdfa] px-3 py-1 text-xs font-bold text-[#0f766e]">
                {filteredProperties.length} 个
              </span>
            </div>

            <div className="mt-3 grid min-h-0 gap-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filteredProperties.map((property) => {
                const active = selectedProperty.id === property.id;
                return (
                  <article
                    key={property.id}
                    className={`rounded-2xl border p-3 transition ${
                      active
                        ? "border-[#0f766e] bg-[#f0fdfa]"
                        : "border-stone-200 bg-white hover:bg-stone-50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => chooseProperty(property)}
                      className="focus-ring block w-full rounded-xl text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-[#0f766e]">
                            {property.city} · {property.district}
                          </p>
                          <h3 className="mt-1 text-lg font-bold">{property.name}</h3>
                        </div>
                        {active ? (
                          <span className="grid size-8 place-items-center rounded-full bg-[#0f766e] text-white">
                            <Check size={16} />
                          </span>
                        ) : (
                          <ChevronRight className="mt-1 text-stone-400" size={18} />
                        )}
                      </div>
                      <p className="mt-2 line-clamp-1 text-sm leading-6 text-stone-600">
                        {property.summary}
                      </p>
                    </button>
                    <div className="mt-2 flex items-center justify-between border-t border-stone-200 pt-2">
                      <span className="text-sm font-bold">{property.priceRange}</span>
                      <Link
                        href={`/properties/${property.id}`}
                        className="focus-ring rounded-lg px-2 py-1 text-sm font-bold text-[#0f766e]"
                      >
                        详情
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto rounded-[24px] border border-stone-200 bg-white p-4 shadow-[0_18px_60px_rgba(22,19,15,0.08)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0f766e]">
                  Floor plan
                </p>
                <h2 className="mt-1 text-xl font-bold">户型判断</h2>
              </div>
              <Link
                href={`/floor-plans/${selectedPlan.id}`}
                className="focus-ring inline-flex min-h-10 items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-sm font-bold hover:bg-stone-50"
              >
                详情
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="mt-3 grid gap-2">
              {selectedProperty.floorPlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => choosePlan(plan)}
                  className={`focus-ring rounded-2xl border p-3 text-left transition ${
                    selectedPlan.id === plan.id
                      ? "border-[#a16207] bg-[#fbf2dd]"
                      : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">{plan.name}</p>
                      <p className="mt-1 text-sm text-stone-500">
                        {plan.area} 平 · {plan.layout} · {plan.orientation}
                      </p>
                    </div>
                    <Heart size={17} />
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl bg-[#faf7ef] p-3 sm:grid-cols-[0.9fr_1.1fr]">
              <div className="overflow-hidden rounded-xl bg-white">
                <Image
                  src={selectedPlan.imageUrl}
                  alt={`${selectedPlan.name}户型图`}
                  width={900}
                  height={660}
                  className="h-full min-h-32 w-full object-contain"
                />
              </div>
              <div className="grid content-start gap-2">
                <MiniFact icon={<Maximize2 size={15} />} label="面积" value={`${selectedPlan.area} 平`} />
                <MiniFact icon={<BedDouble size={15} />} label="户型" value={selectedPlan.layout} />
                <MiniFact icon={<Compass size={15} />} label="朝向" value={selectedPlan.orientation} />
                <MiniFact icon={<Bath size={15} />} label="卫浴" value={`${selectedPlan.bathrooms} 个`} />
              </div>
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto rounded-[24px] bg-[#171412] p-4 text-white shadow-[0_18px_60px_rgba(22,19,15,0.16)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/44">
                  Room preview
                </p>
                <h2 className="mt-1 text-xl font-bold">空间预览</h2>
              </div>
              <Link
                href={`/viewer/${selectedPlan.id}`}
                className="focus-ring inline-flex min-h-10 items-center gap-1 rounded-xl bg-white px-3 py-2 text-sm font-bold text-[#171412]"
              >
                看房
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl bg-white/8">
                <div className="relative min-h-48">
                <Image
                  src={roomAsset.imageUrl}
                  alt={`${selectedRoom.name}${selectedStyle.name}效果图`}
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 420px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#171412]/76 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-sm font-bold text-white/58">当前空间</p>
                  <h3 className="mt-1 text-2xl font-bold">
                    {selectedRoom.name} · {selectedStyle.name}
                  </h3>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <ControlGroup title="房间">
                {selectedPlan.rooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => chooseRoom(room)}
                    className={`focus-ring min-h-10 rounded-xl px-3 py-2 text-left text-sm font-bold transition ${
                      selectedRoom.id === room.id
                        ? "bg-white text-[#171412]"
                        : "bg-white/8 text-white/68 hover:bg-white/12"
                    }`}
                  >
                    {room.name}
                  </button>
                ))}
              </ControlGroup>

              <ControlGroup title="风格">
                {designStyles.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setStyleId(style.id)}
                    className={`focus-ring min-h-10 rounded-xl px-3 py-2 text-left text-sm font-bold transition ${
                      selectedStyle.id === style.id
                        ? "bg-[#a16207] text-white"
                        : "bg-white/8 text-white/68 hover:bg-white/12"
                    }`}
                  >
                    {style.name}
                  </button>
                ))}
              </ControlGroup>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function Choice({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
        active ? "bg-[#171412] text-white" : "bg-[#faf7ef] text-stone-700 hover:bg-stone-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MiniFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex items-center gap-2 text-xs font-bold text-stone-400">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function ControlGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-white/38">
        {title}
      </p>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}
