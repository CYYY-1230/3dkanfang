import { createGeneratedProperty } from "@/lib/generated-property";
import { getCityOption } from "@/lib/city-options";
import type { Property } from "@/lib/types";

export type AmapCommunityPoi = {
  id?: string;
  name?: string;
  type?: string;
  typecode?: string;
  address?: string | unknown[];
  location?: string;
  distance?: string;
  pname?: string;
  cityname?: string | string[];
  adname?: string;
};

type AmapCommunityResponse = {
  status: string;
  info?: string;
  infocode?: string;
  count?: string;
  pois?: AmapCommunityPoi[];
};

export type CommunityCollectionResult = {
  communities: Property[];
  rawPois: AmapCommunityPoi[];
  requestCount: number;
};

const DEFAULT_RADIUS = "12000";
const CITY_SEARCH_RADIUS = "15000";
const CITY_SEARCH_PAGES = 3;
const CITY_SEARCH_BATCH_SIZE = 4;
const PAGE_SIZE = "25";

function normalizeText(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

async function fetchCommunityPayload({
  key,
  city,
  longitude,
  latitude,
  radius,
  page,
  withKeywords,
}: {
  key: string;
  city: string;
  longitude: number;
  latitude: number;
  radius: string;
  page: number;
  withKeywords: boolean;
}) {
  const url = new URL("https://restapi.amap.com/v3/place/around");
  url.searchParams.set("key", key);
  url.searchParams.set("city", city);
  url.searchParams.set("citylimit", "true");
  url.searchParams.set("types", "120300");
  if (withKeywords) {
    url.searchParams.set("keywords", "小区|花园|公寓|名邸|家园|苑|府|城|湾|园");
  }
  url.searchParams.set("offset", PAGE_SIZE);
  url.searchParams.set("page", `${page}`);
  url.searchParams.set("extensions", "base");
  url.searchParams.set("location", `${longitude},${latitude}`);
  url.searchParams.set("radius", radius);
  url.searchParams.set("sortrule", "distance");
  url.searchParams.set("output", "json");

  const response = await fetch(url, {
    next: { revalidate: 60 * 60 },
  });

  if (!response.ok) {
    throw new Error("Failed to request AMap community service.");
  }

  const payload = (await response.json()) as AmapCommunityResponse;

  if (payload.status !== "1") {
    throw new Error(payload.info ?? "AMap community service returned an error.");
  }

  return payload;
}

export function createPropertyFromAmapPoi(poi: AmapCommunityPoi, includeDistance: boolean) {
  const [lng, lat] = (poi.location ?? "").split(",");

  return createGeneratedProperty({
    id: poi.id,
    name: poi.name,
    city: normalizeText(poi.cityname),
    district: poi.adname,
    address: Array.isArray(poi.address) ? "" : (poi.address ?? ""),
    longitude: Number(lng),
    latitude: Number(lat),
    distance: includeDistance ? Number(poi.distance ?? 0) : undefined,
  });
}

export async function collectAmapCommunityPois({
  key,
  city = "杭州",
  scope = "city",
  longitude,
  latitude,
  radius = DEFAULT_RADIUS,
}: {
  key: string;
  city?: string;
  scope?: "around" | "city";
  longitude?: number;
  latitude?: number;
  radius?: string;
}): Promise<CommunityCollectionResult> {
  if (scope !== "city" && (!Number.isFinite(longitude) || !Number.isFinite(latitude))) {
    throw new Error("lng and lat query parameters are required.");
  }

  const searchCenters =
    scope === "city"
      ? getCityOption(city).searchCenters
      : ([[longitude as number, latitude as number]] as const);
  const pageCount = scope === "city" ? CITY_SEARCH_PAGES : 1;
  const requests = searchCenters.flatMap(([centerLongitude, centerLatitude]) => {
    const keywordRequests = Array.from({ length: pageCount }, (_, index) => ({
      longitude: centerLongitude,
      latitude: centerLatitude,
      page: index + 1,
      withKeywords: true,
    }));

    if (scope !== "city") {
      return keywordRequests;
    }

    return [
      ...keywordRequests,
      {
        longitude: centerLongitude,
        latitude: centerLatitude,
        page: 1,
        withKeywords: false,
      },
    ];
  });

  const payloads: AmapCommunityResponse[] = [];

  for (let index = 0; index < requests.length; index += CITY_SEARCH_BATCH_SIZE) {
    const batch = requests.slice(index, index + CITY_SEARCH_BATCH_SIZE);
    const settledPayloads = await Promise.allSettled(
      batch.map((requestConfig) =>
        fetchCommunityPayload({
          key,
          city,
          longitude: requestConfig.longitude,
          latitude: requestConfig.latitude,
          radius: scope === "city" ? CITY_SEARCH_RADIUS : radius,
          page: requestConfig.page,
          withKeywords: requestConfig.withKeywords,
        }),
      ),
    );

    for (const result of settledPayloads) {
      if (result.status === "fulfilled") {
        payloads.push(result.value);
      } else if (scope !== "city") {
        throw result.reason;
      }
    }
  }

  if (payloads.length === 0) {
    throw new Error("AMap community service returned no usable city results.");
  }

  const seen = new Set<string>();
  const rawPois: AmapCommunityPoi[] = [];
  const communities = payloads
    .flatMap((payload) => payload.pois ?? [])
    .map((poi) => ({
      poi,
      property: createPropertyFromAmapPoi(poi, scope !== "city"),
    }))
    .filter(({ property }) => {
      const dedupeKey = property.id || `${property.name}-${property.longitude}-${property.latitude}`;
      if (
        !Number.isFinite(property.longitude) ||
        !Number.isFinite(property.latitude) ||
        (city && !property.city.includes(city)) ||
        seen.has(dedupeKey)
      ) {
        return false;
      }

      seen.add(dedupeKey);
      return true;
    })
    .map(({ poi, property }) => {
      rawPois.push(poi);
      return property;
    })
    .sort((first, second) =>
      `${first.district}${first.name}`.localeCompare(`${second.district}${second.name}`, "zh-CN"),
    );

  return {
    communities,
    rawPois,
    requestCount: requests.length,
  };
}
