"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Minus, Plus } from "lucide-react";
import { getPoiCategory, poiCategories, type PoiCategoryId } from "@/lib/amap-poi";
import type { Property } from "@/lib/types";

declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode: string;
    };
    AMapLoader?: {
      load: (options: {
        key: string;
        version: string;
        plugins?: string[];
      }) => Promise<AmapApi>;
    };
  }
}

type AmapLngLat = [number, number];

type AmapApi = {
  Map: new (
    container: HTMLDivElement,
    options: {
      center: AmapLngLat;
      zoom: number;
      zooms?: [number, number];
      viewMode?: "2D" | "3D";
      mapStyle?: string;
      resizeEnable?: boolean;
      zoomEnable?: boolean;
      scrollWheel?: boolean;
      doubleClickZoom?: boolean;
      touchZoom?: boolean;
      dragEnable?: boolean;
    },
  ) => AmapMap;
  Marker: new (options: {
    position: AmapLngLat;
    content?: HTMLElement;
    title?: string;
    anchor?: string;
    offset?: AmapPixel;
  }) => AmapMarker;
  Pixel: new (x: number, y: number) => AmapPixel;
  LngLat: new (longitude: number, latitude: number) => AmapLngLatObject;
};

type AmapMap = {
  add: (item: AmapMarker | AmapMarker[]) => void;
  remove: (item: AmapMarker | AmapMarker[]) => void;
  setFitView: (markers?: AmapMarker[], immediately?: boolean, avoid?: number[], maxZoom?: number) => void;
  setCenter: (center: AmapLngLat) => void;
  setZoom: (zoom: number) => void;
  getZoom: () => number;
  on: (eventName: string, handler: () => void) => void;
  destroy: () => void;
};

type AmapMarker = {
  on: (eventName: string, handler: () => void) => void;
  setContent: (content: HTMLElement) => void;
  setzIndex: (zIndex: number) => void;
};

type AmapPixel = unknown;
type AmapLngLatObject = unknown;

type AmapPoiResult = {
  id?: string;
  name?: string;
  category?: string;
  address?: string;
  longitude: number;
  latitude: number;
  distance?: number;
};

type AmapPoiResponse = {
  category: string;
  count: number;
  pois: AmapPoiResult[];
  error?: string;
};

const amapLoaderSrc = "https://webapi.amap.com/loader.js";
const mapMinZoom = 5;
const mapMaxZoom = 18;
const markerCardZoom = 16;

let loaderPromise: Promise<AmapApi> | null = null;
const poiCache = new Map<string, AmapPoiResponse>();

