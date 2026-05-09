import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rootDir = process.cwd();

const templates = {
  two: {
    imageUrl: "/generated/floor-plan-templates/two-room-clean.png",
    sourceAmapId: "B0LD1K99OJ",
    sourcePlanName: "舒适两房",
  },
  three: {
    imageUrl: "/generated/floor-plan-templates/three-room-clean.png",
    sourceAmapId: "B0LD1K99OJ",
    sourcePlanName: "改善三房",
  },
  four: {
    imageUrl: "/generated/floor-plan-templates/four-room-clean.png",
    rooms: [
      { key: "living-dining", name: "客餐厅", type: "living", yaw: -12 },
      { key: "kitchen", name: "厨房", type: "kitchen", yaw: 8 },
      { key: "master-bedroom", name: "主卧", type: "bedroom", yaw: 0 },
      { key: "second-bedroom", name: "次卧", type: "bedroom", yaw: 4 },
      { key: "children-room", name: "儿童房", type: "bedroom", yaw: -6 },
      { key: "study", name: "书房", type: "study", yaw: 10 },
      { key: "bathroom-1", name: "卫生间1", type: "bathroom", yaw: -12 },
      { key: "bathroom-2", name: "卫生间2", type: "bathroom", yaw: 12 },
      { key: "balcony", name: "阳台", type: "balcony", yaw: 0 },
    ],
  },
};

const styleNames = {
  whitebox: "白膜底稿",
  bauhaus: "包豪斯风格",
  wood: "原木风格",
  modern: "现代风格",
};

function readArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    target: "all",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--target" && next) {
      options.target = next;
      index += 1;
    }
  }
  return options;
}

async function loadEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }
      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) {
        process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // optional
  }
}

