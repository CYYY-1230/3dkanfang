import { getPoiCategory, poiCategories, type PoiCategoryId } from "@/lib/amap-poi";
import type { Poi } from "@/lib/types";

type AmapPoi = {
  id?: string;
  name?: string;
  type?: string;
  typecode?: string;
  address?: string | unknown[];
  location?: string;
  distance?: string;
};

type AmapAroundResponse = {
  status: string;
  info?: string;
  infocode?: string;
  count?: string;
  pois?: AmapPoi[];
};

const DEFAULT_RADIUS = "1500";

function formatDistance(distance: number) {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)}km`;
  }

  return `${Math.max(1, Math.round(distance))}m`;
}

export async function fetchAmapNearbyPois({
  key,
  longitude,
  latitude,
  categoryId,
  radius = DEFAULT_RADIUS,
  offset = "12",
}: {
  key: string;
  longitude: number;
  latitude: number;
  categoryId: PoiCategoryId;
  radius?: string;
  offset?: string;
}) {
  const category = getPoiCategory(categoryId);
  const url = new URL("https://restapi.amap.com/v3/place/around");
  url.searchParams.set("key", key);
  url.searchParams.set("location", `${longitude},${latitude}`);
  url.searchParams.set("radius", radius);
  url.searchParams.set("types", category.types);
  url.searchParams.set("keywords", category.keywords);
  url.searchParams.set("offset", offset);
  url.searchParams.set("page", "1");
  url.searchParams.set("extensions", "base");
  url.searchParams.set("sortrule", "distance");
  url.searchParams.set("output", "json");

  const response = await fetch(url, {
    next: { revalidate: 60 * 60 },
  });

  if (!response.ok) {
    throw new Error("Failed to request AMap POI service.");
  }

  const payload = (await response.json()) as AmapAroundResponse;

  if (payload.status !== "1") {
    throw new Error(payload.info ?? "AMap POI service returned an error.");
  }

  return (payload.pois ?? []).map((poi) => {
    const [lng, lat] = (poi.location ?? "").split(",");

    return {
      id: poi.id,
      name: poi.name,
      category: category.label,
      type: poi.type,
      typecode: poi.typecode,
      address: Array.isArray(poi.address) ? "" : (poi.address ?? ""),
      longitude: Number(lng),
      latitude: Number(lat),
      distance: Number(poi.distance ?? 0),
    };
  });
}

export async function getPropertyNearbyPois({
  longitude,
  latitude,
  limitPerCategory = 2,
}: {
  longitude: number;
  latitude: number;
  limitPerCategory?: number;
}): Promise<Poi[]> {
  const key = process.env.AMAP_WEB_SERVICE_KEY;

  if (!key) {
    return [];
  }

  const results = await Promise.allSettled(
    poiCategories.map((category) =>
      fetchAmapNearbyPois({
        key,
        longitude,
        latitude,
        categoryId: category.id,
        offset: `${limitPerCategory}`,
      }),
    ),
  );

  return results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((poi) => poi.id && poi.name)
    .map((poi) => ({
      id: poi.id ?? `${poi.category}-${poi.name}`,
      name: poi.name ?? "未命名配套",
      category: poi.category,
      distance: formatDistance(poi.distance),
    }));
}
