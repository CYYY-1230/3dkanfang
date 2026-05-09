"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bath,
  Building2,
  ChevronLeft,
  ChevronRight,
  Compass,
  GraduationCap,
  Home,
  MapPin,
  Search,
  Sparkles,
  Store,
  SunMedium,
  Trees,
} from "lucide-react";
import { AmapPropertyMap } from "@/components/amap-property-map";
import { AppShell } from "@/components/app-shell";
import { FavoriteButton } from "@/components/favorite-button";
import { getCityOption, supportedCityNames, type SupportedCity } from "@/lib/city-options";
import { properties } from "@/lib/data";
import type { Property } from "@/lib/types";

const hangzhouProperties = properties.filter((property) => property.city === "杭州");
const cityFilters = supportedCityNames;
const needFilters = [
  { id: "all", label: "全部需求", icon: Search },
  { id: "two-room", label: "两房", icon: Home },
  { id: "three-room", label: "三房起", icon: Home },
  { id: "four-room", label: "四房", icon: Building2 },
  { id: "south", label: "南向", icon: SunMedium },
  { id: "transparent", label: "南北通透", icon: Compass },
  { id: "double-bath", label: "双卫", icon: Bath },
  { id: "balcony", label: "带阳台", icon: Home },
  { id: "commute", label: "通勤友好", icon: Compass },
  { id: "metro", label: "近地铁", icon: MapPin },
  { id: "school", label: "近学校", icon: GraduationCap },
  { id: "park", label: "近公园", icon: Trees },
  { id: "commercial", label: "商业便利", icon: Store },
] as const;
const budgetOptions = [
  { label: "不限", value: 0 },
  { label: "300万内", value: 300 },
  { label: "500万内", value: 500 },
  { label: "800万内", value: 800 },
  { label: "1000万内", value: 1000 },
] as const;
const heroSlides = [
  {
    id: "location",
    label: "位置与周边",
    eyebrow: "MAP + LIFE",
    title: "先看懂位置，再判断生活半径。",
    description: "把江景步道、地铁通勤和日常配套放到同一个画面里，买房决策不用只靠想象。",
    image: "/generated/hero-carousel/location.jpg",
    alt: "杭州滨江江景住宅和周边配套预览",
  },
  {
    id: "floor-plan",
    label: "户型空间",
    eyebrow: "FLOOR PLAN",
    title: "从户型图走进真实尺度。",
    description: "客餐厅、阳台、收纳和动线一起看，帮助普通用户更快判断空间是否适合自己。",
    image: "/generated/hero-carousel/floor-plan.jpg",
    alt: "明亮住宅客餐厅和阳台空间预览",
  },
  {
    id: "vr-viewing",
    label: "VR 看房",
    eyebrow: "3D / VR",
    title: "不用到场，也能感受家的空间感。",
    description: "把户型细节和沉浸式看房串成一条轻松流程，先筛选，再深入体验。",
    image: "/generated/hero-carousel/vr-viewing.jpg",
    alt: "用户体验沉浸式 VR 看房预览",
  },
] as const;

type CityFilter = SupportedCity;
type NeedFilter = (typeof needFilters)[number]["id"];
type ActiveNeedFilter = Exclude<NeedFilter, "all">;

