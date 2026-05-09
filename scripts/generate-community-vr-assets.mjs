import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rootDir = process.cwd();
const floorPlanPrefix = "/generated/floor-plans";
const panoramaPrefix = "/generated/panoramas";
const defaultBaseUrl = "https://api.openai.com/v1";
const defaultModel = "gpt-image-2";
const defaultQuality = "medium";
const defaultFloorPlanSize = "1024x1024";
const defaultPanoramaSize = "2048x1024";
const defaultRequestTimeoutMs = 120000;
const defaultRetryDelayMs = 10000;
const screenshotAreaBounds = {
  minLng: 120.201,
  maxLng: 120.2122,
  minLat: 30.2042,
  maxLat: 30.2084,
};

const styles = [
  {
    id: "whitebox",
    name: "白膜底稿",
    prompt:
      "pure white clay-model interior, no material textures, matte white walls, ceiling and floor, white clay furniture blocks, soft neutral lighting",
  },
  {
    id: "bauhaus",
    name: "包豪斯风格",
    prompt:
      "Bauhaus interior style, geometric order, functional furniture, white and gray base, black steel lines, restrained red yellow blue accent blocks",
  },
  {
    id: "wood",
    name: "原木风格",
    prompt:
      "warm natural wood interior style, pale oak, warm white walls, linen textures, soft daylight, cozy calm residential atmosphere",
  },
  {
    id: "modern",
    name: "现代风格",
    prompt:
      "modern minimalist interior style, clean lines, low saturation gray and white palette, simple contemporary furniture, minimal decoration",
  },
];

const imageSignatures = [
  { ext: ".png", mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47], size: readPngSize },
  { ext: ".jpg", mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff], size: readJpegSize },
  { ext: ".webp", mime: "image/webp", asciiAt: [8, "WEBP"], size: readWebpSize },
];

