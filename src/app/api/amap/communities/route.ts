import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { collectAmapCommunityPois } from "@/lib/amap-communities";
import { canUseLiveAmapApi } from "@/lib/amap-live-api";
import { applyDerivedDataToProperty } from "@/lib/community-derived-data";
import { getCommunityProperties } from "@/lib/community-property";

const getLiveCommunities = unstable_cache(
  async ({
    city,
    scope,
    longitude,
    latitude,
    radius,
  }: {
    city: string;
    scope: "city" | "around";
    longitude: number;
    latitude: number;
    radius: string;
  }) => {
    const key = process.env.AMAP_WEB_SERVICE_KEY;

    if (!key) {
      throw new Error("AMAP_WEB_SERVICE_KEY is not configured.");
    }

    return collectAmapCommunityPois({
      key,
      city,
      scope,
      longitude,
      latitude,
      radius,
    });
  },
  ["amap-live-communities"],
  {
    revalidate: 300,
    tags: ["amap-live-communities"],
  },
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const longitude = Number(searchParams.get("lng"));
  const latitude = Number(searchParams.get("lat"));
  const radius = searchParams.get("radius") ?? "12000";
  const city = searchParams.get("city") ?? "杭州";
  const scope = searchParams.get("scope") === "city" ? "city" : "around";

  if (scope === "city") {
    try {
      const storedCommunities = await getCommunityProperties(city);

      if (storedCommunities.length > 0 || process.env.NODE_ENV === "production") {
        return NextResponse.json({
          count: storedCommunities.length,
          communities: storedCommunities,
          source: "cached-communities",
        });
      }
    } catch {
      // If the database is not configured yet, keep the map usable with live AMap data.
    }
  }

  if (!canUseLiveAmapApi()) {
    return NextResponse.json({
      count: 0,
      communities: [],
      source: "database-only",
    });
  }

  try {
    const result = await getLiveCommunities({
      city,
      scope,
      longitude,
      latitude,
      radius,
    });

    return NextResponse.json({
      count: result.communities.length,
      communities: result.communities.map(applyDerivedDataToProperty),
      source: "amap-live",
      requestCount: result.requestCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "小区 POI 查询失败。" },
      { status: 502 },
    );
  }
}
