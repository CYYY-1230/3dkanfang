import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const floorPlanPath = "/generated/floor-plan-templates/four-room-clean.png";
const panoramaPrefix = "/generated/panorama-templates/four-room";
const defaultBaseUrl = "https://api.openai.com/v1";
const defaultModel = "gpt-image-2";
const defaultQuality = "medium";
const defaultPanoramaSize = "2048x1024";
const defaultTimeoutMs = 150000;
const defaultRetryDelayMs = 45000;

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

const rooms = [
  { key: "living-dining", name: "客餐厅", type: "living" },
  { key: "kitchen", name: "厨房", type: "kitchen" },
  { key: "master-bedroom", name: "主卧", type: "bedroom" },
  { key: "second-bedroom", name: "次卧", type: "bedroom" },
  { key: "children-room", name: "儿童房", type: "bedroom" },
  { key: "study", name: "书房", type: "study" },
  { key: "bathroom-1", name: "卫生间1", type: "bathroom" },
  { key: "bathroom-2", name: "卫生间2", type: "bathroom" },
  { key: "balcony", name: "阳台", type: "balcony" },
];

const imageSignatures = [
  { ext: ".png", mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47], size: readPngSize },
  { ext: ".jpg", mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff], size: readJpegSize },
  { ext: ".webp", mime: "image/webp", asciiAt: [8, "WEBP"], size: readWebpSize },
];

function readArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    force: false,
    retries: 6,
    retryDelayMs: Number(process.env.IMAGE_GEN_RETRY_DELAY_MS ?? defaultRetryDelayMs),
    timeoutMs: Number(process.env.IMAGE_GEN_TIMEOUT_MS ?? defaultTimeoutMs),
    baseUrl: process.env.IMAGE_GEN_BASE_URL ?? defaultBaseUrl,
    model: process.env.IMAGE_GEN_MODEL ?? defaultModel,
    quality: process.env.IMAGE_GEN_QUALITY ?? defaultQuality,
    panoramaSize: process.env.IMAGE_GEN_PANORAMA_SIZE ?? defaultPanoramaSize,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--force") {
      options.force = true;
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
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
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

function assertPanorama(buffer) {
  const info = detectImage(buffer);
  const ratio = info.width / Math.max(info.height, 1);
  if (ratio < 1.8 || ratio > 2.2) {
    throw new Error(`Panorama ratio failed: ${info.width}x${info.height}`);
  }
  return info;
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
        `retry four-room template generation ${attempt + 1}/${retries} after ${delay}ms:`,
        error instanceof Error ? error.message : error,
      );
      await wait(delay);
    }
  }
  throw lastError;
}

function createWhiteboxPrompt(room) {
  return [
    "Use case: infographic-diagram",
    "Asset type: reusable 360 equirectangular panorama template for VR interior viewing",
    `Primary request: Generate a 2:1 360 equirectangular whitebox panorama for a generic four-bedroom apartment - ${room.name}.`,
    "Floor plan facts: 4室2厅2卫, includes 客餐厅、厨房、主卧、次卧、儿童房、书房、卫生间1、卫生间2、阳台.",
    `Room: ${room.name}, type ${room.type}. Camera height 1.5m, standing near the room center, plausible apartment scale.`,
    "Whitebox requirements: pure white clay-model space, no decorative material, white walls, white ceiling, white floor, white clay furniture matching the room function, visible doors/windows/openings where plausible.",
    "Consistency: match the supplied four-room floor plan, keep room scale realistic, no text, no watermark.",
    "Output: panoramic interior image, 2:1 equirectangular, no floor plan top-down view.",
  ].join("\n");
}

function createStylePrompt(room, style) {
  return [
    "Use case: style-transfer",
    "Asset type: reusable styled 360 equirectangular panorama template for VR interior viewing",
    `Primary request: Render generic four-bedroom apartment - ${room.name} from the provided whitebox panorama into ${style.name}.`,
    `Style: ${style.prompt}.`,
    "Preserve: exact room structure, camera position, wall openings, doors, windows, ceiling height, main furniture positions and proportions from the whitebox reference.",
    "Change only: materials, colors, lighting, soft decoration and furniture finish.",
    "Output: 2:1 equirectangular panorama, no text, no watermark, not a top-down floor plan.",
  ].join("\n");
}

async function saveGeneratedImage(buffer, publicPathBase) {
  const info = assertPanorama(buffer);
  const publicPath = `${publicPathBase}${info.ext}`;
  const outputPath = path.join(rootDir, "public", publicPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
  return publicPath;
}

async function main() {
  await loadEnvFile(path.join(rootDir, ".env"));
  await loadEnvFile(path.join(rootDir, ".env.local"));
  const options = readArgs();
  const apiKey = process.env.IMAGE_GEN_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey && !options.dryRun) {
    throw new Error("IMAGE_GEN_API_KEY or OPENAI_API_KEY is missing.");
  }
  if (!(await fileExists(floorPlanPath))) {
    throw new Error(`Four-room floor plan template is missing: ${floorPlanPath}`);
  }

  const floorPlanImage = options.dryRun ? "" : await readPublicImageDataUrl(floorPlanPath);
  let planned = 0;
  let completed = 0;

  for (const room of rooms) {
    const whiteboxPathBase = `${panoramaPrefix}/whitebox/${room.key}`;
    let whiteboxPath = `${whiteboxPathBase}.png`;
    const needsWhitebox = options.force || !(await fileExists(whiteboxPath));
    if (options.dryRun || needsWhitebox) {
      planned += needsWhitebox ? 1 : 0;
      console.log(JSON.stringify({ type: "whitebox", room: room.name, action: needsWhitebox ? "generate" : "skip", output: whiteboxPath }));
    }
    if (!options.dryRun && needsWhitebox) {
      const buffer = await generateImageWithRetry(
        {
          apiKey,
          baseUrl: options.baseUrl,
          model: options.model,
          size: options.panoramaSize,
          quality: options.quality,
          prompt: createWhiteboxPrompt(room),
          images: [floorPlanImage],
          timeoutMs: options.timeoutMs,
        },
        options.retries,
        options.retryDelayMs,
      );
      whiteboxPath = await saveGeneratedImage(buffer, whiteboxPathBase);
      completed += 1;
    }

    if (!options.dryRun && !(await fileExists(whiteboxPath))) {
      continue;
    }
    const whiteboxImage = options.dryRun ? "" : await readPublicImageDataUrl(whiteboxPath);
    for (const style of styles.slice(1)) {
      const stylePathBase = `${panoramaPrefix}/${style.id}/${room.key}`;
      const stylePath = `${stylePathBase}.png`;
      const needsStyle = options.force || !(await fileExists(stylePath));
      if (options.dryRun || needsStyle) {
        planned += needsStyle ? 1 : 0;
        console.log(JSON.stringify({ type: "style", style: style.name, room: room.name, action: needsStyle ? "generate" : "skip", output: stylePath }));
      }
      if (!options.dryRun && needsStyle) {
        const buffer = await generateImageWithRetry(
          {
            apiKey,
            baseUrl: options.baseUrl,
            model: options.model,
            size: options.panoramaSize,
            quality: options.quality,
            prompt: createStylePrompt(room, style),
            images: [whiteboxImage],
            timeoutMs: options.timeoutMs,
          },
          options.retries,
          options.retryDelayMs,
        );
        await saveGeneratedImage(buffer, stylePathBase);
        completed += 1;
      }
    }
  }

  console.log(options.dryRun ? `planned four-room template assets: ${planned}` : `four-room template generation finished: completed=${completed}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