function readArgs() {
  const args = process.argv.slice(2);
  const options = {
    amapId: "B023B090XJ",
    amapIds: [],
    communityId: "",
    bbox: null,
    screenshotArea: false,
    dryRun: false,
    forceFloorPlans: false,
    forcePanoramas: false,
    retries: 2,
    retryDelayMs: Number(process.env.IMAGE_GEN_RETRY_DELAY_MS ?? defaultRetryDelayMs),
    timeoutMs: Number(process.env.IMAGE_GEN_TIMEOUT_MS ?? defaultRequestTimeoutMs),
    baseUrl: process.env.IMAGE_GEN_BASE_URL ?? defaultBaseUrl,
    model: process.env.IMAGE_GEN_MODEL ?? defaultModel,
    quality: process.env.IMAGE_GEN_QUALITY ?? defaultQuality,
    floorPlanSize: process.env.IMAGE_GEN_SIZE ?? defaultFloorPlanSize,
    panoramaSize: process.env.IMAGE_GEN_PANORAMA_SIZE ?? defaultPanoramaSize,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--amap-id" && next) {
      options.amapId = next;
      index += 1;
    } else if (arg === "--amap-ids" && next) {
      options.amapIds = next
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
    } else if (arg === "--community-id" && next) {
      options.communityId = next;
      index += 1;
    } else if (arg === "--bbox" && next) {
      const values = next.split(",").map((item) => Number(item.trim()));
      if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
        throw new Error("--bbox must be minLng,minLat,maxLng,maxLat");
      }
      options.bbox = {
        minLng: Math.min(values[0], values[2]),
        minLat: Math.min(values[1], values[3]),
        maxLng: Math.max(values[0], values[2]),
        maxLat: Math.max(values[1], values[3]),
      };
      index += 1;
    } else if (arg === "--screenshot-area") {
      options.screenshotArea = true;
    } else if (arg === "--base-url" && next) {
      options.baseUrl = next;
      index += 1;
    } else if (arg === "--model" && next) {
      options.model = next;
      index += 1;
    } else if (arg === "--quality" && next) {
      options.quality = next;
      index += 1;
    } else if (arg === "--panorama-size" && next) {
      options.panoramaSize = next;
      index += 1;
    } else if (arg === "--floor-plan-size" && next) {
      options.floorPlanSize = next;
      index += 1;
    } else if (arg === "--retries" && next) {
      const retries = Number(next);
      options.retries = Number.isFinite(retries) ? Math.max(0, retries) : 2;
      index += 1;
    } else if (arg === "--timeout-ms" && next) {
      const timeoutMs = Number(next);
      options.timeoutMs = Number.isFinite(timeoutMs) ? Math.max(10000, timeoutMs) : defaultRequestTimeoutMs;
      index += 1;
    } else if (arg === "--retry-delay-ms" && next) {
      const retryDelayMs = Number(next);
      options.retryDelayMs = Number.isFinite(retryDelayMs) ? Math.max(1000, retryDelayMs) : defaultRetryDelayMs;
      index += 1;
    } else if (arg === "--force-floorplans") {
      options.forceFloorPlans = true;
    } else if (arg === "--force-panoramas") {
      options.forcePanoramas = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
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

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function getGenerationUrl(baseUrl) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return normalizedBaseUrl.endsWith("/v1/images/generations")
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/images/generations`;
}

function decodeImagePayload(value) {
  if (value.startsWith("data:")) {
    const match = value.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) {
      throw new Error("Unsupported image data URL returned by image API.");
    }
    return Buffer.from(match[2], "base64");
  }
  return Buffer.from(value, "base64");
}

function detectImage(buffer) {
  for (const signature of imageSignatures) {
    if (
      signature.bytes?.every((byte, index) => buffer[index] === byte) ||
      (signature.asciiAt &&
        buffer
          .subarray(signature.asciiAt[0], signature.asciiAt[0] + signature.asciiAt[1].length)
          .toString("ascii") === signature.asciiAt[1])
    ) {
      return {
        ext: signature.ext,
        mime: signature.mime,
        ...signature.size(buffer),
      };
    }
  }
  throw new Error("Image API returned data that is not PNG, JPEG, or WebP.");
}

function readPngSize(buffer) {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readJpegSize(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  throw new Error("Could not read JPEG dimensions.");
}

function readWebpSize(buffer) {
  if (buffer.subarray(12, 16).toString("ascii") === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  throw new Error("Could not read WebP dimensions.");
}

function assertPanoramaQc({ info }) {
  const ratio = info.width / Math.max(info.height, 1);
  if (ratio < 1.8 || ratio > 2.2) {
    throw new Error(`Panorama ratio failed: ${info.width}x${info.height}`);
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

async function readPublicImageDataUrl(publicPath) {
  const filePath = path.join(rootDir, "public", publicPath);
  const buffer = await fs.readFile(filePath);
  const info = detectImage(buffer);
  return `data:${info.mime};base64,${buffer.toString("base64")}`;
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function generateImage({ apiKey, baseUrl, model, size, quality, prompt, images = [], timeoutMs }) {
  const body = {
    model,
    prompt,
    size,
    quality,
    response_format: "b64_json",
  };

  if (images.length > 0) {
    body.image = images;
  }

  const response = await fetchWithTimeout(
    getGenerationUrl(baseUrl),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image generation failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const image = payload.data?.[0];
  if (image?.b64_json) {
    return decodeImagePayload(image.b64_json);
  }
  if (image?.url) {
    const imageResponse = await fetchWithTimeout(image.url, {}, timeoutMs);
    if (!imageResponse.ok) {
      throw new Error(`Generated image download failed: ${imageResponse.status}`);
    }
    return Buffer.from(await imageResponse.arrayBuffer());
  }
  throw new Error("Image generation response did not contain b64_json or url.");
}

function isRetryableError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(408|409|425|429|500|502|503|504)\b/.test(message) || /fetch failed|aborted|timeout|timed out|econnreset|etimedout/i.test(message);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateImageWithRetry(args, retries, retryDelayMs) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await generateImage(args);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryableError(error)) {
        throw error;
      }
      const delay = retryDelayMs * 2 ** attempt;
      console.warn(
        `retry image generation ${attempt + 1}/${retries} after ${delay}ms:`,
        error instanceof Error ? error.message : error,
      );
      await wait(delay);
    }
  }
  throw lastError;
}

function inferRooms(plan) {
  const roomCount = Number(plan.layout[0]);
  const rooms = [
    { id: "living-dining", name: "客餐厅", type: "living", yaw: -12 },
    { id: "kitchen", name: "厨房", type: "kitchen", yaw: 8 },
    { id: "master-bedroom", name: "主卧", type: "bedroom", yaw: 0 },
  ];

  if (roomCount >= 2) rooms.push({ id: "second-bedroom", name: "次卧", type: "bedroom", yaw: 4 });
  if (roomCount >= 3) rooms.push({ id: "children-room", name: "儿童房", type: "bedroom", yaw: -6 });
  if (roomCount >= 4) rooms.push({ id: "study", name: "书房", type: "study", yaw: 10 });

  for (let index = 1; index <= plan.bathrooms; index += 1) {
    rooms.push({
      id: plan.bathrooms === 1 ? "bathroom" : `bathroom-${index}`,
      name: plan.bathrooms === 1 ? "卫生间" : `卫生间${index}`,
      type: "bathroom",
      yaw: index % 2 === 0 ? 12 : -12,
    });
  }

  if (plan.balcony) {
    rooms.push({ id: "balcony", name: "阳台", type: "balcony", yaw: 0 });
  }

  return rooms.map((room, index, list) => ({
    ...room,
    sortOrder: index,
    adjacent: index === 0 ? list.slice(1).map((item) => item.id) : ["living-dining"],
  }));
}

function createFloorPlanPrompt({ community, plan }) {
  const roomCount = Number(plan.layout[0]);
  const bedroomText =
    roomCount >= 4
      ? "主卧、次卧、儿童房、书房"
      : roomCount === 3
        ? "主卧、次卧、儿童房"
        : "主卧、次卧";
  return [
    "Use case: infographic-diagram",
    "Asset type: furnished real estate floor plan",
    `Primary request: 绘制 ${community.name} ${plan.name} 的带家具平面图。`,
    `Layout facts: ${plan.area}㎡, ${plan.layout}, ${plan.orientation}, ${plan.bathrooms} 个卫生间, ${plan.balcony ? "有阳台" : "无阳台"}.`,
    `Rooms: 客餐厅、厨房、${bedroomText}、${plan.bathrooms === 1 ? "卫生间" : "卫生间1、卫生间2"}${plan.balcony ? "、阳台" : ""}.`,
    "Style: 深绿色粗墙线、暖白底、浅木色家具、售楼处户型图质感，中文房间名清晰。",
    "Spatial logic: 动线合理、门洞位置自然、家具尺度真实，床、沙发、餐桌、橱柜、卫浴洁具按房间功能摆放。",
    "Avoid: 多画房间、少画房间、英文文字、logo、水印、外立面、透视效果。",
  ].join("\n");
}

function createWhiteboxPrompt({ community, plan, room }) {
  return [
    "Use case: infographic-diagram",
    "Asset type: 360 equirectangular panorama for VR interior viewing",
    `Primary request: Generate a 2:1 360 equirectangular whitebox panorama for ${community.name} ${plan.name} - ${room.name}.`,
    `Floor plan facts: ${plan.area}㎡, ${plan.layout}, ${plan.orientation}, ${plan.bathrooms} bathrooms, balcony ${plan.balcony ? "yes" : "no"}.`,
    `Room: ${room.name}, type ${room.type}. Camera height 1.5m, standing near the room center, plausible apartment scale.`,
    "Whitebox requirements: pure white clay-model space, no decorative material, white walls, white ceiling, white floor, white clay furniture matching the room function, visible doors/windows/openings where plausible.",
    "Consistency: match the furnished floor plan room count and spatial logic; keep furniture scale realistic; make the room navigable and not oversized.",
    "Output: panoramic interior image, 2:1 equirectangular, no text, no watermark, no floor plan top-down view.",
  ].join("\n");
}

function createStylePrompt({ community, plan, room, style }) {
  return [
    "Use case: style-transfer",
    "Asset type: styled 360 equirectangular panorama for VR interior viewing",
    `Primary request: Render ${community.name} ${plan.name} - ${room.name} from the provided whitebox panorama into ${style.name}.`,
    `Style: ${style.prompt}.`,
    "Preserve: exact room structure, camera position, wall openings, doors, windows, ceiling height, main furniture positions and proportions from the whitebox reference.",
    "Change only: materials, colors, lighting, soft decoration and furniture finish.",
    "Output: 2:1 equirectangular panorama, no text, no watermark, not a top-down floor plan.",
  ].join("\n");
}

async function saveGeneratedImage({ buffer, publicPathBase, panorama }) {
  const info = detectImage(buffer);
  if (panorama) {
    assertPanoramaQc({ info });
  }
  const publicPath = `${publicPathBase}${info.ext}`;
  const outputPath = path.join(rootDir, "public", publicPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
  return { publicPath, info };
}

async function getCommunity(options) {
  const where = options.communityId ? { id: options.communityId } : { amapId: options.amapId };
  return prisma.communityPoi.findFirst({
    where,
    include: {
      floorPlans: {
        orderBy: [{ totalPrice: "asc" }, { area: "asc" }],
        include: {
          rooms: {
            orderBy: { sortOrder: "asc" },
            include: { assets: true },
          },
        },
      },
    },
  });
}

async function getCommunities(options) {
  const include = {
    floorPlans: {
      orderBy: [{ totalPrice: "asc" }, { area: "asc" }],
      include: {
        rooms: {
          orderBy: { sortOrder: "asc" },
          include: { assets: true },
        },
      },
    },
  };

  if (options.communityId || (!options.screenshotArea && !options.bbox && options.amapIds.length === 0)) {
    const community = await getCommunity(options);
    return community ? [community] : [];
  }

  const where = {};
  if (options.amapIds.length > 0) {
    where.amapId = { in: options.amapIds };
  }

  const bbox = options.screenshotArea ? screenshotAreaBounds : options.bbox;
  if (bbox) {
    where.longitude = { gte: bbox.minLng, lte: bbox.maxLng };
    where.latitude = { gte: bbox.minLat, lte: bbox.maxLat };
  }

  return prisma.communityPoi.findMany({
    where,
    orderBy: [{ longitude: "asc" }, { latitude: "asc" }],
    include,
  });
}

async function ensureRooms(plan) {
  if (plan.rooms.length > 0) {
    return plan.rooms;
  }

  const roomSpecs = inferRooms(plan);
  await prisma.communityFloorPlanRoom.createMany({
    data: roomSpecs.map((room) => ({
      communityFloorPlanId: plan.id,
      name: room.name,
      type: room.type,
      sortOrder: room.sortOrder,
      defaultYaw: room.yaw,
      adjacent: room.adjacent,
      hotspots: room.adjacent.map((target, index) => ({
        target,
        label: target === "living-dining" ? "去客餐厅" : "去房间",
        yaw: index * 28 - 28,
        pitch: -4,
      })),
    })),
  });

  return prisma.communityFloorPlanRoom.findMany({
    where: { communityFloorPlanId: plan.id },
    orderBy: { sortOrder: "asc" },
    include: { assets: true },
  });
}

function getPlanRoomsForDryRun(plan) {
  if (plan.rooms.length > 0) {
    return plan.rooms;
  }
  return inferRooms(plan).map((room) => ({
    id: room.id,
    communityFloorPlanId: plan.id,
    name: room.name,
    type: room.type,
    sortOrder: room.sortOrder,
    defaultYaw: room.yaw,
    adjacent: room.adjacent,
    hotspots: room.adjacent.map((target, index) => ({
      target,
      label: target === "living-dining" ? "去客餐厅" : "去房间",
      yaw: index * 28 - 28,
      pitch: -4,
    })),
    assets: [],
  }));
}

async function upsertAsset({ roomId, style, imageUrl, prompt, status, qcStatus, qcError = null }) {
  return prisma.communityRoomAsset.upsert({
    where: { roomId_styleId: { roomId, styleId: style.id } },
    create: {
      roomId,
      styleId: style.id,
      styleName: style.name,
      type: style.id === "whitebox" ? "panorama-whitebox" : "panorama-style",
      imageUrl,
      prompt,
      status,
      qcStatus,
      qcError,
    },
    update: {
      styleName: style.name,
      type: style.id === "whitebox" ? "panorama-whitebox" : "panorama-style",
      imageUrl,
      prompt,
      status,
      qcStatus,
      qcError,
    },
  });
}

function isAssetComplete(asset) {
  return Boolean(asset?.imageUrl && asset.status === "completed" && asset.qcStatus === "passed");
}

async function shouldGenerateAsset(asset, force) {
  if (force) {
    return true;
  }
  if (!isAssetComplete(asset)) {
    return true;
  }
  return !(await fileExists(asset.imageUrl));
}

async function shouldGenerateFloorPlan(plan, force) {
  if (force) {
    return true;
  }
  return !plan.imageUrl.startsWith(floorPlanPrefix) || !(await fileExists(plan.imageUrl));
}

async function processCommunity({ community, options, apiKey }) {
  let plannedAssets = 0;
  let completedAssets = 0;
  let failedAssets = 0;

  console.log(
    options.dryRun
      ? `dry-run community ${community.name} (${community.floorPlans.length} floor plans)`
      : `process community ${community.name} (${community.floorPlans.length} floor plans)`,
  );

  for (const plan of community.floorPlans) {
    const floorPlanPrompt = createFloorPlanPrompt({ community, plan });
    const floorPlanBase = `${floorPlanPrefix}/${slugify(community.name)}-${slugify(plan.name)}-${plan.id}`;
    const needsFloorPlan = options.dryRun
      ? options.forceFloorPlans || !plan.imageUrl.startsWith(floorPlanPrefix) || !(await fileExists(plan.imageUrl))
      : await shouldGenerateFloorPlan(plan, options.forceFloorPlans);

    if (options.dryRun && needsFloorPlan) {
      plannedAssets += 1;
      console.log(JSON.stringify({ community: community.name, type: "floor-plan", plan: plan.name, prompt: floorPlanPrompt }, null, 2));
    } else if (!options.dryRun && needsFloorPlan) {
      try {
        console.log(`generate floor plan ${community.name} / ${plan.name}`);
        const buffer = await generateImageWithRetry({
          apiKey,
          baseUrl: options.baseUrl,
          model: options.model,
          size: options.floorPlanSize,
          quality: options.quality,
          prompt: floorPlanPrompt,
          timeoutMs: options.timeoutMs,
        }, options.retries, options.retryDelayMs);
        const saved = await saveGeneratedImage({ buffer, publicPathBase: floorPlanBase, panorama: false });
        await prisma.communityFloorPlan.update({
          where: { id: plan.id },
          data: { imageUrl: saved.publicPath },
        });
        plan.imageUrl = saved.publicPath;
        completedAssets += 1;
      } catch (error) {
        failedAssets += 1;
        console.error(`failed floor plan ${community.name} / ${plan.name}:`, error instanceof Error ? error.message : error);
        continue;
      }
    }

    const rooms = options.dryRun ? getPlanRoomsForDryRun(plan) : await ensureRooms(plan);
    if (options.dryRun) {
      console.log(
        JSON.stringify({
          community: community.name,
          type: "rooms",
          plan: plan.name,
          rooms: rooms.map((room) => room.name),
        }),
      );
    }

    const floorPlanImage = options.dryRun ? "" : await readPublicImageDataUrl(plan.imageUrl);

    for (const room of rooms) {
      const existingAssets = new Map(room.assets.map((asset) => [asset.styleId, asset]));
      const whitebox = styles[0];
      const whiteboxPrompt = createWhiteboxPrompt({ community, plan, room });
      const whiteboxBase = `${panoramaPrefix}/${plan.id}/whitebox/${room.id}`;
      let whiteboxPath = existingAssets.get("whitebox")?.imageUrl;

      const needsWhitebox = options.dryRun
        ? options.forcePanoramas || !isAssetComplete(existingAssets.get("whitebox")) || !(whiteboxPath && (await fileExists(whiteboxPath)))
        : await shouldGenerateAsset(existingAssets.get("whitebox"), options.forcePanoramas);

      if (options.dryRun && needsWhitebox) {
        plannedAssets += 1;
        console.log(JSON.stringify({ community: community.name, type: "panorama-whitebox", plan: plan.name, room: room.name, prompt: whiteboxPrompt }, null, 2));
      } else if (!options.dryRun && needsWhitebox) {
        try {
          console.log(`generate whitebox ${plan.name} / ${room.name}`);
          const buffer = await generateImageWithRetry({
            apiKey,
            baseUrl: options.baseUrl,
            model: options.model,
            size: options.panoramaSize,
            quality: options.quality,
            prompt: whiteboxPrompt,
            images: [floorPlanImage],
            timeoutMs: options.timeoutMs,
          }, options.retries, options.retryDelayMs);
          const saved = await saveGeneratedImage({ buffer, publicPathBase: whiteboxBase, panorama: true });
          whiteboxPath = saved.publicPath;
          const savedAsset = await upsertAsset({ roomId: room.id, style: whitebox, imageUrl: saved.publicPath, prompt: whiteboxPrompt, status: "completed", qcStatus: "passed" });
          existingAssets.set("whitebox", savedAsset);
          completedAssets += 1;
        } catch (error) {
          await upsertAsset({ roomId: room.id, style: whitebox, imageUrl: whiteboxPath ?? "", prompt: whiteboxPrompt, status: "failed", qcStatus: "failed", qcError: error instanceof Error ? error.message : "unknown error" });
          failedAssets += 1;
          console.error(`failed whitebox ${plan.name} / ${room.name}:`, error instanceof Error ? error.message : error);
          continue;
        }
      }

      if (!options.dryRun && (!whiteboxPath || !(await fileExists(whiteboxPath)))) {
        continue;
      }

      const whiteboxImage = options.dryRun ? "" : await readPublicImageDataUrl(whiteboxPath);
      for (const style of styles.slice(1)) {
        const existing = existingAssets.get(style.id);
        const stylePrompt = createStylePrompt({ community, plan, room, style });
        const styleBase = `${panoramaPrefix}/${plan.id}/${style.id}/${room.id}`;
        const needsStyle = options.dryRun
          ? options.forcePanoramas || !isAssetComplete(existing) || !(existing?.imageUrl && (await fileExists(existing.imageUrl)))
          : await shouldGenerateAsset(existing, options.forcePanoramas);

        if (options.dryRun && needsStyle) {
          plannedAssets += 1;
          console.log(JSON.stringify({ community: community.name, type: "panorama-style", style: style.name, plan: plan.name, room: room.name, prompt: stylePrompt }, null, 2));
        } else if (!options.dryRun && needsStyle) {
          try {
            console.log(`generate ${style.name} ${plan.name} / ${room.name}`);
            const buffer = await generateImageWithRetry({
              apiKey,
              baseUrl: options.baseUrl,
              model: options.model,
              size: options.panoramaSize,
              quality: options.quality,
              prompt: stylePrompt,
              images: [whiteboxImage],
              timeoutMs: options.timeoutMs,
            }, options.retries, options.retryDelayMs);
            const saved = await saveGeneratedImage({ buffer, publicPathBase: styleBase, panorama: true });
            const savedAsset = await upsertAsset({ roomId: room.id, style, imageUrl: saved.publicPath, prompt: stylePrompt, status: "completed", qcStatus: "passed" });
            existingAssets.set(style.id, savedAsset);
            completedAssets += 1;
          } catch (error) {
            await upsertAsset({ roomId: room.id, style, imageUrl: existing?.imageUrl ?? "", prompt: stylePrompt, status: "failed", qcStatus: "failed", qcError: error instanceof Error ? error.message : "unknown error" });
            failedAssets += 1;
            console.error(`failed ${style.name} ${plan.name} / ${room.name}:`, error instanceof Error ? error.message : error);
          }
        }
      }
    }
  }

  return { plannedAssets, completedAssets, failedAssets };
}

async function main() {
  await loadEnvFile(path.join(rootDir, ".env"));
  await loadEnvFile(path.join(rootDir, ".env.local"));
  const options = readArgs();
  const apiKey = process.env.IMAGE_GEN_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey && !options.dryRun) {
    throw new Error("IMAGE_GEN_API_KEY or OPENAI_API_KEY is missing.");
  }

  const communities = await getCommunities(options);
  if (communities.length === 0) {
    throw new Error("No communities found.");
  }

  console.log(
    JSON.stringify({
      mode: options.dryRun ? "dry-run" : "generate",
      communities: communities.length,
      floorPlans: communities.reduce((total, community) => total + community.floorPlans.length, 0),
      names: communities.map((community) => community.name),
    }),
  );

  const summary = { plannedAssets: 0, completedAssets: 0, failedAssets: 0 };
  for (const community of communities) {
    const result = await processCommunity({ community, options, apiKey });
    summary.plannedAssets += result.plannedAssets;
    summary.completedAssets += result.completedAssets;
    summary.failedAssets += result.failedAssets;
  }

  console.log(
    options.dryRun
      ? `planned asset generations: ${summary.plannedAssets}`
      : `generation finished: completed=${summary.completedAssets}, failed=${summary.failedAssets}`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