function createMarkerContent({
  label,
  caption,
  active,
  poi,
  community,
  compact,
}: {
  label: string;
  caption: string;
  active?: boolean;
  poi?: boolean;
  community?: boolean;
  compact?: boolean;
}) {
  const wrapper = document.createElement("div");
  wrapper.className = [
    "amap-custom-marker",
    poi ? "amap-poi-marker" : "amap-property-marker",
    community ? "amap-community-marker" : "",
    compact ? "is-compact" : "",
    active ? "is-active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const icon = document.createElement("span");
  icon.className = "amap-marker-icon";
  icon.textContent = poi ? "·" : community ? "◇" : "⌂";

  const text = document.createElement("span");
  text.className = "amap-marker-text";

  const strong = document.createElement("strong");
  strong.textContent = label;

  const small = document.createElement("small");
  small.textContent = caption;

  text.append(strong, small);
  wrapper.append(icon, text);
  return wrapper;
}

function loadAmap() {
  const key = process.env.NEXT_PUBLIC_AMAP_JS_KEY;
  const securityJsCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE;

  if (!key || !securityJsCode) {
    return Promise.reject(new Error("高德地图 JS Key 或安全密钥没有配置。"));
  }

  if (loaderPromise) {
    return loaderPromise;
  }

  window._AMapSecurityConfig = { securityJsCode };

  loaderPromise = new Promise<AmapApi>((resolve, reject) => {
    if (window.AMapLoader) {
      window.AMapLoader.load({
        key,
        version: "2.0",
      })
        .then(resolve)
        .catch(reject);
      return;
    }

    const script = document.createElement("script");
    script.src = amapLoaderSrc;
    script.async = true;
    script.onload = () => {
      if (!window.AMapLoader) {
        reject(new Error("高德地图 loader 加载失败。"));
        return;
      }

      window.AMapLoader.load({
        key,
        version: "2.0",
      })
        .then(resolve)
        .catch(reject);
    };
    script.onerror = () => reject(new Error("高德地图 loader 脚本加载失败。"));
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export function AmapPropertyMap({
  properties,
  selectedProperty,
  onSelectProperty,
  focusVersion = 0,
}: {
  properties: Property[];
  selectedProperty: Property;
  onSelectProperty: (property: Property) => void;
  focusVersion?: number;
}) {
  const router = useRouter();
  const mapRef = useRef<AmapMap | null>(null);
  const amapRef = useRef<AmapApi | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialCenterRef = useRef<AmapLngLat>([
    selectedProperty.longitude,
    selectedProperty.latitude,
  ]);
  const selectedPropertyIdRef = useRef(selectedProperty.id);
  const focusVersionRef = useRef(focusVersion);
  const propertyMarkersRef = useRef(new Map<string, AmapMarker>());
  const poiMarkersRef = useRef<AmapMarker[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [categoryId, setCategoryId] = useState<PoiCategoryId>("transit");
  const [pois, setPois] = useState<AmapPoiResult[]>([]);
  const [poisLoading, setPoisLoading] = useState(false);
  const [poisError, setPoisError] = useState("");
  const [previewProperty, setPreviewProperty] = useState<Property | null>(null);
  const [mapZoom, setMapZoom] = useState(12);
  const activeProperty = previewProperty ?? selectedProperty;
  const showMarkerCards = mapZoom >= markerCardZoom;

  const center = useMemo<AmapLngLat>(
    () => [activeProperty.longitude, activeProperty.latitude],
    [activeProperty.latitude, activeProperty.longitude],
  );

  const zoomMapBy = useCallback((delta: number) => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const nextZoom = Math.min(
      mapMaxZoom,
      Math.max(mapMinZoom, map.getZoom() + delta),
    );
    map.setZoom(nextZoom);
    setMapZoom(nextZoom);
  }, []);

  const refreshPropertyMarkers = useCallback(() => {
    const AMap = amapRef.current;
    const map = mapRef.current;

    if (!AMap || !map) {
      return;
    }

    const oldMarkers = Array.from(propertyMarkersRef.current.values());
    if (oldMarkers.length > 0) {
      map.remove(oldMarkers);
    }
    propertyMarkersRef.current.clear();

    if (!showMarkerCards) {
      return;
    }

    const nextMarkers = properties.map((property) => {
      const active = property.id === activeProperty.id;
      const marker = new AMap.Marker({
        position: [property.longitude, property.latitude],
        title: property.name,
          content: createMarkerContent({
            label: property.name,
            caption: `${property.district} · ${property.priceRange}`,
            active,
            compact: !showMarkerCards,
          }),
        offset: new AMap.Pixel(-18, -44),
      });
      marker.setzIndex(active ? 120 : 80);
      marker.on("click", () => {
        setPreviewProperty(null);
        onSelectProperty(property);
        router.push(`/properties/${property.id}`);
      });
      propertyMarkersRef.current.set(property.id, marker);
      return marker;
    });

    map.add(nextMarkers);
  }, [activeProperty.id, onSelectProperty, properties, router, showMarkerCards]);

  const refreshPoiMarkers = useCallback(() => {
    const AMap = amapRef.current;
    const map = mapRef.current;

    if (!AMap || !map) {
      return;
    }

    if (poiMarkersRef.current.length > 0) {
      map.remove(poiMarkersRef.current);
      poiMarkersRef.current = [];
    }

    if (!showMarkerCards) {
      return;
    }

    const category = getPoiCategory(categoryId);
    const nextMarkers = pois
      .filter((poi) => Number.isFinite(poi.longitude) && Number.isFinite(poi.latitude))
      .map((poi) => {
        const marker = new AMap.Marker({
          position: [poi.longitude, poi.latitude],
          title: poi.name,
          content: createMarkerContent({
            label: poi.name ?? category.label,
            caption: `${category.label} · ${Math.round(poi.distance ?? 0)}m`,
            poi: true,
            compact: !showMarkerCards,
          }),
          offset: new AMap.Pixel(-12, -34),
        });
        marker.setzIndex(40);
        return marker;
      });

    poiMarkersRef.current = nextMarkers;
    if (nextMarkers.length > 0) {
      map.add(nextMarkers);
    }
  }, [categoryId, pois, showMarkerCards]);

  useEffect(() => {
    let disposed = false;
    const propertyMarkers = propertyMarkersRef.current;

    loadAmap()
      .then((AMap) => {
        if (disposed || !containerRef.current) {
          return;
        }

        amapRef.current = AMap;
        const map = new AMap.Map(containerRef.current, {
          center: initialCenterRef.current,
          zoom: 12,
          zooms: [mapMinZoom, mapMaxZoom],
          viewMode: "2D",
          mapStyle: "amap://styles/whitesmoke",
          resizeEnable: true,
          zoomEnable: true,
          scrollWheel: true,
          doubleClickZoom: true,
          touchZoom: true,
          dragEnable: true,
        });
        mapRef.current = map;
        setMapZoom(map.getZoom());
        map.on("zoomend", () => setMapZoom(map.getZoom()));
        setStatus("ready");
      })
      .catch((error: Error) => {
        if (!disposed) {
          setStatus("error");
          setErrorMessage(error.message);
        }
      });

    return () => {
      disposed = true;
      mapRef.current?.destroy();
      mapRef.current = null;
      amapRef.current = null;
      propertyMarkers.clear();
      poiMarkersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    const map = mapRef.current;

    if (!map) {
      return;
    }

    map.setCenter(center);
    const shouldFocusSelected = focusVersionRef.current !== focusVersion;
    focusVersionRef.current = focusVersion;
    const nextZoom = previewProperty
      ? markerCardZoom
      : shouldFocusSelected
        ? mapMaxZoom
        : map.getZoom();
    map.setZoom(nextZoom);
    setMapZoom(nextZoom);
  }, [center, focusVersion, previewProperty, status]);

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    refreshPropertyMarkers();
  }, [refreshPropertyMarkers, status]);

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    refreshPoiMarkers();
  }, [refreshPoiMarkers, status]);

  useEffect(() => {
    if (selectedPropertyIdRef.current !== selectedProperty.id) {
      selectedPropertyIdRef.current = selectedProperty.id;
      setPreviewProperty(null);
    }
  }, [selectedProperty.id]);

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    const controller = new AbortController();
    const category = getPoiCategory(categoryId);
    const cacheKey = `${activeProperty.id},${activeProperty.longitude},${activeProperty.latitude},${category.id}`;
    const cachedPayload = poiCache.get(cacheKey);

    if (cachedPayload) {
      setPois(cachedPayload.pois ?? []);
      setPoisError("");
      setPoisLoading(false);
      return;
    }

    setPoisLoading(true);
    setPoisError("");

    const params = new URLSearchParams({
      propertyId: activeProperty.id,
      lng: `${activeProperty.longitude}`,
      lat: `${activeProperty.latitude}`,
      category: category.id,
    });

    fetch(`/api/amap/pois?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as AmapPoiResponse;
        if (!response.ok || payload.error) {
          throw new Error(payload.error ?? "周边配套查询失败。");
        }
        poiCache.set(cacheKey, payload);
        setPois(payload.pois ?? []);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setPois([]);
          setPoisError(error.message);
        }
      })
      .finally(() => setPoisLoading(false));

    return () => controller.abort();
  }, [activeProperty.id, activeProperty.latitude, activeProperty.longitude, categoryId, status]);

  return (
    <div className="relative h-full min-h-[620px] overflow-hidden rounded-2xl bg-ink text-pearl shadow-soft">
      <div ref={containerRef} className="absolute inset-0" />

      {status === "loading" ? (
        <div className="absolute inset-0 grid place-items-center bg-ink text-pearl">
          <div className="flex items-center gap-3 rounded-xl border border-white/12 bg-white/10 px-4 py-3 text-sm font-bold">
            <Loader2 className="animate-spin" size={18} />
            正在加载高德地图
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="absolute inset-0 grid place-items-center bg-ink p-6 text-pearl">
          <div className="max-w-md rounded-2xl border border-white/12 bg-white/10 p-5 text-center">
            <p className="text-lg font-bold">地图加载失败</p>
            <p className="mt-2 text-sm leading-6 text-pearl/64">{errorMessage}</p>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-ink/60 to-transparent p-5 sm:p-7">
        <p className="inline-flex items-center gap-2 rounded-md bg-white/14 px-3 py-1.5 text-sm font-bold text-pearl">
          <MapPin size={16} />
          真实高德地图
        </p>
      </div>

      <div className="absolute right-5 top-20 grid overflow-hidden rounded-lg border border-white/18 bg-[#171412]/82 text-pearl shadow-soft backdrop-blur-md sm:right-7 sm:top-24">
        <button
          type="button"
          aria-label="放大地图"
          title="放大地图"
          onClick={() => zoomMapBy(1)}
          className="focus-ring grid size-10 place-items-center transition hover:bg-white/12 disabled:cursor-not-allowed disabled:text-pearl/30"
          disabled={mapZoom >= mapMaxZoom}
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          aria-label="缩小地图"
          title="缩小地图"
          onClick={() => zoomMapBy(-1)}
          className="focus-ring grid size-10 place-items-center border-t border-white/12 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:text-pearl/30"
          disabled={mapZoom <= mapMinZoom}
        >
          <Minus size={18} />
        </button>
      </div>

      {showMarkerCards ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-col gap-3 sm:inset-x-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="pointer-events-auto max-w-2xl rounded-xl border border-white/12 bg-[#171412] px-4 py-3 text-pearl shadow-soft">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-pearl/60">当前选中</span>
                <h3 className="truncate text-lg font-bold text-white sm:text-xl">
                  {activeProperty.name}
                </h3>
                {previewProperty ? (
                  <span className="rounded-md bg-[#f6ebd8] px-2 py-1 text-xs font-bold text-[#6f4717]">
                    AI 示意资料
                  </span>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-pearl/78 sm:line-clamp-1 sm:text-sm">
                {activeProperty.summary}
              </p>
              {previewProperty ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {previewProperty.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-white/12 bg-white/8 px-2 py-0.5 text-[11px] font-bold text-pearl/70"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="pointer-events-auto w-full max-w-[430px] rounded-xl border border-white/12 bg-[#171412] px-3 py-3 text-pearl shadow-soft">
            <div className="grid min-w-0 gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-pearl/72">
                  已加载 {properties.length} 个真实小区
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {poiCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setCategoryId(category.id)}
                      className={`focus-ring min-h-8 rounded-md px-2.5 py-1 text-xs font-bold transition ${
                        categoryId === category.id
                          ? "bg-[#f6ebd8] text-[#6f4717]"
                          : "bg-white/10 text-pearl/78 hover:bg-white/16"
                      }`}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2">
                {poisError ? (
                  <p className="text-xs leading-5 text-[#f6ebd8]">{poisError}</p>
                ) : (
                  <div className="grid gap-1">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-bold text-white">
                        {getPoiCategory(categoryId).label}配套
                      </span>
                      <span className="text-pearl/60">
                        {poisLoading ? "查询中" : `${pois.length} 个结果`}
                      </span>
                    </div>
                    {pois.slice(0, 2).map((poi) => (
                      <p
                        key={`${poi.id}-${poi.name}`}
                        className="flex items-center justify-between gap-3 text-xs text-pearl/78"
                      >
                        <span className="truncate">{poi.name}</span>
                        <span className="shrink-0">{Math.round(poi.distance ?? 0)}m</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
