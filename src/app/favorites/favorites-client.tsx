"use client";

import Link from "next/link";
import { Building2, Heart, Map, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/app-shell";
import { FloorPlanCard } from "@/components/floor-plan-card";
import { FavoriteButton, useFavoriteIds, usePropertyFavoriteIds } from "@/components/favorite-button";
import { useFavorites } from "@/components/favorites-provider";
import { communityCoverImage } from "@/lib/community-cover";
import type { Property } from "@/lib/types";

function createMissingFavoriteProperty(propertyId: string): Property {
  return {
    id: propertyId,
    name: "已收藏小区",
    city: "杭州",
    district: "资料同步中",
    address: "这个小区已收藏成功，高德详情暂时没有返回完整资料。",
    latitude: 30.2741,
    longitude: 120.1551,
    priceRange: "资料同步中",
    summary: "收藏记录已保存到账号，系统正在等待小区详情资料同步。",
    coverImage: communityCoverImage,
    tags: ["已收藏", "资料同步中"],
    pois: [],
    floorPlans: [],
  };
}

export function FavoritesClient({ properties }: { properties: Property[] }) {
  const { propertySnapshots } = useFavorites();
  const [allProperties, setAllProperties] = useState(properties);
  const [isLoadingMissingProperties, setIsLoadingMissingProperties] = useState(false);
  const favoriteIds = useFavoriteIds();
  const propertyFavoriteIds = usePropertyFavoriteIds();
  const propertyIds = useMemo(
    () => new Set(allProperties.map((property) => property.id)),
    [allProperties],
  );
  const missingPropertyFavoriteIds = useMemo(
    () => propertyFavoriteIds.filter((propertyId) => !propertyIds.has(propertyId)),
    [propertyFavoriteIds, propertyIds],
  );
  const missingPropertyFavoriteKey = missingPropertyFavoriteIds.join("|");
  const favoriteProperties = allProperties.filter((property) =>
    propertyFavoriteIds.includes(property.id),
  );
  const favoritePlans = allProperties.flatMap((property) =>
    property.floorPlans.filter((floorPlan) => favoriteIds.includes(floorPlan.id)),
  );

  useEffect(() => {
    if (propertySnapshots.length === 0) {
      return;
    }

    setAllProperties((currentProperties) => {
      const currentIds = new Set(currentProperties.map((property) => property.id));
      const nextProperties = [...currentProperties];

      for (const property of propertySnapshots) {
        if (!currentIds.has(property.id)) {
          currentIds.add(property.id);
          nextProperties.push(property);
        }
      }

      return nextProperties.length === currentProperties.length ? currentProperties : nextProperties;
    });
  }, [propertySnapshots]);

  useEffect(() => {
    if (missingPropertyFavoriteIds.length === 0 || isLoadingMissingProperties) {
      return;
    }

    let ignore = false;

    async function loadLatestCommunities() {
      setIsLoadingMissingProperties(true);

      try {
        const response = await fetch("/api/amap/communities/by-ids", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: missingPropertyFavoriteIds }),
        });
        const payload = (await response.json()) as {
          communities?: Property[];
        };

        if (!ignore && payload.communities) {
          setAllProperties((currentProperties) => {
            const currentIds = new Set(currentProperties.map((property) => property.id));
            const nextProperties = [...currentProperties];

            for (const property of payload.communities ?? []) {
              if (!currentIds.has(property.id)) {
                currentIds.add(property.id);
                nextProperties.push(property);
              }
            }

            for (const propertyId of missingPropertyFavoriteIds) {
              if (!currentIds.has(propertyId)) {
                currentIds.add(propertyId);
                nextProperties.push(createMissingFavoriteProperty(propertyId));
              }
            }

            return nextProperties.length === currentProperties.length
              ? currentProperties
              : nextProperties;
          });
        }
      } finally {
        if (!ignore) {
          setIsLoadingMissingProperties(false);
        }
      }
    }

    loadLatestCommunities();

    return () => {
      ignore = true;
    };
  }, [
    isLoadingMissingProperties,
    missingPropertyFavoriteIds,
    missingPropertyFavoriteIds.length,
    missingPropertyFavoriteKey,
  ]);

  if (favoriteProperties.length === 0 && favoritePlans.length === 0) {
    return (
      <EmptyState
        icon={<Heart size={22} />}
        title="还没有收藏"
        description="先去地图页看看小区，遇到喜欢的小区或户型点一下收藏，之后就会出现在这里。"
        action={
          <Link
            href="/"
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2 text-sm font-bold text-pearl"
          >
            <Map size={16} />
            去地图找房
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      {missingPropertyFavoriteIds.length > 0 ? (
        <div className="rounded-xl border border-ink/10 bg-white/78 px-4 py-3 text-sm font-bold text-ink/62 shadow-soft">
          正在同步刚收藏的小区资料...
        </div>
      ) : null}

      {favoriteProperties.length > 0 ? (
        <section>
          <h2 className="mb-4 text-2xl font-bold text-ink">收藏的小区</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {favoriteProperties.map((property) => (
              <article
                key={property.id}
                className="rounded-xl border border-ink/10 bg-white/78 p-5 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1 text-sm font-bold text-jade">
                      <MapPin size={15} />
                      {property.city} · {property.district}
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-ink">{property.name}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/62">
                      {property.address}
                    </p>
                  </div>
                  <FavoriteButton propertyId={property.id} propertySnapshot={property} compact />
                </div>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-ink/8 pt-4">
                  <span className="text-sm font-bold text-ink">{property.priceRange}</span>
                  <Link
                    href={`/properties/${property.id}`}
                    className="focus-ring inline-flex items-center gap-2 rounded-lg bg-jade px-4 py-2 text-sm font-bold text-white transition hover:bg-moss"
                  >
                    <Building2 size={16} />
                    查看小区
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {favoritePlans.length > 0 ? (
        <section>
          <h2 className="mb-4 text-2xl font-bold text-ink">收藏的户型</h2>
          <div className="space-y-4">
            {favoritePlans.map((floorPlan) => (
              <FloorPlanCard key={floorPlan.id} floorPlan={floorPlan} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
