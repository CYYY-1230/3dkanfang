import { Prisma } from "@prisma/client";
import {
  createPropertyFromAmapPoi,
  type AmapCommunityPoi,
} from "@/lib/amap-communities";
import { canUseLiveAmapApi } from "@/lib/amap-live-api";
import { generateCommunityDerivedData } from "@/lib/community-derived-data";
import { buildCommunityRoomsForFloorPlan } from "@/lib/community-vr-templates";
import { prisma } from "@/lib/prisma";

function toNestedRoomAssetCreateData(asset: ReturnType<typeof buildCommunityRoomsForFloorPlan>[number]["assets"][number]) {
  return {
    id: asset.id,
    styleId: asset.styleId,
    styleName: asset.styleName,
    type: asset.type,
    imageUrl: asset.imageUrl,
    prompt: asset.prompt,
    status: asset.status,
    qcStatus: asset.qcStatus,
    qcError: asset.qcError,
  };
}

export function getCommunityLookupKey(propertyId: string) {
  return propertyId.startsWith("amap-") ? propertyId.slice("amap-".length) : propertyId;
}

export async function fetchAmapCommunityDetail(amapId: string) {
  const key = process.env.AMAP_WEB_SERVICE_KEY;

  if (!key) {
    return null;
  }

  const url = new URL("https://restapi.amap.com/v3/place/detail");
  url.searchParams.set("key", key);
  url.searchParams.set("id", amapId);
  url.searchParams.set("extensions", "base");
  url.searchParams.set("output", "json");

  const response = await fetch(url, {
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    status: string;
    pois?: AmapCommunityPoi[];
  };

  return payload.status === "1" ? (payload.pois?.[0] ?? null) : null;
}

export async function upsertCommunityFromAmapPoi(rawPoi: AmapCommunityPoi) {
  const property = createPropertyFromAmapPoi(rawPoi, false);
  const raw = JSON.parse(JSON.stringify(rawPoi)) as Prisma.InputJsonValue;
  const derived = generateCommunityDerivedData({
    id: rawPoi.id ?? property.id,
    name: property.name,
    city: property.city,
    district: property.district,
    address: property.address,
    priceRange: property.priceRange,
    longitude: property.longitude,
    latitude: property.latitude,
  });
  const data = {
    amapId: rawPoi.id ?? null,
    name: property.name,
    city: property.city,
    district: property.district,
    address: property.address,
    latitude: property.latitude,
    longitude: property.longitude,
    priceRange: property.priceRange,
    summary: property.summary,
    tags: [
      ...new Set([
        ...property.tags,
        ...derived.floorPlanTags,
        ...derived.locationTags,
        ...derived.priceTags,
      ]),
    ],
    floorPlanTags: derived.floorPlanTags,
    locationTags: derived.locationTags,
    priceTags: derived.priceTags,
    minTotalPrice: derived.minTotalPrice,
    maxTotalPrice: derived.maxTotalPrice,
    raw,
    collectedAt: new Date(),
  };
  const existing = rawPoi.id
    ? await prisma.communityPoi.findUnique({
        where: { amapId: rawPoi.id },
        select: { id: true },
      })
    : null;
  const savedCommunity = rawPoi.id
    ? await prisma.communityPoi.upsert({
        where: { amapId: rawPoi.id },
        create: data,
        update: data,
        select: { id: true },
      })
    : await prisma.communityPoi.create({
        data,
        select: { id: true },
      });

  if (!existing) {
    for (const plan of derived.floorPlans) {
      const floorPlanId = `${savedCommunity.id}-${plan.name.replace(/\s+/g, "-")}`;
      const rooms = buildCommunityRoomsForFloorPlan({
        id: floorPlanId,
        layout: plan.layout,
        name: plan.name,
        tags: plan.tags,
      });

      await prisma.communityFloorPlan.create({
        data: {
          id: floorPlanId,
          communityPoiId: savedCommunity.id,
          name: plan.name,
          area: plan.area,
          layout: plan.layout,
          orientation: plan.orientation,
          bathrooms: plan.bathrooms,
          balcony: plan.balcony,
          totalPrice: plan.totalPrice,
          tags: plan.tags,
          imageUrl: plan.imageUrl,
          rooms: {
            create: rooms.map((room) => ({
              id: room.id,
              name: room.name,
              type: room.type,
              sortOrder: room.sortOrder,
              defaultYaw: room.defaultYaw,
              adjacent: room.adjacent,
              hotspots: room.hotspots,
              assets: {
                create: room.assets.map(toNestedRoomAssetCreateData),
              },
            })),
          },
        },
      });
    }
  }

  return savedCommunity.id;
}

export async function ensureCommunityStored(propertyId: string) {
  const lookupKey = getCommunityLookupKey(propertyId);
  const existing = await prisma.communityPoi.findFirst({
    where: {
      OR: [{ id: lookupKey }, { amapId: lookupKey }],
    },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  if (!propertyId.startsWith("amap-")) {
    return null;
  }

  if (!canUseLiveAmapApi()) {
    return null;
  }

  const poi = await fetchAmapCommunityDetail(lookupKey);

  return poi ? upsertCommunityFromAmapPoi(poi) : null;
}
