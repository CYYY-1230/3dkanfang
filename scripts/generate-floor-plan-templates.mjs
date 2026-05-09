import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rootDir = process.cwd();
const defaultBaseUrl = "https://api.openai.com/v1";
const defaultModel = "gpt-image-2";
const defaultQuality = "medium";
const defaultSize = "1024x1024";
const defaultTimeoutMs = 150000;
const defaultRetryDelayMs = 30000;
const templateDir = "/generated/floor-plan-templates";

const templateTargets = [
  {
    id: "two-room",
    output: `${templateDir}/two-room-clean.png`,
    sourcePlanName: "舒适两房",
    prompt: [
      "Use case: precise-object-edit",
      "Asset type: reusable furnished real estate floor plan template",
      "Primary request: Edit the provided two-bedroom floor plan into a generic clean template.",
      "Change only: remove the top title plate and all fixed header text, including community name, area, layout, orientation, badges, and decorative label frame.",
      "Preserve: the floor plan layout, wall geometry, room positions, furniture, windows, doors, warm off-white background, deep green wall lines, light wood furniture, and Chinese room labels inside rooms.",
      "Required visible text: keep only room names such as 客餐厅、厨房、主卧、次卧、卫生间、阳台.",
      "Composition: centered top-down sales-office floor plan, clean margins, no external title block.",
      "Avoid: 景江城市花园, 舒适两房, area numbers, orientation text, price text, watermarks, logos, English text, changed room count.",
    ].join("\n"),
  },
  {
    id: "three-room",
    output: `${templateDir}/three-room-clean.png`,
    sourcePlanName: "改善三房",
    prompt: [
      "Use case: precise-object-edit",
      "Asset type: reusable furnished real estate floor plan template",
      "Primary request: Edit the provided three-bedroom floor plan into a generic clean template.",
      "Change only: remove all fixed left-side/top text, including community name, floor plan name, area, layout, orientation, small badges, and any title blocks.",
      "Preserve: the floor plan layout, wall geometry, room positions, furniture, windows, doors, warm off-white background, deep green wall lines, light wood furniture, and Chinese room labels inside rooms.",
      "Required visible text: keep only room names such as 客餐厅、厨房、主卧、次卧、儿童房、卫生间1、卫生间2、阳台.",
      "Composition: centered top-down sales-office floor plan, clean margins, no external title block.",
      "Avoid: 景江城市花园, 改善三房, area numbers, orientation text, price text, watermarks, logos, English text, changed room count.",
    ].join("\n"),
  },
  {
    id: "four-room",
    output: `${templateDir}/four-room-clean.png`,
    prompt: [
      "Use case: infographic-diagram",
      "Asset type: reusable furnished real estate floor plan template",
      "Primary request: Create a generic four-bedroom 2-living-room 2-bathroom furnished apartment floor plan template.",
      "Layout facts: 4室2厅2卫, includes 客餐厅、厨房、主卧、次卧、儿童房、书房、卫生间1、卫生间2、阳台.",
      "Style/medium: polished Chinese real-estate sales-office floor plan, top-down orthographic view.",
      "Color palette: deep green thick wall lines, warm off-white background, light oak furniture, soft beige flooring.",
      "Composition/framing: centered floor plan with clean margins, no title block, no header plate, no community name, no area text, no orientation text.",
      "Spatial logic: plausible apartment scale, natural circulation, doors and windows positioned sensibly, furniture scale realistic.",
      "Required visible text: only Chinese room names inside rooms: 客餐厅、厨房、主卧、次卧、儿童房、书房、卫生间1、卫生间2、阳台.",
      "Avoid: community names, area numbers, price text, orientation arrows, watermarks, logos, English text, exterior perspective.",
    ].join("\n"),
  },
];

function readArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    force: false,
    target: "all",
    retries: 4,
    retryDelayMs: Number(process.env.IMAGE_GEN_RETRY_DELAY_MS ?? defaultRetryDelayMs),
    timeoutMs: Number(process.env.IMAGE_GEN_TIMEOUT_MS ?? defaultTimeoutMs),
    baseUrl: process.env.IMAGE_GEN_BASE_URL ?? defaultBaseUrl,
    model: process.env.IMAGE_GEN_MODEL ?? defaultModel,
    quality: process.env.IMAGE_GEN_QUALITY ?? defaultQuality,
    size: process.env.IMAGE_GEN_SIZE ?? defaultSize,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--target" && next) {
      options.target = next;
      index += 1;
    } else if (arg === "--retries" && next) {
      const retries = Number(next);
      options.retries = Number.isFinite(retries) ? Math.max(0, retries) : options.retries;
      index += 1;
    } else if (arg === "--retry-delay-ms" && next) {
      const retryDelayMs = Number(next);
      options.retryDelayMs = Number.isFinite(retryDelayMs) ? Math.max(1000, retryDelayMs) : options.retryDelayMs;
      index += 1;
    } else if (arg === "--timeout-ms" && next) {
      const timeoutMs = Number(next);
      options.timeoutMs = Number.isFinite(timeoutMs) ? Math.max(10000, timeoutMs) : options.timeoutMs;
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

function getGenerationUrl(baseUrl) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return normalizedBaseUrl.endsWith("/v1/images/generations")
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/images/generations`;
}

function detectImage(buffer) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { ext: ".png", mime: "image/png" };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: ".jpg", mime: "image/jpeg" };
  }
  if (buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { ext: ".webp", mime: "image/webp" };
  }
  throw new Error("Image API returned data that is not PNG, JPEG, or WebP.");
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

async function generateImage({ apiKey, baseUrl, model, size, quality, prompt, images, timeoutMs }) {
  const body = {
    model,
    prompt,
    size,
    quality,
    response_format: "b64_json",
  };

  if (images?.length) {
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
    throw new Error(`Image generation failed: ${response.status} ${await response.text()}`);
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
        `retry template generation ${attempt + 1}/${retries} after ${delay}ms:`,
        error instanceof Error ? error.message : error,
      );
      await wait(delay);
    }
  }
  throw lastError;
}

async function getJingjiangSourcePlans() {
  const community = await prisma.communityPoi.findFirst({
    where: { amapId: "B0LD1K99OJ" },
    include: { floorPlans: true },
  });
  if (!community) {
    throw new Error("景江城市花园 template community not found.");
  }
  return community.floorPlans;
}

async function saveTemplate(buffer, publicPath) {
  detectImage(buffer);
  const outputPath = path.join(rootDir, "public", publicPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
}

async function main() {
  await loadEnvFile(path.join(rootDir, ".env"));
  await loadEnvFile(path.join(rootDir, ".env.local"));
  const options = readArgs();
  const apiKey = process.env.IMAGE_GEN_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey && !options.dryRun) {
    throw new Error("IMAGE_GEN_API_KEY or OPENAI_API_KEY is missing.");
  }

  const selectedTargets = templateTargets.filter((target) => options.target === "all" || target.id === options.target);
  if (selectedTargets.length === 0) {
    throw new Error(`Unknown target: ${options.target}`);
  }

  const sourcePlans = await getJingjiangSourcePlans();
  for (const target of selectedTargets) {
    const exists = await fileExists(target.output);
    const sourcePlan = target.sourcePlanName
      ? sourcePlans.find((plan) => plan.name === target.sourcePlanName)
      : undefined;
    if (target.sourcePlanName && !sourcePlan) {
      throw new Error(`Source plan not found: ${target.sourcePlanName}`);
    }

    const images = sourcePlan ? [await readPublicImageDataUrl(sourcePlan.imageUrl)] : [];
    const action = exists && !options.force ? "skip" : "generate";
    console.log(JSON.stringify({ target: target.id, output: target.output, action, source: sourcePlan?.imageUrl ?? null }));

    if (options.dryRun || action === "skip") {
      continue;
    }

    const buffer = await generateImageWithRetry(
      {
        apiKey,
        baseUrl: options.baseUrl,
        model: options.model,
        size: options.size,
        quality: options.quality,
        prompt: target.prompt,
        images,
        timeoutMs: options.timeoutMs,
      },
      options.retries,
      options.retryDelayMs,
    );
    await saveTemplate(buffer, target.output);
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
