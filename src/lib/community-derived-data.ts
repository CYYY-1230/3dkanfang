import type { FloorPlan, Property } from "@/lib/types";
import {
  buildInlineCommunityRooms,
  getCommunityFloorPlanImage,
} from "@/lib/community-vr-templates";

export type CommunityProfileSeed = {
  id?: string | null;
  name: string;
  city: string;
  district: string;
  address: string;
  priceRange: string;
  longitude?: number;
  latitude?: number;
};

export type GeneratedCommunityPlan = {
  name: string;
  area: number;
  layout: string;
  orientation: string;
  bathrooms: number;
  balcony: boolean;
  totalPrice: number;
  tags: string[];
  imageUrl: string;
};

export type CommunityDerivedData = {
  floorPlans: GeneratedCommunityPlan[];
  floorPlanTags: string[];
  locationTags: string[];
  priceTags: string[];
  minTotalPrice: number;
  maxTotalPrice: number;
};

export function hashText(text: string) {
  return Array.from(text).reduce((total, char) => total + char.charCodeAt(0), 0);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function parsePriceRange(priceRange: string) {
  const values = Array.from(priceRange.matchAll(/\d+/g)).map((match) => Number(match[0]));

  if (values.length >= 2) {
    return { min: values[0], max: values[1] };
  }

  if (values.length === 1) {
    return { min: values[0], max: values[0] + 160 };
  }

  return { min: 300, max: 620 };
}

function priceTag(totalPrice: number) {
  if (totalPrice <= 300) {
    return "300万以内";
  }

  if (totalPrice <= 500) {
    return "300-500万";
  }

  if (totalPrice <= 800) {
    return "500-800万";
  }

  return "800万以上";
}

function inferLocationTags(seed: CommunityProfileSeed) {
  const text = `${seed.city}${seed.district}${seed.address}${seed.name}`;
  const tags: string[] = [];

  if (/地铁|站|东站|城站|钱江|滨江|西湖|上城|拱墅|萧山|余杭|临平/.test(text)) {
    tags.push("交通便利");
  }

  if (/地铁|站|东站|城站/.test(text)) {
    tags.push("近地铁");
  }

  if (/学校|学府|实验|文教|大学|学院|师范/.test(text)) {
    tags.push("近学校");
  }

  if (/湖|江|湾|公园|绿|森林|湿地|溪/.test(text)) {
    tags.push("近公园");
  }

  if (/银泰|万象|商业|中心|广场|印象|龙湖|天街/.test(text)) {
    tags.push("商业便利");
  }

  if (tags.length === 0) {
    tags.push("生活便利");
  }

  return unique(tags).slice(0, 3);
}

function getPlanTemplates(hash: number) {
  const compactLayout = hash % 3 === 0 ? "2室2厅1卫" : "3室2厅1卫";
  const roomyLayout = hash % 4 === 0 ? "4室2厅2卫" : "3室2厅2卫";
  const compactBaseArea = compactLayout.startsWith("2") ? 78 : 89;
  const roomyBaseArea = roomyLayout.startsWith("4") ? 128 : 112;

  return [
    {
      name: compactLayout.startsWith("2") ? "舒适两房" : "实用三房",
      area: compactBaseArea + (hash % 8),
      layout: compactLayout,
      bathrooms: 1,
    },
    {
      name: roomyLayout.startsWith("4") ? "改善四房" : "改善三房",
      area: roomyBaseArea + (hash % 12),
      layout: roomyLayout,
      bathrooms: 2,
    },
  ];
}

function buildPlanTags(plan: {
  layout: string;
  orientation: string;
  bathrooms: number;
  balcony: boolean;
}) {
  const firstRoomCount = Number(plan.layout[0]);
  const roomTag = firstRoomCount >= 4 ? "四房及以上" : firstRoomCount === 3 ? "三房" : "两房";

  return unique([
    roomTag,
    plan.orientation.includes("南") ? "南向" : "",
    plan.orientation.includes("南北") ? "南北通透" : "",
    plan.bathrooms >= 2 ? "双卫" : "",
    plan.balcony ? "带阳台" : "",
  ]);
}

export function generateCommunityDerivedData(seed: CommunityProfileSeed): CommunityDerivedData {
  const hash = hashText(`${seed.id ?? ""}${seed.name}${seed.city}${seed.district}${seed.address}`);
  const { min, max } = parsePriceRange(seed.priceRange);
  const templates = getPlanTemplates(hash);
  const orientations = hash % 2 === 0 ? ["南", "南北"] : ["东南", "南"];
  const floorPlans = templates.map((template, index) => {
    const priceAnchor = index === 0 ? min : max;
    const totalPrice = Math.max(
      120,
      Math.round((priceAnchor + ((hash + index * 37) % 41) - 20) / 10) * 10,
    );
    const balcony = index === 1 || hash % 5 !== 0;
    const plan = {
      ...template,
      orientation: orientations[index],
      balcony,
    };
    const tags = unique([...buildPlanTags(plan), priceTag(totalPrice)]);

    return {
      ...plan,
      totalPrice,
      tags,
      imageUrl: getCommunityFloorPlanImage(plan),
    };
  });

  const locationTags = inferLocationTags(seed);
  const floorPlanTags = unique(floorPlans.flatMap((plan) => plan.tags).filter((tag) => !tag.includes("万")));
  const priceTags = unique(floorPlans.map((plan) => priceTag(plan.totalPrice)));
  const totalPrices = floorPlans.map((plan) => plan.totalPrice);

  return {
    floorPlans,
    floorPlanTags,
    locationTags,
    priceTags,
    minTotalPrice: Math.min(...totalPrices),
    maxTotalPrice: Math.max(...totalPrices),
  };
}

export function toFloorPlan({
  plan,
  propertyId,
  id,
}: {
  plan: GeneratedCommunityPlan;
  propertyId: string;
  id: string;
}): FloorPlan {
  return {
    id,
    propertyId,
    name: plan.name,
    area: plan.area,
    layout: plan.layout,
    orientation: plan.orientation,
    bathrooms: plan.bathrooms,
    balcony: plan.balcony,
    totalPrice: plan.totalPrice,
    tags: plan.tags,
    highlights: plan.tags,
    imageUrl: plan.imageUrl,
    rooms: buildInlineCommunityRooms({
      id,
      layout: plan.layout,
      name: plan.name,
      tags: plan.tags,
    }),
  };
}

export function applyDerivedDataToProperty(property: Property): Property {
  const derived = generateCommunityDerivedData({
    id: property.id,
    name: property.name,
    city: property.city,
    district: property.district,
    address: property.address,
    priceRange: property.priceRange,
    longitude: property.longitude,
    latitude: property.latitude,
  });

  return {
    ...property,
    floorPlanTags: derived.floorPlanTags,
    locationTags: derived.locationTags,
    priceTags: derived.priceTags,
    minTotalPrice: derived.minTotalPrice,
    maxTotalPrice: derived.maxTotalPrice,
    tags: unique([
      ...property.tags,
      ...derived.floorPlanTags,
      ...derived.locationTags,
      ...derived.priceTags,
    ]),
    floorPlans: derived.floorPlans.map((plan, index) =>
      toFloorPlan({
        plan,
        propertyId: property.id,
        id: `${property.id}-plan-${index + 1}`,
      }),
    ),
  };
}
