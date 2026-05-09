import type { DesignStyle, GenerationJob, Property } from "@/lib/types";

export const designStyles: DesignStyle[] = [
  {
    id: "modern",
    name: "现代简约",
    description: "清爽留白、木色和细线条，适合大多数家庭。",
  },
  {
    id: "cream",
    name: "奶油风",
    description: "柔和暖色、圆润家具，整体更温馨。",
  },
  {
    id: "luxury",
    name: "轻奢",
    description: "石材、金属和低饱和色，空间更精致。",
  },
];

const roomPrompts = {
  living:
    "明亮客厅室内效果图，大落地窗，适合普通买房用户理解空间尺度",
  bedroom: "主卧室内效果图，收纳充足，温暖舒适，真实住宅空间",
  kitchen: "开放式厨房和餐厅效果图，动线清楚，干净实用",
  bathroom: "卫生间效果图，干湿分离，现代住宅装修",
  balcony: "生活阳台效果图，采光好，可晾晒可休闲",
};

export const properties: Property[] = [
  {
    id: "river-garden",
    name: "滨江云邸",
    city: "杭州",
    district: "滨江区",
    address: "闻涛路与科技馆街交汇处",
    latitude: 30.211,
    longitude: 120.213,
    priceRange: "620-980 万",
    summary:
      "靠近江景步道和地铁站，适合看重通勤、景观和生活便利度的改善家庭。",
    coverImage: "/assets/property-river.svg",
    tags: ["近地铁", "江景步道", "改善户型"],
    pois: [
      { id: "rg-poi-1", name: "地铁 6 号线科技馆站", category: "交通", distance: "450m" },
      { id: "rg-poi-2", name: "星光大道商业街", category: "商业", distance: "900m" },
      { id: "rg-poi-3", name: "滨江实验学校", category: "教育", distance: "1.2km" },
      { id: "rg-poi-4", name: "钱塘江步道", category: "公园", distance: "300m" },
    ],
    floorPlans: [
      {
        id: "river-89",
        propertyId: "river-garden",
        name: "89 平三房高效户型",
        area: 89,
        layout: "3室2厅1卫",
        orientation: "南向",
        bathrooms: 1,
        balcony: true,
        highlights: ["动静分区清楚", "客餐厅一体", "南向双开间", "适合三口之家"],
        imageUrl: "/assets/floor-river-89.svg",
        rooms: [
          {
            id: "river-89-living",
            floorPlanId: "river-89",
            name: "客餐厅",
            type: "living",
            assets: designStyles.map((style) => ({
              id: `river-89-living-${style.id}`,
              roomId: "river-89-living",
              styleId: style.id,
              type: "room-image",
              imageUrl: `/assets/room-living-${style.id}.svg`,
              prompt: `${roomPrompts.living}，${style.name}装修风格`,
            })),
          },
          {
            id: "river-89-bedroom",
            floorPlanId: "river-89",
            name: "主卧",
            type: "bedroom",
            assets: designStyles.map((style) => ({
              id: `river-89-bedroom-${style.id}`,
              roomId: "river-89-bedroom",
              styleId: style.id,
              type: "room-image",
              imageUrl: `/assets/room-bedroom-${style.id}.svg`,
              prompt: `${roomPrompts.bedroom}，${style.name}装修风格`,
            })),
          },
          {
            id: "river-89-kitchen",
            floorPlanId: "river-89",
            name: "厨房",
            type: "kitchen",
            assets: designStyles.map((style) => ({
              id: `river-89-kitchen-${style.id}`,
              roomId: "river-89-kitchen",
              styleId: style.id,
              type: "room-image",
              imageUrl: `/assets/room-kitchen-${style.id}.svg`,
              prompt: `${roomPrompts.kitchen}，${style.name}装修风格`,
            })),
          },
        ],
      },
      {
        id: "river-128",
        propertyId: "river-garden",
        name: "128 平四房改善户型",
        area: 128,
        layout: "4室2厅2卫",
        orientation: "南北通透",
        bathrooms: 2,
        balcony: true,
        highlights: ["双卫设计", "独立家政阳台", "主卧套间", "适合二孩家庭"],
        imageUrl: "/assets/floor-river-128.svg",
        rooms: [
          {
            id: "river-128-living",
            floorPlanId: "river-128",
            name: "横厅",
            type: "living",
            assets: designStyles.map((style) => ({
              id: `river-128-living-${style.id}`,
              roomId: "river-128-living",
              styleId: style.id,
              type: "room-image",
              imageUrl: `/assets/room-living-${style.id}.svg`,
              prompt: `${roomPrompts.living}，${style.name}装修风格`,
            })),
          },
          {
            id: "river-128-bedroom",
            floorPlanId: "river-128",
            name: "主卧套间",
            type: "bedroom",
            assets: designStyles.map((style) => ({
              id: `river-128-bedroom-${style.id}`,
              roomId: "river-128-bedroom",
              styleId: style.id,
              type: "room-image",
              imageUrl: `/assets/room-bedroom-${style.id}.svg`,
              prompt: `${roomPrompts.bedroom}，${style.name}装修风格`,
            })),
          },
        ],
      },
    ],
  },
];

export const generationJobs: GenerationJob[] = properties.flatMap((property) =>
  property.floorPlans.flatMap((floorPlan) => [
    {
      id: `${floorPlan.id}-floor-job`,
      targetType: "floor-plan",
      targetId: floorPlan.id,
      prompt: `清晰、简洁、适合普通买房用户阅读的 ${floorPlan.area} 平 ${floorPlan.layout} 户型图，标注客厅、卧室、厨房、卫生间和阳台。`,
      status: "已完成",
      resultUrl: floorPlan.imageUrl,
    },
    ...floorPlan.rooms.flatMap((room) =>
      room.assets.map((asset) => ({
        id: `${asset.id}-job`,
        targetType: "room-render" as const,
        targetId: room.id,
        prompt: asset.prompt,
        status: "已完成" as const,
        resultUrl: asset.imageUrl,
      })),
    ),
  ]),
);

export function getProperty(propertyId: string) {
  return properties.find((property) => property.id === propertyId);
}

export function getFloorPlan(floorPlanId: string) {
  for (const property of properties) {
    const floorPlan = property.floorPlans.find((plan) => plan.id === floorPlanId);
    if (floorPlan) {
      return { property, floorPlan };
    }
  }

  return undefined;
}

export function getMapPois() {
  return properties.map((property, index) => ({
    id: property.id,
    name: property.name,
    city: property.city,
    district: property.district,
    latitude: property.latitude,
    longitude: property.longitude,
    priceRange: property.priceRange,
    summary: property.summary,
    x: [23, 55, 78][index],
    y: [38, 58, 30][index],
  }));
}
