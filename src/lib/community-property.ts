import { unstable_cache } from "next/cache";
import {
  collectAmapCommunityPois,
  createPropertyFromAmapPoi,
} from "@/lib/amap-communities";
import { canUseLiveAmapApi } from "@/lib/amap-live-api";
import {
  fetchAmapCommunityDetail,
  getCommunityLookupKey,
  upsertCommunityFromAmapPoi,
} from "@/lib/community-ingest";
import { communityCoverImage } from "@/lib/community-cover";
import { applyDerivedDataToProperty, toFloorPlan } from "@/lib/community-derived-data";
import { prisma } from "@/lib/prisma";
import type { Property, Room } from "@/lib/types";

type CommunityWithPlans = NonNullable<
  Awaited<ReturnType<typeof prisma.communityPoi.findFirst>>
> & {
  floorPlans: {
    id: string;
    name: string;
    area: number;
    layout: string;
    orientation: string;
    bathrooms: number;
    balcony: boolean;
    totalPrice: number;
    tags: string[];
    imageUrl: string;
    rooms?: {
      id: string;
      name: string;
      type: string;
      sortOrder: number;
      defaultYaw: number;
      adjacent: string[];
      hotspots: unknown;
      assets: {
        id: string;
        styleId: string;
        styleName: string;
        type: string;
        imageUrl: string;
        prompt: string;
        status: string;
        qcStatus: string;
        qcError: string | null;
      }[];
    }[];
  }[];
};

async function getLiveCommunityProperty(propertyId: string) {
  if (!propertyId.startsWith("amap-")) {
    return undefined;
  }

  const poi = await fetchAmapCommunityDetail(getCommunityLookupKey(propertyId));
  if (!poi) {
    return undefined;
  }

  await upsertCommunityFromAmapPoi(poi);
  return applyDerivedDataToProperty(createPropertyFromAmapPoi(poi, false));
}

function communityToProperty(community: CommunityWithPlans): Property {
  const propertyId = `amap-${community.amapId ?? community.id}`;

  return {
    id: propertyId,
    name: community.name,
    city: community.city,
    district: community.district,
    address: community.address,
    latitude: community.latitude,
    longitude: community.longitude,
    priceRange: community.priceRange,
    summary: community.summary,
    coverImage: communityCoverImage,
    tags: [
      ...new Set([
        ...community.tags,
        ...community.floorPlanTags,
        ...community.locationTags,
        ...community.priceTags,
      ]),
    ],
    floorPlanTags: community.floorPlanTags,
    locationTags: community.locationTags,
    priceTags: community.priceTags,
    minTotalPrice: community.minTotalPrice ?? undefined,
    maxTotalPrice: community.maxTotalPrice ?? undefined,
    pois: [],
    floorPlans: community.floorPlans.map((plan) => {
      const floorPlan = toFloorPlan({
        id: plan.id,
        propertyId,
        plan,
      });

      return {
        ...floorPlan,
        rooms: (plan.rooms ?? [])
          .slice()
          .sort((first, second) => first.sortOrder - second.sortOrder)
          .map((room): Room => ({
            id: room.id,
            floorPlanId: plan.id,
            name: room.name,
            type: room.type as Room["type"],
            sortOrder: room.sortOrder,
            defaultYaw: room.defaultYaw,
            adjacent: room.adjacent,
            hotspots: Array.isArray(room.hotspots) ? (room.hotspots as Room["hotspots"]) : [],
            assets: room.assets.map((asset) => ({
              id: asset.id,
              roomId: room.id,
              styleId: asset.styleId,
              styleName: asset.styleName,
              type: asset.type as Room["assets"][number]["type"],
              imageUrl: asset.imageUrl,
              prompt: asset.prompt,
              status: asset.status,
              qcStatus: asset.qcStatus,
              qcError: asset.qcError ?? undefined,
            })),
          })),
      };
    }),
  };
}

export async function getCommunityProperty(propertyId: string) {
  const lookupKey = getCommunityLookupKey(propertyId);
  const community = await prisma.communityPoi.findFirst({
    where: {
      OR: [{ id: lookupKey }, { amapId: lookupKey }],
    },
    include: {
      floorPlans: {
        orderBy: [{ totalPrice: "asc" }, { area: "asc" }],
        include: {
          rooms: {
            orderBy: { sortOrder: "asc" },
            include: {
              assets: {
                orderBy: { styleId: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (community) {
    return communityToProperty(community);
  }

  if (propertyId.startsWith("amap-")) {
    const properties = await getCommunityProperties();
    const storedProperty = properties.find((property) => property.id === propertyId);

    if (storedProperty || !canUseLiveAmapApi()) {
      return storedProperty;
    }

    return getLiveCommunityProperty(propertyId);
  }

  return undefined;
}

async function getCommunityPropertiesUncached(city = "杭州") {
  const communities = await prisma.communityPoi.findMany({
    where: {
      city: {
        contains: city,
      },
    },
    orderBy: [{ district: "asc" }, { name: "asc" }],
    include: {
      floorPlans: {
        orderBy: [{ totalPrice: "asc" }, { area: "asc" }],
      },
    },
  });

  const storedProperties = communities.map((community) => communityToProperty(community));

  if (storedProperties.length > 0) {
    return storedProperties;
  }

  if (!canUseLiveAmapApi() || !process.env.AMAP_WEB_SERVICE_KEY) {
    return storedProperties;
  }

  const result = await collectAmapCommunityPois({
    key: process.env.AMAP_WEB_SERVICE_KEY,
    city,
    scope: "city",
  });

  return result.communities.map(applyDerivedDataToProperty);
}

export const getCommunityProperties = unstable_cache(
  getCommunityPropertiesUncached,
  ["community-properties"],
  {
    revalidate: 300,
    tags: ["community-properties"],
  },
);

export async function getCommunityFloorPlan(floorPlanId: string) {
  const floorPlan = await prisma.communityFloorPlan.findUnique({
    where: { id: floorPlanId },
    include: {
      communityPoi: {
        include: {
          floorPlans: {
            orderBy: [{ totalPrice: "asc" }, { area: "asc" }],
            include: {
              rooms: {
                orderBy: { sortOrder: "asc" },
                include: {
                  assets: {
                    orderBy: { styleId: "asc" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!floorPlan) {
    return undefined;
  }

  const property = communityToProperty(floorPlan.communityPoi);
  const matchedFloorPlan = property.floorPlans.find((plan) => plan.id === floorPlanId);

  if (!matchedFloorPlan) {
    return undefined;
  }

  return {
    property,
    floorPlan: matchedFloorPlan,
  };
}
