import { NextResponse } from "next/server";
import { ensureCommunityStored } from "@/lib/community-ingest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const favoriteTargetTypes = ["property", "floorPlan"] as const;
type FavoriteTargetType = (typeof favoriteTargetTypes)[number];

function isFavoriteTargetType(value: string): value is FavoriteTargetType {
  return favoriteTargetTypes.includes(value as FavoriteTargetType);
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ user: null, favorites: [] });
  }

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      targetType: true,
      targetId: true,
    },
  });

  return NextResponse.json({ user, favorites });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "请先登录后再收藏。" }, { status: 401 });
  }

  const payload = (await request.json()) as {
    targetType?: string;
    targetId?: string;
    favorite?: boolean;
  };
  const targetType = payload.targetType ?? "";
  const targetId = payload.targetId ?? "";

  if (!isFavoriteTargetType(targetType) || !targetId) {
    return NextResponse.json({ error: "收藏目标无效。" }, { status: 400 });
  }

  const existing = await prisma.favorite.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: user.id,
        targetType,
        targetId,
      },
    },
  });

  const shouldFavorite = payload.favorite ?? !existing;

  if (shouldFavorite && targetType === "property") {
    await ensureCommunityStored(targetId);
  }

  if (shouldFavorite && !existing) {
    await prisma.favorite.create({
      data: {
        userId: user.id,
        targetType,
        targetId,
      },
    });
  }

  if (!shouldFavorite && existing) {
    await prisma.favorite.delete({
      where: { id: existing.id },
    });
  }

  return NextResponse.json({
    targetType,
    targetId,
    isFavorite: shouldFavorite,
  });
}