export default function HomePage() {
  const featuredProperty = hangzhouProperties[0] ?? properties[0];
  const [cityFilter, setCityFilter] = useState<CityFilter>("杭州");
  const [needFiltersSelected, setNeedFiltersSelected] = useState<ActiveNeedFilter[]>([]);
  const [budgetMax, setBudgetMax] = useState(0);
  const [selectedPropertyId, setSelectedPropertyId] = useState(featuredProperty.id);
  const [mapFocusVersion, setMapFocusVersion] = useState(0);
  const [communitiesByCity, setCommunitiesByCity] = useState<Partial<Record<CityFilter, Property[]>>>({});
  const [isLoadingCommunities, setIsLoadingCommunities] = useState(true);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);

  useEffect(() => {
    let ignore = false;
    const cachedCommunities = communitiesByCity[cityFilter];

    if (cachedCommunities) {
      setIsLoadingCommunities(false);
      return;
    }

    async function loadCommunities() {
      setIsLoadingCommunities(true);
      try {
        const params = new URLSearchParams({
          city: cityFilter,
          scope: "city",
        });
        const response = await fetch(`/api/amap/communities?${params.toString()}`);
        const payload = (await response.json()) as { communities?: Property[] };

        if (!ignore) {
          setCommunitiesByCity((current) => ({
            ...current,
            [cityFilter]: payload.communities ?? [],
          }));
        }
      } catch {
        if (!ignore) {
          setCommunitiesByCity((current) => ({
            ...current,
            [cityFilter]: [],
          }));
        }
      } finally {
        if (!ignore) {
          setIsLoadingCommunities(false);
        }
      }
    }

    loadCommunities();

    return () => {
      ignore = true;
    };
  }, [cityFilter, communitiesByCity]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveHeroSlide((currentSlide) => (currentSlide + 1) % heroSlides.length);
    }, 5600);

    return () => window.clearInterval(timer);
  }, []);

  const cityCenterProperty = useMemo<Property>(() => {
    const cityOption = getCityOption(cityFilter);

    return {
      id: `city-center-${cityFilter}`,
      name: `${cityFilter}地图中心`,
      city: cityFilter,
      district: "全市",
      address: `${cityFilter}市`,
      latitude: cityOption.center[1],
      longitude: cityOption.center[0],
      priceRange: "待筛选",
      summary: `正在读取${cityFilter}小区数据，地图可以先缩放和拖动查看城市范围。`,
      coverImage: "/assets/property-city.svg",
      tags: ["城市中心"],
      floorPlanTags: [],
      locationTags: [],
      priceTags: [],
      pois: [],
      floorPlans: [],
    };
  }, [cityFilter]);

  const cachedCityProperties = communitiesByCity[cityFilter] ?? [];
  const localCityProperties =
    cityFilter === "杭州" ? hangzhouProperties : properties.filter((property) => property.city === cityFilter);
  const mapProperties = cachedCityProperties.length > 0 ? cachedCityProperties : localCityProperties;

  const filteredProperties = useMemo(
    () =>
      mapProperties.filter((property) => {
        const cityMatched = property.city.includes(cityFilter);
        const budgetMatched =
          budgetMax === 0 ||
          property.floorPlans.some((plan) => (plan.totalPrice ?? Infinity) <= budgetMax);
        const floorTags = property.floorPlanTags ?? [];
        const locationTags = property.locationTags ?? [];
        const allTags = [...property.tags, ...floorTags, ...locationTags];
        const hasTag = (keyword: string) => allTags.some((tag) => tag.includes(keyword));
        const hasRoomAtLeast = (roomCount: number) =>
          property.floorPlans.some((plan) => Number(plan.layout[0]) >= roomCount);
        const hasRoomExactly = (roomCount: number) =>
          property.floorPlans.some((plan) => Number(plan.layout[0]) === roomCount);
        const matchNeed = (needFilter: ActiveNeedFilter) =>
          (needFilter === "two-room" && hasRoomExactly(2)) ||
          (needFilter === "three-room" && hasRoomAtLeast(3)) ||
          (needFilter === "four-room" && hasRoomAtLeast(4)) ||
          (needFilter === "south" && hasTag("南向")) ||
          (needFilter === "transparent" && hasTag("南北通透")) ||
          (needFilter === "double-bath" && hasTag("双卫")) ||
          (needFilter === "balcony" && hasTag("带阳台")) ||
          (needFilter === "commute" &&
            (hasTag("交通") ||
              hasTag("地铁") ||
              hasTag("通勤") ||
              property.pois.some((poi) => poi.category === "交通"))) ||
          (needFilter === "metro" && hasTag("地铁")) ||
          (needFilter === "school" && hasTag("学校")) ||
          (needFilter === "park" && hasTag("公园")) ||
          (needFilter === "commercial" && hasTag("商业"));
        const needMatched =
          needFiltersSelected.length === 0 || needFiltersSelected.some(matchNeed);

        return cityMatched && needMatched && budgetMatched;
      }),
    [budgetMax, cityFilter, mapProperties, needFiltersSelected],
  );

  const selectedProperty =
    filteredProperties.find((property) => property.id === selectedPropertyId) ??
    filteredProperties[0] ??
    cityCenterProperty;

  useEffect(() => {
    setSelectedPropertyId(filteredProperties[0]?.id ?? cityCenterProperty.id);
    setMapFocusVersion((version) => version + 1);
  }, [cityCenterProperty.id, cityFilter, filteredProperties]);

  function selectProperty(property: Property, options?: { focusMap?: boolean }) {
    setSelectedPropertyId(property.id);
    if (options?.focusMap) {
      setMapFocusVersion((version) => version + 1);
    }
  }

  function toggleNeedFilter(filterId: NeedFilter) {
    if (filterId === "all") {
      setNeedFiltersSelected([]);
      return;
    }

    setNeedFiltersSelected((currentFilters) =>
      currentFilters.includes(filterId)
        ? currentFilters.filter((currentFilter) => currentFilter !== filterId)
        : [...currentFilters, filterId],
    );
  }

  const totalPlans = filteredProperties.reduce(
    (count, property) => count + property.floorPlans.length,
    0,
  );
  const currentHeroSlide = heroSlides[activeHeroSlide];
  function showHeroSlide(slideIndex: number) {
    setActiveHeroSlide((slideIndex + heroSlides.length) % heroSlides.length);
  }

  return (
    <AppShell>
      <section className="w-full px-4 pb-8 pt-6 sm:px-6 lg:px-8 2xl:px-10">
        <div className="relative min-h-[calc(100vh-112px)] overflow-hidden rounded-2xl border border-ink/10 bg-ink text-pearl shadow-soft">
          {heroSlides.map((slide, index) => (
            <Image
              key={slide.id}
              src={slide.image}
              alt={slide.alt}
              fill
              priority={index === 0}
              className={`object-cover transition-opacity duration-700 ${
                index === activeHeroSlide ? "opacity-100" : "opacity-0"
              }`}
              sizes="100vw"
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-ink/92 via-ink/62 to-ink/16" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-ink/20" />

          <div className="relative z-10 flex min-h-[calc(100vh-112px)] flex-col justify-center gap-12 p-6 sm:p-8 lg:p-10 xl:p-12">
            <div className="max-w-4xl pt-4 sm:pt-8 lg:pt-10">
              <p className="inline-flex items-center gap-2 rounded-md border border-white/16 bg-white/12 px-3 py-1.5 text-sm font-bold text-pearl backdrop-blur-xl">
                <Sparkles size={16} />
                高级 3D/VR 看房体验
              </p>
              <p className="mt-8 text-sm font-black uppercase tracking-[0.22em] text-gold">
                {currentHeroSlide.eyebrow}
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-white sm:text-6xl xl:text-7xl">
                重新理解一个家的位置、户型和空间感。
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-pearl/78 sm:text-lg">
                从楼盘位置到户型细节，再到沉浸式看房，让普通买房用户更轻松判断一套房是否适合自己。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="#map-search"
                  className="focus-ring inline-flex items-center gap-2 rounded-lg bg-jade px-6 py-3 text-sm font-bold text-white transition hover:bg-[#0b4b41]"
                >
                  开始地图找房
                  <ArrowRight size={17} />
                </Link>
              </div>
            </div>

            <div className="grid gap-6 border-t border-white/14 pt-6 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-2xl border-l-4 border-gold pl-4">
                <p className="text-sm font-bold text-gold">{currentHeroSlide.label}</p>
                <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                  {currentHeroSlide.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-pearl/72">
                  {currentHeroSlide.description}
                </p>
              </div>

              <div className="space-y-4 lg:text-right">
                <div className="flex items-center gap-3 lg:justify-end">
                  <button
                    type="button"
                    aria-label="切换到上一张首屏轮播图"
                    onClick={() => showHeroSlide(activeHeroSlide - 1)}
                    className="focus-ring grid h-11 w-11 place-items-center rounded-full border border-white/16 bg-white/12 text-white backdrop-blur-xl transition hover:bg-white/20"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="button"
                    aria-label="切换到下一张首屏轮播图"
                    onClick={() => showHeroSlide(activeHeroSlide + 1)}
                    className="focus-ring grid h-11 w-11 place-items-center rounded-full border border-white/16 bg-white/12 text-white backdrop-blur-xl transition hover:bg-white/20"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {heroSlides.map((slide, index) => (
                    <button
                      key={slide.id}
                      type="button"
                      aria-label={`切换到${slide.label}轮播图`}
                      aria-current={index === activeHeroSlide}
                      onClick={() => showHeroSlide(index)}
                      className={`focus-ring h-2.5 rounded-full transition-all ${
                        index === activeHeroSlide
                          ? "w-9 bg-gold"
                          : "w-2.5 bg-white/42 hover:bg-white/70"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="map-search"
        className="w-full scroll-mt-24 px-4 py-8 sm:px-6 lg:px-8 2xl:px-10"
      >
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold text-jade">MAP SEARCH</p>
            <h2 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
              地图找房
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/62">
              当前按城市读取数据库小区；先选城市、需求和预算，再从地图或列表定位合适户型。
            </p>
          </div>
          <div className="w-full space-y-2 rounded-xl border border-ink/10 bg-white p-2 shadow-soft lg:max-w-2xl">
            <div className="grid gap-2 sm:grid-cols-3">
              {cityFilters.map((city) => (
                <FilterButton
                  key={city}
                  active={cityFilter === city}
                  icon={<MapPin size={15} />}
                  label={city}
                  onClick={() => setCityFilter(city)}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {needFilters.map((filter) => {
                const Icon = filter.icon;
                const isActive =
                  filter.id === "all"
                    ? needFiltersSelected.length === 0
                    : needFiltersSelected.includes(filter.id);
                return (
                  <FilterButton
                    key={filter.id}
                    active={isActive}
                    icon={<Icon size={15} />}
                    label={filter.label}
                    onClick={() => toggleNeedFilter(filter.id)}
                  />
                );
              })}
            </div>
            <div className="grid gap-2 sm:grid-cols-5">
              {budgetOptions.map((option) => (
                <FilterButton
                  key={option.value}
                  active={budgetMax === option.value}
                  icon={<span className="text-xs font-black">¥</span>}
                  label={option.label}
                  onClick={() => setBudgetMax(option.value)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.42fr_0.58fr]">
          <AmapPropertyMap
            properties={filteredProperties}
            selectedProperty={selectedProperty}
            onSelectProperty={selectProperty}
            focusVersion={mapFocusVersion}
          />

          <aside className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
            <div className="sticky top-0 z-10 rounded-xl border border-ink/10 bg-[#171412] p-4 text-pearl shadow-soft">
              <p className="text-xs font-bold text-pearl/58">
                {isLoadingCommunities ? `正在读取${cityFilter}数据库` : `${cityFilter}真实小区`}
              </p>
              <p className="mt-1 text-xl font-bold">
                {filteredProperties.length} 个小区 · {totalPlans} 个户型
              </p>
            </div>

            {filteredProperties.map((property) => {
              const isSelected = selectedProperty.id === property.id;
              const matchedPlans = property.floorPlans.filter(
                (plan) => budgetMax === 0 || (plan.totalPrice ?? Infinity) <= budgetMax,
              );
              const planToShow = matchedPlans[0] ?? property.floorPlans[0];
              const visibleTags = [
                ...(property.floorPlanTags ?? []),
                ...(property.locationTags ?? []),
                ...(property.priceTags ?? []),
              ].slice(0, 5);

              return (
                <article
                  key={property.id}
                  className={`group relative rounded-xl border p-4 shadow-soft transition ${
                    isSelected
                      ? "border-jade bg-white ring-4 ring-jade/10"
                      : "border-ink/10 bg-white hover:border-ink/20"
                  }`}
                >
                  <div className="transition group-hover:translate-x-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-jade">
                          {property.city} · {property.district}
                        </p>
                        <Link
                          href={`/properties/${property.id}`}
                          className="focus-ring mt-1 block rounded-md text-lg font-bold text-ink"
                        >
                          {property.name}
                        </Link>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <FavoriteButton
                          propertyId={property.id}
                          propertySnapshot={property}
                          compact
                        />
                        <span className="rounded-md bg-mist px-3 py-1 text-xs font-bold text-moss">
                          {property.floorPlans.length} 户型
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/62">
                      {property.address}
                    </p>
                  </div>
                  {planToShow ? (
                    <Link
                      href={`/properties/${property.id}`}
                      className="focus-ring mt-3 block rounded-lg bg-pearl p-3 transition hover:bg-[#f6f1ea]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-ink">
                          {planToShow.name} · {planToShow.layout}
                        </span>
                        <span className="text-sm font-black text-[#8a5313]">
                          {planToShow.totalPrice}万
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-bold text-ink/52">
                        {planToShow.area}㎡ · {planToShow.orientation} · {planToShow.bathrooms}卫
                      </p>
                    </Link>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {visibleTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-ink/10 bg-white px-2.5 py-1 text-xs font-semibold text-ink/64"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink/8 pt-4">
                    <span className="text-sm font-bold text-ink">{property.priceRange}</span>
                    <button
                      type="button"
                      onClick={() => selectProperty(property, { focusMap: true })}
                      className="focus-ring inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-bold text-jade"
                    >
                      地图定位
                      <MapPin size={15} />
                    </button>
                  </div>
                </article>
              );
            })}

            {!isLoadingCommunities && filteredProperties.length === 0 ? (
              <div className="rounded-xl border border-ink/10 bg-white p-5 text-sm leading-6 text-ink/62 shadow-soft">
                这个预算或需求下暂时没有匹配小区，可以先放宽金额或切回“全部需求”。
              </div>
            ) : null}
          </aside>
        </div>
      </section>

    </AppShell>
  );
}

function FilterButton({
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
      className={`focus-ring inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${
        active ? "bg-ink text-pearl" : "bg-pearl text-ink/72 hover:bg-mist"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
