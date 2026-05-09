import { NextResponse } from "next/server";
import { canUseLiveAmapApi } from "@/lib/amap-live-api";
import { poiCategories, type PoiCategoryId } from "@/lib/amap-poi";
import { fetchAmapNearbyPois } from "@/lib/amap-nearby-pois";
import { getCommunityNearbyPois } from "@/lib/community-nearby-pois";

const DEFAULT_RADIUS = "1500";

function isPoiCategoryId(categoryId: string): categoryId is PoiCategoryId {
  return poiCategories.some((category) => category.id === categoryId);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const longitude = Number(searchParams.get("lng"));
  const latitude = Number(searchParams.get("lat"));
  const propertyId = searchParams.get("propertyId") ?? "";
  const requestedCategoryId = searchParams.get("category") ?? poiCategories[0].id;
  const categoryId = isPoiCategoryId(requestedCategoryId)
    ? requestedCategoryId
    : poiCategories[0].id;
  const radius = searchParams.get("radius") ?? DEFAULT_RADIUS;

  if (propertyId) {
    const pois = await getCommunityNearbyPois({ propertyId, categoryId });

    return NextResponse.json({
      category: poiCategories.find((category) => category.id === categoryId)?.label ?? categoryId,
      count: pois.length,
      pois: pois.map((poi) => ({
        id: poi.amapId ?? poi.id,
        name: poi.name,
        category: poi.category,
        address: poi.address,
        longitude: poi.longitude,
        latitude: poi.latitude,
        distance: poi.distance,
      })),
      source: "database",
    });
  }

  if (!canUseLiveAmapApi()) {
    return NextResponse.json(
      { error: "生产环境已关闭实时高德周边查询，请使用已入库小区的 propertyId 查询。" },
      { status: 403 },
    );
  }

  const key = process.env.AMAP_WEB_SERVICE_KEY;

  if (!key) {
    return NextResponse.json(
      { error: "AMAP_WEB_SERVICE_KEY is not configured." },
      { status: 500 },
    );
  }

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return NextResponse.json(
      { error: "lng and lat query parameters are required." },
      { status: 400 },
    );
  }

  try {
    const pois = await fetchAmapNearbyPois({
      key,
      longitude,
      latitude,
      categoryId,
      radius,
    });

    return NextResponse.json({
      category: pois[0]?.category ?? categoryId,
      count: pois.length,
      pois,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AMap POI 查询失败。" },
      { status: 502 },
    );
  }
}
