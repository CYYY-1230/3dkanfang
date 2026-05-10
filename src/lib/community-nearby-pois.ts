import { fetchAmapNearbyPois } from "@/lib/amap-nearby-pois";
import { poiCategories, type PoiCategoryId } from "@/lib/amap-poi";
import { ensureCommunityStored, getCommunityLookupKey } from "@/lib/community-ingest";
import { prisma } from "@/lib/prisma";
import type { Poi } from "@/lib/types";

const poiCategoryLabels = ["交通", "教育", "商业", "医疗", "公园"] as const;

function formatDistance(distance: number) {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)}km`;
  }

  return `${Math.max(1, Math.round(distance))}m`;
}

function toPoiCategory(category: string): Poi["category"] {
  return poiCategoryLabels.includes(category as Poi["category"])
    ? (category as Poi["category"])
    : "商业";
}

async function findCommunityRecord(propertyId: string) {
  const lookupKey = getCommunityLookupKey(propertyId);
  return prisma.communityPoi.findFirst({
    where: {
      OR: [{ id: lookupKey }, { amapId: lookupKey }],
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
    },
  });
}

export async function collectCommunityNearbyPois({
  propertyId,
  categoryId,
}: {
  propertyId: string;
  categoryId?: PoiCategoryId;
}) {
  await ensureCommunityStored(propertyId);
  const community = await findCommunityRecord(propertyId);
  const key = process.env.AMAP_WEB_SERVICE_KEY;

  if (!community || !key) {
    return [];
  }

  const categories = categoryId
    ? poiCategories.filter((category) => category.id === categoryId)
    : poiCategories;
  const settledPois = await Promise.allSettled(
    categories.map((category) =>
      fetchAmapNearbyPois({
        key,
        longitude: community.longitude,
        latitude: community.latitude,
        categoryId: category.id,
        offset: "12",
      }),
    ),
  );
  const pois = settledPois.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );

  for (const poi of pois) {
    if (!poi.name || !Number.isFinite(poi.longitude) || !Number.isFinite(poi.latitude)) {
      continue;
    }

    await prisma.communityNearbyPoi.upsert({
      where: {
        communityPoiId_amapId_category: {
          communityPoiId: community.id,
          amapId: poi.id ?? `${poi.category}-${poi.name}`,
          category: poi.category,
        },
      },
      create: {
        communityPoiId: community.id,
        amapId: poi.id ?? `${poi.category}-${poi.name}`,
        name: poi.name,
        category: poi.category,
        type: poi.type,
        typecode: poi.typecode,
        address: poi.address,
        longitude: poi.longitude,
        latitude: poi.latitude,
        distance: Math.round(poi.distance),
        collectedAt: new Date(),
      },
      update: {
        name: poi.name,
        type: poi.type,
        typecode: poi.typecode,
        address: poi.address,
        longitude: poi.longitude,
        latitude: poi.latitude,
        distance: Math.round(poi.distance),
        collectedAt: new Date(),
      },
    });
  }

  return getStoredCommunityNearbyPois({ propertyId, categoryId });
}

export async function getStoredCommunityNearbyPois({
  propertyId,
  categoryId,
}: {
  propertyId: string;
  categoryId?: PoiCategoryId;
}) {
  const community = await findCommunityRecord(propertyId);

  if (!community) {
    return [];
  }

  return prisma.communityNearbyPoi.findMany({
    where: {
      communityPoiId: community.id,
      ...(categoryId ? { category: poiCategories.find((category) => category.id === categoryId)?.label } : {}),
    },
    orderBy: [{ category: "asc" }, { distance: "asc" }],
    ...(categoryId ? { take: 12 } : {}),
  });
}

export async function getCommunityNearbyPois({
  propertyId,
  categoryId,
}: {
  propertyId: string;
  categoryId?: PoiCategoryId;
}) {
  const storedPois = await getStoredCommunityNearbyPois({ propertyId, categoryId });

  if (storedPois.length > 0 || process.env.NODE_ENV === "production") {
    return storedPois;
  }

  return collectCommunityNearbyPois({ propertyId, categoryId });
}

export async function getCommunityNearbyPoiSummary(propertyId: string): Promise<Poi[]> {
  const storedPois = await getStoredCommunityNearbyPois({ propertyId });
  const balancedPois = poiCategoryLabels.flatMap((category) =>
    storedPois.filter((poi) => poi.category === category),
  );

  return balancedPois.map((poi) => ({
    id: poi.amapId ?? poi.id,
    name: poi.name,
    category: toPoiCategory(poi.category),
    distance: formatDistance(poi.distance),
  }));
}
