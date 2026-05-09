import type { Room, ViewingAsset } from "@/lib/types";

export type CommunityVrTemplateKey = "two" | "three" | "four";

export type CommunityVrTemplateRoom = {
  name: string;
  type: Room["type"];
};

type CommunityVrTemplate = {
  floorPlanImage: string;
  panoramaRoot: string;
  rooms: CommunityVrTemplateRoom[];
  panoramaFileNames: string[];
};

const styles = {
  whitebox: "白膜底稿",
  bauhaus: "包豪斯风格",
  wood: "原木风格",
  modern: "现代风格",
} as const;

export const communityVrTemplates: Record<CommunityVrTemplateKey, CommunityVrTemplate> = {
  two: {
    floorPlanImage: "/generated/floor-plan-templates/two-room-clean.png",
    panoramaRoot: "/generated/panoramas/cmox52a5q011gjlrd3s3mw3yp",
    rooms: [
      { name: "客餐厅", type: "living" },
      { name: "厨房", type: "kitchen" },
      { name: "主卧", type: "bedroom" },
      { name: "次卧", type: "bedroom" },
      { name: "卫生间", type: "bathroom" },
      { name: "阳台", type: "balcony" },
    ],
    panoramaFileNames: [
      "cmoxrtpoo0000jlimqhveq5m3.png",
      "cmoxrtpop0001jlimw5z1gohw.png",
      "cmoxrtpop0002jlim4kkfhvrg.png",
      "cmoxrtpop0003jlim6vnvhbzc.png",
      "cmoxrtpop0004jlims6ez3zkr.png",
      "cmoxrtpop0005jlima3x6qgny.png",
    ],
  },
  three: {
    floorPlanImage: "/generated/floor-plan-templates/three-room-clean.png",
    panoramaRoot: "/generated/panoramas/cmox5297g001pjlrd7605ypw1",
    rooms: [
      { name: "客餐厅", type: "living" },
      { name: "厨房", type: "kitchen" },
      { name: "主卧", type: "bedroom" },
      { name: "次卧", type: "bedroom" },
      { name: "儿童房", type: "bedroom" },
      { name: "卫生间", type: "bathroom" },
      { name: "阳台", type: "balcony" },
    ],
    panoramaFileNames: [
      "cmoxbrdl30000jl6amykujpcf.png",
      "cmoxbrdl30001jl6a5k4uvvf6.png",
      "cmoxbrdl30002jl6a2ttl0vyp.png",
      "cmoxbrdl30003jl6ask6z5hbt.png",
      "cmoxbrdl30004jl6acsbqbdqw.png",
      "cmoxbrdl30005jl6az058217m.png",
      "cmoxbrdl30006jl6asxq9esgy.png",
    ],
  },
  four: {
    floorPlanImage: "/generated/floor-plan-templates/four-room-clean.png",
    panoramaRoot: "/generated/panoramas/cmox52a5q011hjlrdyrumh382",
    rooms: [
      { name: "客餐厅", type: "living" },
      { name: "厨房", type: "kitchen" },
      { name: "主卧", type: "bedroom" },
      { name: "次卧", type: "bedroom" },
      { name: "儿童房", type: "bedroom" },
      { name: "书房", type: "study" },
      { name: "卫生间", type: "bathroom" },
      { name: "阳台", type: "balcony" },
    ],
    panoramaFileNames: [
      "cmoxsv91c001ijlimedmmetfa.png",
      "cmoxsv91c001jjlimh6wha11y.png",
      "cmoxsv91c001kjlimbkqxyqh2.png",
      "cmoxsv91c001ljlimlvpgmfco.png",
      "cmoxsv91c001mjlima20rd4ap.png",
      "cmoxsv91c001njlimsxffr5ty.png",
      "cmoxsv91c001ojlim02ccrzap.png",
      "cmoxsv91c001pjlim8nc7ce6n.png",
    ],
  },
};

export function getCommunityVrTemplateKey(plan: {
  layout: string;
  name?: string;
  tags?: string[];
}): CommunityVrTemplateKey {
  const roomCount = Number(plan.layout[0]);

  if (roomCount <= 2 || plan.tags?.includes("两房")) {
    return "two";
  }

  if (roomCount >= 4 || plan.tags?.includes("四房及以上") || plan.name?.includes("四房")) {
    return "four";
  }

  return "three";
}

export function getCommunityFloorPlanImage(plan: {
  layout: string;
  name?: string;
  tags?: string[];
}) {
  return communityVrTemplates[getCommunityVrTemplateKey(plan)].floorPlanImage;
}

export function buildCommunityRoomAssets({
  roomId,
  roomName,
  templateKey,
  roomIndex,
}: {
  roomId: string;
  roomName: string;
  templateKey: CommunityVrTemplateKey;
  roomIndex: number;
}) {
  const template = communityVrTemplates[templateKey];
  const fileName = template.panoramaFileNames[roomIndex];

  return Object.entries(styles).map(([styleId, styleName]) => ({
    id: `${roomId}-${styleId}`,
    roomId,
    styleId,
    styleName,
    type: styleId === "whitebox" ? "panorama-whitebox" : "panorama-style",
    imageUrl: `${template.panoramaRoot}/${styleId}/${fileName}`,
    prompt: `Shared ${styleId} panorama template for ${roomName}`,
    status: "completed",
    qcStatus: "passed",
    qcError: null,
  }));
}

export function buildCommunityRoomsForFloorPlan(plan: {
  id: string;
  layout: string;
  name?: string;
  tags?: string[];
}) {
  const templateKey = getCommunityVrTemplateKey(plan);
  const template = communityVrTemplates[templateKey];

  return template.rooms.map((room, index) => {
    const roomId = `${plan.id}-room-${index}`;
    const adjacent =
      index === 0
        ? template.rooms.slice(1).map((item) => item.name)
        : [template.rooms[0].name];

    return {
      id: roomId,
      communityFloorPlanId: plan.id,
      name: room.name,
      type: room.type,
      sortOrder: index,
      defaultYaw: 0,
      adjacent,
      hotspots: adjacent.map((target, hotspotIndex) => ({
        target,
        label: target === template.rooms[0].name ? "去客餐厅" : `去${target}`,
        yaw: hotspotIndex * 28 - 28,
        pitch: -4,
      })),
      assets: buildCommunityRoomAssets({
        roomId,
        roomName: room.name,
        templateKey,
        roomIndex: index,
      }),
    };
  });
}

export function buildInlineCommunityRooms(plan: {
  id: string;
  layout: string;
  name?: string;
  tags?: string[];
}): Room[] {
  return buildCommunityRoomsForFloorPlan(plan).map((room) => ({
    id: room.id,
    floorPlanId: plan.id,
    name: room.name,
    type: room.type,
    sortOrder: room.sortOrder,
    defaultYaw: room.defaultYaw,
    adjacent: room.adjacent,
    hotspots: room.hotspots,
    assets: room.assets.map((asset): ViewingAsset => ({
      id: asset.id,
      roomId: room.id,
      styleId: asset.styleId,
      styleName: asset.styleName,
      type: asset.type as ViewingAsset["type"],
      imageUrl: asset.imageUrl,
      prompt: asset.prompt,
      status: asset.status,
      qcStatus: asset.qcStatus,
      qcError: asset.qcError ?? undefined,
    })),
  }));
}