async function fileExists(publicPath) {
  try {
    await fs.access(path.join(rootDir, "public", publicPath));
    return true;
  } catch {
    return false;
  }
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

function targetMatches(templateKey, target) {
  return target === "all" || target === templateKey;
}

async function getSourceTemplate(template) {
  const community = await prisma.communityPoi.findFirst({
    where: { amapId: template.sourceAmapId },
    include: {
      floorPlans: {
        where: { name: template.sourcePlanName },
        include: {
          rooms: {
            orderBy: { sortOrder: "asc" },
            include: { assets: { orderBy: { styleId: "asc" } } },
          },
        },
      },
    },
  });
  const sourcePlan = community?.floorPlans[0];
  if (!sourcePlan) {
    throw new Error(`Source template not found: ${template.sourcePlanName}`);
  }
  return sourcePlan;
}

function fourRoomAssets(roomKey) {
  return Object.keys(styleNames).map((styleId) => ({
    styleId,
    styleName: styleNames[styleId],
    type: styleId === "whitebox" ? "panorama-whitebox" : "panorama-style",
    imageUrl: `/generated/panorama-templates/four-room/${styleId}/${roomKey}.png`,
    prompt: `Shared four-room template ${styleId} panorama for ${roomKey}`,
    status: "completed",
    qcStatus: "passed",
    qcError: null,
  }));
}

function templateRoomsFromSource(sourcePlan) {
  return sourcePlan.rooms.map((room) => ({
    name: room.name,
    type: room.type,
    sortOrder: room.sortOrder,
    defaultYaw: room.defaultYaw,
    adjacent: room.adjacent,
    hotspots: room.hotspots,
    assets: room.assets.map((asset) => ({
      styleId: asset.styleId,
      styleName: asset.styleName,
      type: asset.type,
      imageUrl: asset.imageUrl,
      prompt: asset.prompt,
      status: "completed",
      qcStatus: "passed",
      qcError: null,
    })),
  }));
}

function templateRoomsForFour() {
  return templates.four.rooms.map((room, index, list) => ({
    name: room.name,
    type: room.type,
    sortOrder: index,
    defaultYaw: room.yaw,
    adjacent: index === 0 ? list.slice(1).map((item) => item.key) : ["living-dining"],
    hotspots: (index === 0 ? list.slice(1).map((item) => item.key) : ["living-dining"]).map((target, hotspotIndex) => ({
      target,
      label: target === "living-dining" ? "去客餐厅" : "去房间",
      yaw: hotspotIndex * 28 - 28,
      pitch: -4,
    })),
    assets: fourRoomAssets(room.key),
  }));
}

async function replacePlanRooms(planId, rooms) {
  await prisma.communityFloorPlanRoom.deleteMany({ where: { communityFloorPlanId: planId } });
  for (const room of rooms) {
    await prisma.communityFloorPlanRoom.create({
      data: {
        communityFloorPlanId: planId,
        name: room.name,
        type: room.type,
        sortOrder: room.sortOrder,
        defaultYaw: room.defaultYaw,
        adjacent: room.adjacent,
        hotspots: room.hotspots,
        assets: {
          create: room.assets.map((asset) => ({
            styleId: asset.styleId,
            styleName: asset.styleName,
            type: asset.type,
            imageUrl: asset.imageUrl,
            prompt: asset.prompt,
            status: asset.status,
            qcStatus: asset.qcStatus,
            qcError: asset.qcError,
          })),
        },
      },
    });
  }
}

async function assertAssetsExist(rooms) {
  for (const room of rooms) {
    for (const asset of room.assets) {
      if (!(await fileExists(asset.imageUrl))) {
        throw new Error(`Missing template asset: ${asset.imageUrl}`);
      }
    }
  }
}

async function main() {
  await loadEnvFile(path.join(rootDir, ".env"));
  await loadEnvFile(path.join(rootDir, ".env.local"));
  const options = readArgs();
  for (const template of Object.values(templates)) {
    if (!(await fileExists(template.imageUrl))) {
      throw new Error(`Missing floor plan template: ${template.imageUrl}`);
    }
  }

  const sourceTwo = await getSourceTemplate(templates.two);
  const sourceThree = await getSourceTemplate(templates.three);
  const roomTemplates = {
    two: templateRoomsFromSource(sourceTwo),
    three: templateRoomsFromSource(sourceThree),
    four: templateRoomsForFour(),
  };
  await Promise.all(Object.values(roomTemplates).map(assertAssetsExist));

  const plans = await prisma.communityFloorPlan.findMany({
    include: { communityPoi: { select: { name: true, amapId: true } } },
    orderBy: [{ communityPoiId: "asc" }, { totalPrice: "asc" }],
  });

  const selectedPlans = plans
    .map((plan) => ({ plan, templateKey: getTemplateKey(plan) }))
    .filter(({ templateKey }) => targetMatches(templateKey, options.target));

  const summary = selectedPlans.reduce(
    (acc, item) => {
      acc[item.templateKey] += 1;
      return acc;
    },
    { two: 0, three: 0, four: 0 },
  );

  console.log(JSON.stringify({ mode: options.dryRun ? "dry-run" : "apply", totalPlans: selectedPlans.length, summary }));
  if (options.dryRun) {
    console.log(
      JSON.stringify(
        selectedPlans.slice(0, 20).map(({ plan, templateKey }) => ({
          community: plan.communityPoi.name,
          amapId: plan.communityPoi.amapId,
          plan: plan.name,
          layout: plan.layout,
          templateKey,
          imageUrl: templates[templateKey].imageUrl,
        })),
        null,
        2,
      ),
    );
    return;
  }

  for (const { plan, templateKey } of selectedPlans) {
    await prisma.communityFloorPlan.update({
      where: { id: plan.id },
      data: { imageUrl: templates[templateKey].imageUrl },
    });
    await replacePlanRooms(plan.id, roomTemplates[templateKey]);
  }
  console.log(`applied floor plan templates to ${selectedPlans.length} plans`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
