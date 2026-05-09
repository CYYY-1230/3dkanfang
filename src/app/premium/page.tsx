"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  Eye,
  Heart,
  Home,
  MapPin,
  Maximize2,
  Navigation,
  Search,
  ShieldCheck,
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

export default function PremiumHomePage() {
  const mapPois = getMapPois();
  const [city, setCity] = useState<CityOption>("全部");
  const [intent, setIntent] = useState<IntentOption>("all");
  const [selectedPropertyId, setSelectedPropertyId] = useState(properties[0].id);
  const [selectedPlanId, setSelectedPlanId] = useState(properties[0].floorPlans[0].id);
  const [selectedRoomId, setSelectedRoomId] = useState(
    properties[0].floorPlans[0].rooms[0].id,
  );
  const [selectedStyleId, setSelectedStyleId] = useState(designStyles[0].id);

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
    filteredProperties.find((property) => property.id === selectedPropertyId) ??
    filteredProperties[0] ??
    properties[0];

  const selectedPlan =
    selectedProperty.floorPlans.find((plan) => plan.id === selectedPlanId) ??
    selectedProperty.floorPlans[0];

  const selectedRoom =
    selectedPlan.rooms.find((room) => room.id === selectedRoomId) ??
    selectedPlan.rooms[0];

  const selectedStyle =
    designStyles.find((style) => style.id === selectedStyleId) ?? designStyles[0];

  const roomAsset =
    selectedRoom.assets.find((asset) => asset.styleId === selectedStyle.id) ??
    selectedRoom.assets[0];

  const filteredPois = mapPois.filter((poi) =>
    filteredProperties.some((property) => property.id === poi.id),
  );

  function selectProperty(property: Property) {
    setSelectedPropertyId(property.id);
    setSelectedPlanId(property.floorPlans[0].id);
    setSelectedRoomId(property.floorPlans[0].rooms[0].id);
  }

  function selectPlan(plan: FloorPlan) {
    setSelectedPlanId(plan.id);
    setSelectedRoomId(plan.rooms[0].id);
  }

  function selectRoom(room: Room) {
    setSelectedRoomId(room.id);
  }

  return (
    <main className="min-h-screen bg-[#f7f3eb] text-[#15120f]">
      <header className="sticky top-0 z-50 border-b border-stone-200/80 bg-[#f7f3eb]/92 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8 2xl:px-10">
          <Link href="/premium" className="focus-ring flex items-center gap-3 rounded-lg">
            <span className="grid size-11 place-items-center rounded-lg bg-[#1c1917] text-white">
              <Building2 size={22} />
            </span>
            <span>
              <span className="block text-base font-bold leading-tight">3D House Atelier</span>
              <span className="block text-xs text-stone-500">Premium viewer concept</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-2 rounded-xl border border-stone-200 bg-white/70 p-1 shadow-sm md:flex">
            <a href="#discover" className="rounded-lg px-4 py-2 text-sm font-bold text-stone-700 hover:bg-stone-100">
              找房
            </a>
            <a href="#plans" className="rounded-lg px-4 py-2 text-sm font-bold text-stone-700 hover:bg-stone-100">
              户型
            </a>
            <Link href="/" className="rounded-lg px-4 py-2 text-sm font-bold text-stone-700 hover:bg-stone-100">
              原版本
            </Link>
          </nav>
          <Link
            href={`/viewer/${selectedPlan.id}`}
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-[#1c1917] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#44403c]"
          >
            进入看房
            <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <section className="px-4 pb-8 pt-5 sm:px-6 lg:px-8 2xl:px-10">
        <div className="grid min-h-[calc(100dvh-96px)] overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_30px_90px_rgba(28,25,23,0.12)] lg:grid-cols-[0.92fr_1.08fr]">
          <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10 xl:p-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#a16207]/20 bg-[#faf3e4] px-4 py-2 text-sm font-bold text-[#7c4a03]">
                <Sparkles size={16} />
                面向买房用户的沉浸式看房系统
              </div>
              <h1 className="mt-7 max-w-3xl text-5xl font-bold leading-[0.96] tracking-normal text-[#15120f] sm:text-6xl xl:text-7xl">
                先判断位置，再感受一个家的真实尺度。
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
                新版首页把地图、户型和模拟 VR 整合成一个连续决策流。用户不需要先理解系统，只需要顺着页面选择楼盘、切换户型、进入空间。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#discover"
                  className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1c1917] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#44403c]"
                >
                  开始找房
                  <ArrowRight size={17} />
                </a>
                <Link
                  href={`/floor-plans/${selectedPlan.id}`}
                  className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-bold text-[#1c1917] transition hover:bg-stone-50"
                >
                  先看户型
                  <Maximize2 size={17} />
                </Link>
              </div>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <Metric label="楼盘样本" value={`${properties.length}`} suffix="个" />
              <Metric
                label="户型样本"
                value={`${properties.flatMap((property) => property.floorPlans).length}`}
                suffix="个"
              />
              <Metric label="风格切换" value={`${designStyles.length}`} suffix="种" />
            </div>
          </div>

          <div className="relative min-h-[560px] overflow-hidden bg-[#dcece7]">
            <Image
              src={selectedProperty.coverImage}
              alt={`${selectedProperty.name}楼盘视觉`}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 55vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1c1917]/55 via-transparent to-transparent" />
            <div className="absolute left-5 right-5 top-5 flex items-center justify-between rounded-2xl border border-white/30 bg-white/70 p-3 shadow-lg backdrop-blur-xl sm:left-8 sm:right-8 sm:top-8">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-[#1c1917] text-white">
                  <ShieldCheck size={19} />
                </span>
                <div>
                  <p className="text-sm font-bold text-[#15120f]">精选楼盘</p>
                  <p className="text-xs text-stone-500">根据当前筛选实时更新</p>
                </div>
              </div>
              <span className="rounded-full bg-[#faf3e4] px-3 py-1 text-xs font-bold text-[#7c4a03]">
                {selectedProperty.city}
              </span>
            </div>
            <div className="absolute bottom-5 left-5 right-5 rounded-3xl border border-white/25 bg-white/78 p-5 shadow-[0_24px_70px_rgba(28,25,23,0.18)] backdrop-blur-2xl sm:bottom-8 sm:left-8 sm:right-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-bold text-[#0f766e]">当前推荐</p>
                  <h2 className="mt-1 text-3xl font-bold text-[#15120f]">
                    {selectedProperty.name}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                    {selectedProperty.summary}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <SoftFact label="总价" value={selectedProperty.priceRange} />
                  <SoftFact label="户型" value={`${selectedProperty.floorPlans.length} 个`} />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {selectedProperty.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-bold text-stone-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="discover" className="scroll-mt-24 px-4 py-8 sm:px-6 lg:px-8 2xl:px-10">
        <div className="mb-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase text-[#0f766e]">Discover</p>
            <h2 className="mt-2 text-4xl font-bold text-[#15120f]">地图找房控制台</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
              选择城市和需求，地图点与楼盘列表同步变化。用户先定位，再进入详情。
            </p>
          </div>
          <div className="grid gap-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-sm">
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

        <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="relative min-h-[680px] overflow-hidden rounded-[28px] bg-[#15120f] text-white shadow-[0_28px_80px_rgba(28,25,23,0.18)]">
            <div className="absolute inset-0 opacity-90">
              <div className="map-grid h-full w-full" />
            </div>
            <div className="relative z-10 flex items-center justify-between p-5 sm:p-7">
              <div>
                <p className="text-sm font-bold text-white/58">Map selection</p>
                <h3 className="mt-1 text-2xl font-bold">示例城市群</h3>
              </div>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/74">
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
                  onClick={() => selectProperty(property)}
                  className={`focus-ring absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl p-2 text-left shadow-xl transition hover:-translate-y-[calc(50%+4px)] ${
                    active
                      ? "bg-[#a16207] text-white ring-4 ring-[#a16207]/25"
                      : "bg-white text-[#15120f] hover:bg-[#faf3e4]"
                  }`}
                  style={{ left: `${poi.x}%`, top: `${poi.y}%` }}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`grid size-10 place-items-center rounded-xl ${
                        active ? "bg-white/18 text-white" : "bg-[#0f766e] text-white"
                      }`}
                    >
                      <Building2 size={18} />
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

            <div className="absolute bottom-5 left-5 right-5 rounded-3xl border border-white/14 bg-white/10 p-5 backdrop-blur-2xl">
              <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <p className="text-xs font-bold text-white/48">当前选中楼盘</p>
                  <h3 className="mt-1 text-3xl font-bold">{selectedProperty.name}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/62">
                    {selectedProperty.summary}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/properties/${selectedProperty.id}`}
                    className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#15120f]"
                  >
                    查看楼盘
                    <ArrowRight size={15} />
                  </Link>
                  <Link
                    href={`/viewer/${selectedPlan.id}`}
                    className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0f766e] px-4 py-2 text-sm font-bold text-white"
                  >
                    进入看房
                    <Eye size={15} />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-stone-500">筛选结果</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-4xl font-bold text-[#15120f]">{filteredProperties.length}</p>
                <span className="rounded-full bg-[#f0fdfa] px-3 py-1 text-xs font-bold text-[#0f766e]">
                  可继续筛选
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                先选中楼盘，再选择户型和房间预览，体验会更连贯。
              </p>
            </div>

            {filteredProperties.map((property) => {
              const active = selectedProperty.id === property.id;
              return (
                <article
                  key={property.id}
                  className={`rounded-3xl border bg-white p-5 shadow-sm transition ${
                    active
                      ? "border-[#0f766e] ring-4 ring-[#0f766e]/10"
                      : "border-stone-200 hover:border-stone-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectProperty(property)}
                    className="focus-ring block w-full rounded-xl text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-[#0f766e]">
                          {property.city} · {property.district}
                        </p>
                        <h3 className="mt-1 text-2xl font-bold text-[#15120f]">
                          {property.name}
                        </h3>
                      </div>
                      {active ? (
                        <span className="grid size-9 place-items-center rounded-full bg-[#0f766e] text-white">
                          <Check size={17} />
                        </span>
                      ) : (
                        <span className="grid size-9 place-items-center rounded-full bg-stone-100 text-stone-500">
                          <ChevronRight size={17} />
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-stone-600">{property.summary}</p>
                  </button>
                  <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-4">
                    <span className="text-sm font-bold">{property.priceRange}</span>
                    <Link
                      href={`/properties/${property.id}`}
                      className="focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold text-[#0f766e]"
                    >
                      详情
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </aside>
        </div>
      </section>

      <section id="plans" className="scroll-mt-24 px-4 pb-12 pt-6 sm:px-6 lg:px-8 2xl:px-10">
        <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
          <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase text-[#0f766e]">Plan studio</p>
                <h2 className="mt-2 text-4xl font-bold">户型与房间预览</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">
                  当前选中：{selectedProperty.name}。用户可以在不离开首页的情况下先判断户型是否值得深入。
                </p>
              </div>
              <Link
                href={`/floor-plans/${selectedPlan.id}`}
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-bold text-[#15120f] hover:bg-stone-50"
              >
                户型详情
                <ArrowRight size={15} />
              </Link>
            </div>

            <div className="mt-5 grid gap-2">
              {selectedProperty.floorPlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => selectPlan(plan)}
                  className={`focus-ring rounded-2xl border p-4 text-left transition ${
                    selectedPlan.id === plan.id
                      ? "border-[#0f766e] bg-[#f0fdfa]"
                      : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold">{plan.name}</p>
                      <p className="mt-1 text-sm text-stone-500">
                        {plan.area} 平 · {plan.layout} · {plan.orientation}
                      </p>
                    </div>
                    <Heart size={18} />
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 overflow-hidden rounded-3xl bg-[#faf7ef]">
              <Image
                src={selectedPlan.imageUrl}
                alt={`${selectedPlan.name}户型图`}
                width={900}
                height={660}
                className="h-auto w-full"
              />
            </div>
          </div>

          <div className="rounded-[28px] bg-[#15120f] p-5 text-white shadow-[0_28px_80px_rgba(28,25,23,0.18)] sm:p-6">
            <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <div className="overflow-hidden rounded-3xl bg-white/8">
                <div className="relative min-h-[520px]">
                  <Image
                    src={roomAsset.imageUrl}
                    alt={`${selectedRoom.name}${selectedStyle.name}效果图`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 60vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#15120f]/75 via-transparent to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5">
                    <p className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-sm font-bold text-white/76 backdrop-blur-xl">
                      <Eye size={15} />
                      模拟看房预览
                    </p>
                    <h2 className="mt-3 text-4xl font-bold">
                      {selectedRoom.name} · {selectedStyle.name}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/62">
                      这里保留未来升级 360 全景或真实 3D 的位置，MVP 阶段先用房间图和风格切换验证体验。
                    </p>
                  </div>
                </div>
              </div>

              <aside className="space-y-4">
                <Panel title="切换房间">
                  <div className="grid gap-2">
                    {selectedPlan.rooms.map((room) => (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => selectRoom(room)}
                        className={`focus-ring min-h-12 rounded-xl px-4 py-3 text-left text-sm font-bold transition ${
                          selectedRoom.id === room.id
                            ? "bg-white text-[#15120f]"
                            : "bg-white/8 text-white/70 hover:bg-white/12"
                        }`}
                      >
                        {room.name}
                      </button>
                    ))}
                  </div>
                </Panel>

                <Panel title="装修风格">
                  <div className="grid gap-2">
                    {designStyles.map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setSelectedStyleId(style.id)}
                        className={`focus-ring rounded-xl border px-4 py-3 text-left transition ${
                          selectedStyle.id === style.id
                            ? "border-[#a16207] bg-[#a16207] text-white"
                            : "border-white/10 bg-white/8 text-white/70 hover:bg-white/12"
                        }`}
                      >
                        <span className="block text-sm font-bold">{style.name}</span>
                        <span className="mt-1 block text-xs leading-5 opacity-75">
                          {style.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </Panel>

                <Link
                  href={`/viewer/${selectedPlan.id}`}
                  className="focus-ring inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#15120f]"
                >
                  打开完整看房页
                  <ArrowRight size={16} />
                </Link>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/70 p-4 shadow-sm">
      <p className="text-xs font-bold text-stone-500">{label}</p>
      <p className="mt-1 text-3xl font-bold">
        {value}
        <span className="ml-1 text-sm text-stone-500">{suffix}</span>
      </p>
    </div>
  );
}

function SoftFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-bold text-stone-400">{label}</p>
      <p className="mt-1 whitespace-nowrap text-sm font-bold">{value}</p>
    </div>
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
        active
          ? "bg-[#1c1917] text-white"
          : "bg-[#faf7ef] text-stone-700 hover:bg-stone-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/6 p-4">
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}
