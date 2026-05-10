import process from "node:process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const defaultRadius = "1500";
const defaultOffset = "12";
const defaultDelayMs = 250;
const defaultRetryDelayMs = 30000;

const poiCategories = [
  {
    id: "transit",
    label: "交通",
    keywords: "地铁|公交",
    types: "150500|150700",
  },
  {
    id: "education",
    label: "教育",
    keywords: "学校|幼儿园",
    types: "141200|141201|141202|141203",
  },
  {
    id: "shopping",
    label: "商业",
    keywords: "商场|超市",
    types: "060100|060400",
  },
  {
    id: "medical",
    label: "医疗",
    keywords: "医院|诊所",
    types: "090100|090200",
  },
  {
    id: "park",
    label: "公园",
    keywords: "公园|景点",
    types: "110100|110200",
  },
];

function readArgs() {
  const options = {
    limit: Number.POSITIVE_INFINITY,
    skipExisting: true,
    radius: defaultRadius,
    offset: defaultOffset,
    delayMs: defaultDelayMs,
    retryDelayMs: defaultRetryDelayMs,
    retries: 3,
    categoryConcurrency: 1,
    dryRun: false,
  };

  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--limit" && next) {
      options.limit = Number(next);
      index += 1;
    } else if (arg === "--radius" && next) {
      options.radius = next;
      index += 1;
    } else if (arg === "--offset" && next) {
      options.offset = next;
      index += 1;
    } else if (arg === "--delay-ms" && next) {
      options.delayMs = Number(next);
      index += 1;
    } else if (arg === "--retry-delay-ms" && next) {
      options.retryDelayMs = Number(next);
      index += 1;
    } else if (arg === "--retries" && next) {
      options.retries = Number(next);
      index += 1;
    } else if (arg === "--category-concurrency" && next) {
      options.categoryConcurrency = Number(next);
      index += 1;
    } else if (arg === "--include-existing") {
      options.skipExisting = false;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizePoi(poi, category) {
  const [lng, lat] = String(poi.location ?? "").split(",");

  return {
    amapId: poi.id ?? `${category.label}-${poi.name}`,
    name: poi.name ?? "未命名配套",
    category: category.label,
    type: poi.type ?? null,
    typecode: poi.typecode ?? null,
    address: Array.isArray(poi.address) ? "" : (poi.address ?? ""),
    longitude: Number(lng),
    latitude: Number(lat),
    distance: Math.round(Number(poi.distance ?? 0)),
  };
}

async function fetchAmapNearbyPois({ key, community, category, radius, offset }) {
  const url = new URL("https://restapi.amap.com/v3/place/around");
  url.searchParams.set("key", key);
  url.searchParams.set("location", `${community.longitude},${community.latitude}`);
  url.searchParams.set("radius", radius);
  url.searchParams.set("types", category.types);
  url.searchParams.set("keywords", category.keywords);
  url.searchParams.set("offset", offset);
  url.searchParams.set("page", "1");
  url.searchParams.set("extensions", "base");
  url.searchParams.set("sortrule", "distance");
  url.searchParams.set("output", "json");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`AMap HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.status !== "1") {
    throw new Error(payload.info ?? "AMap POI service returned an error.");
  }

  return (payload.pois ?? [])
    .map((poi) => normalizePoi(poi, category))
    .filter((poi) => poi.name && Number.isFinite(poi.longitude) && Number.isFinite(poi.latitude));
}

async function fetchAmapNearbyPoisWithRetry({ key, community, category, radius, offset, retries, retryDelayMs }) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchAmapNearbyPois({ key, community, category, radius, offset });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const canRetry = message.includes("CUQPS_HAS_EXCEEDED_THE_LIMIT") && attempt < retries;

      if (!canRetry) {
        throw error;
      }

      console.warn(
        `${category.label}: AMap QPS limit hit, waiting ${Math.round(retryDelayMs / 1000)}s before retry ${attempt + 1}/${retries}.`,
      );
      await wait(retryDelayMs);
    }
  }

  return [];
}

async function saveNearbyPois({ community, pois }) {
  let saved = 0;

  for (const poi of pois) {
    await prisma.communityNearbyPoi.upsert({
      where: {
        communityPoiId_amapId_category: {
          communityPoiId: community.id,
          amapId: poi.amapId,
          category: poi.category,
        },
      },
      create: {
        communityPoiId: community.id,
        amapId: poi.amapId,
        name: poi.name,
        category: poi.category,
        type: poi.type,
        typecode: poi.typecode,
        address: poi.address,
        longitude: poi.longitude,
        latitude: poi.latitude,
        distance: poi.distance,
        collectedAt: new Date(),
      },
      update: {
        name: poi.name,
        type: poi.type,
        typecode: poi.typecode,
        address: poi.address,
        longitude: poi.longitude,
        latitude: poi.latitude,
        distance: poi.distance,
        collectedAt: new Date(),
      },
    });
    saved += 1;
  }

  return saved;
}

async function main() {
  const options = readArgs();
  const key = process.env.AMAP_WEB_SERVICE_KEY;

  if (!key) {
    throw new Error("AMAP_WEB_SERVICE_KEY is missing. Add it to .env.local or your shell env.");
  }

  const communities = await prisma.communityPoi.findMany({
    select: {
      id: true,
      amapId: true,
      name: true,
      longitude: true,
      latitude: true,
      _count: { select: { nearbyPois: true } },
    },
    orderBy: [{ collectedAt: "desc" }, { id: "asc" }],
  });

  const targets = communities
    .filter((community) => !options.skipExisting || community._count.nearbyPois === 0)
    .slice(0, options.limit);

  console.log(
    JSON.stringify(
      {
        totalCommunities: communities.length,
        targets: targets.length,
        skipExisting: options.skipExisting,
        radius: options.radius,
        offset: options.offset,
        dryRun: options.dryRun,
      },
      null,
      2,
    ),
  );

  let totalSaved = 0;
  let failed = 0;

  for (let index = 0; index < targets.length; index += 1) {
    const community = targets[index];
    const label = `${index + 1}/${targets.length} ${community.name} (${community.amapId ?? community.id})`;

    try {
      let communitySaved = 0;
      const counts = {};

      const categoryChunks = chunkArray(
        poiCategories,
        Math.max(1, Math.min(poiCategories.length, options.categoryConcurrency)),
      );

      for (const categoryChunk of categoryChunks) {
        const categoryResults = await Promise.all(
          categoryChunk.map(async (category) => ({
            category,
            pois: await fetchAmapNearbyPoisWithRetry({
              key,
              community,
              category,
              radius: options.radius,
              offset: options.offset,
              retries: options.retries,
              retryDelayMs: options.retryDelayMs,
            }),
          })),
        );

        for (const { category, pois } of categoryResults) {
          counts[category.label] = pois.length;

          if (!options.dryRun) {
            communitySaved += await saveNearbyPois({ community, pois });
          }
        }

        if (options.delayMs > 0) {
          await wait(options.delayMs);
        }
      }

      totalSaved += communitySaved;
      console.log(`${label}: saved ${communitySaved}`, counts);
    } catch (error) {
      failed += 1;
      console.error(`${label}: failed`, error instanceof Error ? error.message : error);
    }
  }

  console.log(
    JSON.stringify(
      {
        processed: targets.length,
        totalSaved,
        failed,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
