import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rootDir = process.cwd();
const outputDir = path.join(rootDir, "public", "generated", "floor-plans");
const publicPrefix = "/generated/floor-plans";
const defaultBaseUrl = "https://api.openai.com/v1";
const defaultModel = "gpt-image-2";
const defaultSize = "1024x1024";
const defaultQuality = "medium";
const imageSignatures = [
  { ext: ".png", mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { ext: ".jpg", mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { ext: ".webp", mime: "image/webp", asciiAt: [8, "WEBP"] },
];

function readArgs() {
  const args = process.argv.slice(2);
  const options = {
    amapId: "",
    communityId: "",
    bounds: "",
    limit: 1,
    force: false,
    dryRun: false,
    baseUrl: process.env.IMAGE_GEN_BASE_URL ?? defaultBaseUrl,
    model: process.env.IMAGE_GEN_MODEL ?? defaultModel,
    size: process.env.IMAGE_GEN_SIZE ?? defaultSize,
    quality: process.env.IMAGE_GEN_QUALITY ?? defaultQuality,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--amap-id" && next) {
      options.amapId = next;
      index += 1;
    } else if (arg === "--community-id" && next) {
      options.communityId = next;
      index += 1;
    } else if (arg === "--bounds" && next) {
      options.bounds = next;
      index += 1;
    } else if (arg === "--limit" && next) {
      options.limit = Number(next);
      index += 1;
    } else if (arg === "--model" && next) {
      options.model = next;
      index += 1;
    } else if (arg === "--base-url" && next) {
      options.baseUrl = next;
      index += 1;
    } else if (arg === "--size" && next) {
      options.size = next;
      index += 1;
    } else if (arg === "--quality" && next) {
      options.quality = next;
      index += 1;
    } else if (arg === "--force") {
      options.force = true;
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
      if (process.env[key]) {
        continue;
      }

      process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
    }
  } catch {
    // Optional local env files are allowed to be absent.
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
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

function detectImageExtension(buffer) {
  for (const signature of imageSignatures) {
    if (
      signature.bytes &&
      signature.bytes.every((byte, index) => buffer[index] === byte)
    ) {
      return signature.ext;
    }

    if (
      signature.asciiAt &&
      buffer
        .subarray(signature.asciiAt[0], signature.asciiAt[0] + signature.asciiAt[1].length)
        .toString("ascii") === signature.asciiAt[1]
    ) {
      return signature.ext;
    }
  }

  throw new Error("Image API returned data that is not PNG, JPEG, or WebP.");
}

function isGeneratedImage(imageUrl) {
  return imageUrl.startsWith(publicPrefix);
}

async function fileExists(publicPath) {
  if (!publicPath.startsWith("/")) {
    return false;
  }

  try {
    await fs.access(path.join(rootDir, "public", publicPath));
    return true;
  } catch {
    return false;
  }
}

function parseBounds(bounds) {
  if (!bounds) {
    return undefined;
  }

  const [west, south, east, north] = bounds.split(",").map(Number);
  if (![west, south, east, north].every(Number.isFinite)) {
    throw new Error("Invalid --bounds. Use west,south,east,north.");
  }

  return { west, south, east, north };
}

function createPrompt({ community, plan }) {
  const roomCount = Number(plan.layout[0]);
  const hasBalcony = plan.balcony ? "include one balcony clearly labeled 阳台" : "do not include a balcony";
  const bathroomText = plan.bathrooms >= 2 ? "two bathrooms labeled 卫生间" : "one bathroom labeled 卫生间";
  const bedroomText =
    roomCount >= 4
      ? "four bedrooms: 主卧, 次卧, 儿童房, 书房"
      : roomCount === 3
        ? "three bedrooms: 主卧, 次卧, 儿童房"
        : "two bedrooms: 主卧, 次卧";

  return [
    "Use case: infographic-diagram",
    "Asset type: real estate floor plan image for a web listing card",
    `Primary request: Create a clean top-down residential floor plan for ${community.name}, ${plan.name}.`,
    "Style/medium: premium furnished real-estate sales floor plan, crisp 2D architectural diagram, off-white background, dark green exterior walls, thin interior walls, muted sage and warm beige room fills.",
    "Composition/framing: square image, centered plan, generous margin, no perspective, no 3D, simple doors and windows.",
    `Layout facts: ${plan.area} square meters, ${plan.layout}, ${plan.orientation} orientation, ${bathroomText}, ${hasBalcony}.`,
    `Rooms: 客餐厅, 厨房, ${bedroomText}, ${bathroomText}, ${plan.balcony ? "阳台" : "storage niche if useful"}.`,
    "Furniture: include tasteful simple top-down furniture in each room: sofa, coffee table and dining table in 客餐厅; bed and wardrobe in each bedroom; cabinets, sink and stove in 厨房; toilet, basin and shower in 卫生间; small table or plants on 阳台 when present.",
    "Text: Chinese room labels only, short and readable: 客餐厅, 厨房, 主卧, 次卧, 儿童房, 书房, 卫生间, 阳台.",
    "Constraints: keep the room count, bathroom count, and balcony setting consistent with the layout facts; make circulation plausible for a Hangzhou apartment; use straight orthogonal walls.",
    "Avoid: empty unfurnished rooms, photorealistic interior render, exterior building, people, logo, watermark, messy tiny text, English labels, duplicated rooms, impossible overlapping rooms.",
  ].join("\n");
}

async function getCommunities(options) {
  const bounds = parseBounds(options.bounds);
  const where = {};

  if (options.amapId) {
    where.amapId = options.amapId;
  } else if (options.communityId) {
    where.id = options.communityId;
  } else if (bounds) {
    where.longitude = { gte: bounds.west, lte: bounds.east };
    where.latitude = { gte: bounds.south, lte: bounds.north };
  }

  return prisma.communityPoi.findMany({
    where,
    include: {
      floorPlans: {
        orderBy: [{ totalPrice: "asc" }, { area: "asc" }],
      },
    },
    orderBy: [{ district: "asc" }, { name: "asc" }],
    take: options.limit,
  });
}

function getGenerationUrl(baseUrl) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  if (normalizedBaseUrl.endsWith("/v1/images/generations")) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}/images/generations`;
}

async function generateImage({ apiKey, baseUrl, model, size, quality, prompt }) {
  const response = await fetch(getGenerationUrl(baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      quality,
      response_format: "b64_json",
    }),
  });

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
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      throw new Error(`Generated image download failed: ${imageResponse.status}`);
    }
    return Buffer.from(await imageResponse.arrayBuffer());
  }

  throw new Error("Image generation response did not contain b64_json or url.");
}

async function main() {
  await loadEnvFile(path.join(rootDir, ".env"));
  await loadEnvFile(path.join(rootDir, ".env.local"));

  const options = readArgs();
  const apiKey = process.env.IMAGE_GEN_API_KEY ?? process.env.OPENAI_API_KEY;
  const communities = await getCommunities(options);

  if (communities.length === 0) {
    console.log("No communities matched.");
    return;
  }

  if (!apiKey && !options.dryRun) {
    throw new Error("IMAGE_GEN_API_KEY or OPENAI_API_KEY is missing. Add it to your shell env or .env.local, then rerun.");
  }

  await fs.mkdir(outputDir, { recursive: true });

  for (const community of communities) {
    for (const plan of community.floorPlans) {
      if (!options.force && isGeneratedImage(plan.imageUrl) && (await fileExists(plan.imageUrl))) {
        console.log(`skip existing ${community.name} / ${plan.name}: ${plan.imageUrl}`);
        continue;
      }

      const prompt = createPrompt({ community, plan });
      const filenameBase = `${slugify(community.name)}-${slugify(plan.name)}-${plan.id}`;

      if (options.dryRun) {
        console.log(
          JSON.stringify(
            {
              community: community.name,
              plan: plan.name,
              publicPathPattern: `${publicPrefix}/${filenameBase}.<png|jpg|webp>`,
              request: {
                url: getGenerationUrl(options.baseUrl),
                model: options.model,
                size: options.size,
                quality: options.quality,
                response_format: "b64_json",
              },
              prompt,
            },
            null,
            2,
          ),
        );
        continue;
      }

      console.log(`generate ${community.name} / ${plan.name}`);
      const imageBuffer = await generateImage({
        apiKey,
        baseUrl: options.baseUrl,
        model: options.model,
        size: options.size,
        quality: options.quality,
        prompt,
      });
      const extension = detectImageExtension(imageBuffer);
      const filename = `${filenameBase}${extension}`;
      const outputPath = path.join(outputDir, filename);
      const publicPath = `${publicPrefix}/${filename}`;

      await fs.writeFile(outputPath, imageBuffer);
      await prisma.communityFloorPlan.update({
        where: { id: plan.id },
        data: { imageUrl: publicPath },
      });
      console.log(`saved ${publicPath}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
