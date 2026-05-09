import { NextResponse } from "next/server";
import { collectAmapCommunityPois } from "@/lib/amap-communities";
import { canUseLiveAmapApi } from "@/lib/amap-live-api";
import { collectCommunityNearbyPois } from "@/lib/community-nearby-pois";
import { upsertCommunityFromAmapPoi } from "@/lib/community-ingest";
import { prisma } from "@/lib/prisma";

function isAuthorized(request: Request) {
  const secret = process.env.COMMUNITY_POI_COLLECTOR_SECRET;

  if (!secret && process.env.NODE_ENV !== "production") {
    return true;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeNearby = searchParams.get("nearby") === "true";
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 80)));
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0));
  const key = process.env.AMAP_WEB_SERVICE_KEY;

  if (!canUseLiveAmapApi()) {
    return NextResponse.json(
      { error: "生产环境默认关闭高德采集任务。如需手动采集，请设置 ALLOW_LIVE_AMAP_API=true。" },
      { status: 403 },
    );
  }

  if (!key) {
    return NextResponse.json(
      { error: "AMAP_WEB_SERVICE_KEY is not configured." },
      { status: 500 },
    );
  }

  try {
    const result = await collectAmapCommunityPois({
      key,
      city: "杭州",
      scope: "city",
    });
    const rawPois = result.rawPois.slice(offset, offset + limit);
    let created = 0;
    let updated = 0;

    for (const rawPoi of rawPois) {
      const existing = rawPoi.id
        ? await prisma.communityPoi.findUnique({
            where: { amapId: rawPoi.id },
            select: { id: true },
          })
        : null;

      await upsertCommunityFromAmapPoi(rawPoi);

      if (existing) {
        updated += 1;
      } else {
        created += 1;
      }

      if (includeNearby && rawPoi.id) {
        await collectCommunityNearbyPois({
          propertyId: `amap-${rawPoi.id}`,
        });
      }
    }

    return NextResponse.json({
      city: "杭州",
      available: result.rawPois.length,
      collected: rawPois.length,
      created,
      updated,
      requestCount: result.requestCount,
      nearbyCollected: includeNearby,
      nextOffset: offset + rawPois.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "小区 POI 采集失败。" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const total = await prisma.communityPoi.count();
    const latest = await prisma.communityPoi.findFirst({
      orderBy: { collectedAt: "desc" },
      select: {
        name: true,
        city: true,
        district: true,
        collectedAt: true,
      },
    });

    return NextResponse.json({
      ready: total > 0,
      total,
      latest,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "数据库检查失败。" },
      { status: 500 },
    );
  }
}
