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

function readArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
  };
}

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

function assertPublicFile(publicPath) {
  const filePath = path.join(rootDir, "public", publicPath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing public asset: ${publicPath}`);
  }
}

function sortedStyleFiles(template, styleId) {
  const dir = path.join(rootDir, "public", template.panoramaRoot, styleId);
  return fs.readdirSync(dir).sort().map((file) => `${template.panoramaRoot}/${styleId}/${file}`);
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

function buildRooms(template) {
  const filesByStyle = Object.fromEntries(
    Object.keys(styles).map((styleId) => [styleId, sortedStyleFiles(template, styleId)]),
  );

  return template.rooms.map(([name, type], index, list) => {
    const adjacent =
      index === 0
        ? list.slice(1).map((room) => room[0])
        : [list[0][0]];

    return {
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
      assets: Object.entries(styles).map(([styleId, styleName]) => ({
        styleId,
        styleName,
        type: styleId === "whitebox" ? "panorama-whitebox" : "panorama-style",
        imageUrl: filesByStyle[styleId][index],
        prompt: `Shared ${styleId} panorama template for ${name}`,
        status: "completed",
        qcStatus: "passed",
        qcError: null,
      })),
    };
  });
}

async function replacePlanRooms(planId, rooms) {
  await prisma.communityFloorPlanRoom.deleteMany({
    where: { communityFloorPlanId: planId },
  });

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
          create: room.assets,
        },
      },
    });
  }
}

async function main() {
  loadEnvFile(path.join(rootDir, ".env.local"));
  loadEnvFile(path.join(rootDir, ".env"));
  const options = readArgs();

  for (const template of Object.values(templates)) {
    assertPublicFile(template.floorPlanImage);
    for (const styleId of Object.keys(styles)) {
      const files = sortedStyleFiles(template, styleId);
      if (files.length < template.rooms.length) {
        throw new Error(`${template.panoramaRoot}/${styleId} has only ${files.length} files`);
      }
      files.slice(0, template.rooms.length).forEach(assertPublicFile);
    }
  }

  const plans = await prisma.communityFloorPlan.findMany({
    include: { communityPoi: { select: { name: true, amapId: true } } },
    orderBy: [{ communityPoiId: "asc" }, { totalPrice: "asc" }],
  });
  const selectedPlans = plans.map((plan) => ({
    plan,
    templateKey: getTemplateKey(plan),
  }));
  const summary = selectedPlans.reduce(
    (acc, item) => {
      acc[item.templateKey] += 1;
      return acc;
    },
    { two: 0, three: 0, four: 0 },
  );

  console.log(JSON.stringify({ mode: options.dryRun ? "dry-run" : "apply", totalPlans: selectedPlans.length, summary }));

  if (options.dryRun) {
    return;
  }

  const roomTemplates = Object.fromEntries(
    Object.entries(templates).map(([key, template]) => [key, buildRooms(template)]),
  );

  for (const { plan, templateKey } of selectedPlans) {
    await prisma.communityFloorPlan.update({
      where: { id: plan.id },
      data: { imageUrl: templates[templateKey].floorPlanImage },
    });
    await replacePlanRooms(plan.id, roomTemplates[templateKey]);
  }

  console.log(`applied shared panorama templates to ${selectedPlans.length} plans`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
