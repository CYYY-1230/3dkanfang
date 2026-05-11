import { panoramaFallbackStyle, panoramaStyles } from "@/lib/panorama-styles";
import type { FloorPlan, Room, ViewingAsset } from "@/lib/types";

export type PanoramaRoomAssetLink = {
  floorPlanId: string;
  roomId: string;
  roomName: string;
  roomType: Room["type"];
  styleId: string;
  styleName: string;
  panoramaUrl: string;
};

const templateRoot = "/generated/panorama-templates/four-room";

function getTemplateRoomFile(room: Room) {
  if (room.type === "living" || room.type === "dining") {
    return "living-dining.png";
  }

  if (room.type === "kitchen") {
    return "kitchen.png";
  }

  if (room.type === "bathroom") {
    return "bathroom-1.png";
  }

  if (room.type === "balcony") {
    return "balcony.png";
  }

  if (room.type === "study") {
    return "study.png";
  }

  if (room.name.includes("次") || room.name.includes("儿童")) {
    return "second-bedroom.png";
  }

  return "master-bedroom.png";
}

function getDefaultYaw(room: Room) {
  if (typeof room.defaultYaw === "number") {
    return room.defaultYaw;
  }

  if (room.type === "kitchen") {
    return 18;
  }

  if (room.type === "bedroom") {
    return -12;
  }

  return 0;
}

function buildPanoramaAsset(room: Room, styleId: string, styleName: string): ViewingAsset {
  const templateFile = getTemplateRoomFile(room);

  return {
    id: `${room.id}-${styleId}-panorama`,
    roomId: room.id,
    styleId,
    styleName,
    type: styleId === "whitebox" ? "panorama-whitebox" : "panorama-style",
    imageUrl: `${templateRoot}/${styleId}/${templateFile}`,
    prompt: `Image 2 生成的 ${room.name} ${styleName} 2:1 等距柱状全景图，用于 Three.js 球体看房。`,
    status: "completed",
    qcStatus: "passed",
  };
}

export function buildPanoramaAssetLinks(floorPlan: FloorPlan): PanoramaRoomAssetLink[] {
  return floorPlan.rooms.flatMap((room) =>
    panoramaStyles.map((style) => ({
      floorPlanId: floorPlan.id,
      roomId: room.id,
      roomName: room.name,
      roomType: room.type,
      styleId: style.id,
      styleName: style.name,
      panoramaUrl: `${templateRoot}/${style.id}/${getTemplateRoomFile(room)}`,
    })),
  );
}

export function withPanoramaViewerAssets(floorPlan: FloorPlan): FloorPlan {
  return {
    ...floorPlan,
    rooms: floorPlan.rooms.map((room, index) => {
      const adjacent =
        room.adjacent && room.adjacent.length > 0
          ? room.adjacent
          : floorPlan.rooms
              .filter((candidate) => candidate.id !== room.id)
              .slice(0, 3)
              .map((candidate) => candidate.name);

      return {
        ...room,
        sortOrder: room.sortOrder ?? index,
        defaultYaw: getDefaultYaw(room),
        adjacent,
        hotspots:
          room.hotspots ??
          adjacent.map((target, hotspotIndex) => ({
            target,
            label: `去${target}`,
            yaw: hotspotIndex * 30 - 30,
            pitch: -6,
          })),
        assets: [panoramaFallbackStyle, ...panoramaStyles].map((style) =>
          buildPanoramaAsset(room, style.id, style.name),
        ),
      };
    }),
  };
}

export function hasPanoramaAssets(floorPlan: FloorPlan) {
  return floorPlan.rooms.some((room) =>
    room.assets.some((asset) => asset.type === "panorama-style" || asset.type === "panorama-whitebox"),
  );
}
