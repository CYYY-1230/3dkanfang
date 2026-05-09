"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { type FavoriteTarget, useFavorites } from "@/components/favorites-provider";
import type { Property } from "@/lib/types";

export function FavoriteButton({
  floorPlanId,
  propertyId,
  propertySnapshot,
  compact = false,
}: {
  floorPlanId?: string;
  propertyId?: string;
  propertySnapshot?: Property;
  compact?: boolean;
}) {
  const target: FavoriteTarget = propertyId ? "property" : "floorPlan";
  const favoriteId = propertyId ?? floorPlanId;
  const targetLabel = target === "property" ? "小区" : "户型";
  const { isLoaded, isFavorite, toggleFavorite } = useFavorites();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const active = favoriteId ? isFavorite(target, favoriteId) : false;

  async function onToggleFavorite() {
    if (!favoriteId || isSubmitting || !isLoaded) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      await toggleFavorite(target, favoriteId, { propertySnapshot });
    } catch (error) {
      if (error instanceof Error && error.message === "AUTH_REQUIRED") {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      setMessage(error instanceof Error ? error.message : "收藏失败，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={onToggleFavorite}
        disabled={isSubmitting || !isLoaded}
        className={`focus-ring inline-flex items-center justify-center gap-2 border text-sm font-bold shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? "h-12 min-w-14 rounded-xl px-3" : "rounded-lg px-4 py-2"
        } ${
          active
            ? "border-[#d8b27c] bg-[#f6ebd8] text-[#8a5313]"
            : "border-ink/10 bg-white/88 text-ink hover:border-[#d8b27c] hover:bg-[#fffbf4] hover:text-[#8a5313]"
        }`}
        aria-label={active ? `取消收藏${targetLabel}` : `收藏${targetLabel}`}
        title={message || undefined}
      >
        <Heart
          size={compact ? 23 : 18}
          strokeWidth={compact ? 2.3 : 2}
          fill={active ? "currentColor" : "none"}
        />
        {compact ? null : <span>{active ? "已收藏" : "收藏"}</span>}
      </button>
      {message && !compact ? (
        <span className="absolute left-0 top-full mt-2 whitespace-nowrap rounded-md bg-[#9b2c2c] px-2 py-1 text-xs font-bold text-white shadow-soft">
          {message}
        </span>
      ) : null}
    </span>
  );
}

export function useFavoriteIds() {
  return useFavorites().favoriteIds;
}

export function usePropertyFavoriteIds() {
  return useFavorites().propertyFavoriteIds;
}
