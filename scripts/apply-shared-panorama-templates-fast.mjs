import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rootDir = process.cwd();
const styles = {
  whitebox: "白膜底稿",
  bauhaus: "包豪斯风格",
  wood: "原木风格",
  modern: "现代风格",
};
const templates = {
  two: {
    floorPlanImage: "/generated/floor-plan-templates/two-room-clean.png",
    panoramaRoot: "/generated/panoramas/cmox52a5q011gjlrd3s3mw3yp",
    rooms: [
      ["客餐厅", "living"],
      ["厨房", "kitchen"],
      ["主卧", "bedroom"],
      ["次卧", "bedroom"],
      ["卫生间", "bathroom"],
      ["阳台", "balcony"],
    ],
  },
  three: {
    floorPlanImage: "/generated/floor-plan-templates/three-room-clean.png",
    panoramaRoot: "/generated/panoramas/cmox5297g001pjlrd7605ypw1",
    rooms: [
      ["客餐厅", "living"],
      ["厨房", "kitchen"],
      ["主卧", "bedroom"],
      ["次卧", "bedroom"],
      ["儿童房", "bedroom"],
      ["卫生间", "bathroom"],
      ["阳台", "balcony"],
    ],
  },
  four: {
    floorPlanImage: "/generated/floor-plan-templates/four-room-clean.png",
    panoramaRoot: "/generated/panoramas/cmox52a5q011hjlrdyrumh382",
    rooms: [
      ["客餐厅", "living"],
      ["厨房", "kitchen"],
      ["主卧", "bedroom"],
      ["次卧", "bedroom"],
      ["儿童房", "bedroom"],
      ["书房", "study"],
      ["卫生间", "bathroom"],
      ["阳台", "balcony"],
    ],
  },
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

function publicFile(publicPath) {
  return path.join(rootDir, "public", publicPath);
}

function assertPublicFile(publicPath) {
  if (!fs.existsSync(publicFile(publicPath))) {
    throw new Error(`Missing public asset: ${publicPath}`);
  }
}

function styleFiles(template, styleId) {
  return fs
    .readdirSync(publicFile(`${template.panoramaRoot}/${styleId}`))
    .sort()
    .map((file) => `${template.panoramaRoot}/${styleId}/${file}`);
}

function getTemplateKey(plan) {
  const roomCount = Number(plan.layout[0]);
  if (roomCount <= 2 || plan.tags.includes("两房")) {
    return "two";
  }
  if (roomCount >= 4 || plan.tags.includes("四房及以上") || plan.name.includes("四房")) {
    return "four";
  }
  return "three";
}

function buildRows(plan, templateKey) {
  const template = templates[templateKey];
  const filesByStyle = Object.fromEntries(
    Object.keys(styles).map((styleId) => [styleId, styleFiles(template, styleId)]),
  );
  const rooms = [];
  const assets = [];

  template.rooms.forEach(([name, type], index, list) => {
    const roomId = `${plan.id}-room-${index}`;
    const adjacent =
      index === 0
        ? list.slice(1).map((room) => room[0])
        : [list[0][0]];

    rooms.push({
      id: roomId,
      communityFloorPlanId: plan.id,
      name,
      type,
      sortOrder: index,
      defaultYaw: 0,
      adjacent,
      hotspots: adjacent.map((target, hotspotIndex) => ({
        target,
        label: target === list[0][0] ? "去客餐厅" : `去${target}`,
        yaw: hotspotIndex * 28 - 28,
        pitch: -4,
      })),
    });

    for (const [styleId, styleName] of Object.entries(styles)) {
      assets.push({
        id: `${roomId}-${styleId}`,
        roomId,
        styleId,
        styleName,
        type: styleId === "whitebox" ? "panorama-whitebox" : "panorama-style",
        imageUrl: filesByStyle[styleId][index],
        prompt: `Shared ${styleId} panorama template for ${name}`,
        status: "completed",
        qcStatus: "passed",
        qcError: null,
      });
    }
  });

  return { rooms, assets };
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function main() {
  loadEnvFile(path.join(rootDir, ".env.local"));
  loadEnvFile(path.join(rootDir, ".env"));

  for (const template of Object.values(templates)) {
    assertPublicFile(template.floorPlanImage);
    for (const styleId of Object.keys(styles)) {
      const files = styleFiles(template, styleId);
      if (files.length < template.rooms.length) {
        throw new Error(`${template.panoramaRoot}/${styleId} has only ${files.length} files`);
      }
      files.slice(0, template.rooms.length).forEach(assertPublicFile);
    }
  }

  const plans = await prisma.communityFloorPlan.findMany({
    select: { id: true, name: true, layout: true, tags: true },
    orderBy: [{ communityPoiId: "asc" }, { totalPrice: "asc" }],
  });
  const selected = plans.map((plan) => ({ plan, templateKey: getTemplateKey(plan) }));
  const summary = selected.reduce(
    (acc, item) => {
      acc[item.templateKey] += 1;
      return acc;
    },
    { two: 0, three: 0, four: 0 },
  );
  const allRooms = [];
  const allAssets = [];

  for (const { plan, templateKey } of selected) {
    const { rooms, assets } = buildRows(plan, templateKey);
    allRooms.push(...rooms);
    allAssets.push(...assets);
  }

  console.log(JSON.stringify({ plans: selected.length, summary, rooms: allRooms.length, assets: allAssets.length }));

  await prisma.communityFloorPlanRoom.deleteMany({
    where: { communityFloorPlanId: { in: selected.map(({ plan }) => plan.id) } },
  });

  for (const [templateKey, template] of Object.entries(templates)) {
    await prisma.communityFloorPlan.updateMany({
      where: { id: { in: selected.filter((item) => item.templateKey === templateKey).map(({ plan }) => plan.id) } },
      data: { imageUrl: template.floorPlanImage },
    });
  }

  for (const rows of chunk(allRooms, 500)) {
    await prisma.communityFloorPlanRoom.createMany({ data: rows });
  }
  for (const rows of chunk(allAssets, 1000)) {
    await prisma.communityRoomAsset.createMany({ data: rows });
  }

  console.log("applied shared floor plan and panorama templates");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
