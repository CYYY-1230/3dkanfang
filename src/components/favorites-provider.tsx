"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Property } from "@/lib/types";

export type FavoriteTarget = "floorPlan" | "property";

type FavoriteRecord = {
  targetType: FavoriteTarget;
  targetId: string;
};

type FavoriteUser = {
  id: string;
  email: string;
  name: string | null;
};

type FavoritesPayload = {
  user: FavoriteUser | null;
  favorites: FavoriteRecord[];
};

type FavoriteSets = {
  floorPlan: Set<string>;
  property: Set<string>;
};

type FavoritesContextValue = {
  user: FavoriteUser | null;
  isLoaded: boolean;
  propertySnapshots: Property[];
  isFavorite: (targetType: FavoriteTarget, targetId: string) => boolean;
  favoriteIds: string[];
  propertyFavoriteIds: string[];
  refreshFavorites: () => Promise<void>;
  clearFavorites: () => void;
  toggleFavorite: (
    targetType: FavoriteTarget,
    targetId: string,
    options?: { propertySnapshot?: Property },
  ) => Promise<boolean>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);
const propertySnapshotsStorageKey = "3d-house-viewer-property-snapshots";

let favoriteCache: FavoritesPayload | null = null;
let favoriteRequest: Promise<FavoritesPayload> | null = null;

function emptySets(): FavoriteSets {
  return {
    floorPlan: new Set<string>(),
    property: new Set<string>(),
  };
}

function toFavoriteSets(favorites: FavoriteRecord[]): FavoriteSets {
  const sets = emptySets();

  for (const favorite of favorites) {
    sets[favorite.targetType]?.add(favorite.targetId);
  }

  return sets;
}

function updateSet(
  currentSets: FavoriteSets,
  targetType: FavoriteTarget,
  targetId: string,
  favorite: boolean,
) {
  const nextSets = {
    floorPlan: new Set(currentSets.floorPlan),
    property: new Set(currentSets.property),
  };

  if (favorite) {
    nextSets[targetType].add(targetId);
  } else {
    nextSets[targetType].delete(targetId);
  }

  return nextSets;
}

async function loadFavorites(options?: { force?: boolean }) {
  if (favoriteCache && !options?.force) {
    return favoriteCache;
  }

  if (favoriteRequest) {
    return favoriteRequest;
  }

  favoriteRequest = fetch("/api/favorites", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("收藏状态读取失败。");
      }

      return (await response.json()) as FavoritesPayload;
    })
    .then((payload) => {
      favoriteCache = payload;
      return payload;
    })
    .finally(() => {
      favoriteRequest = null;
    });

  return favoriteRequest;
}

function setFavoriteCacheFromState(user: FavoriteUser | null, sets: FavoriteSets) {
  favoriteCache = {
    user,
    favorites: [
      ...Array.from(sets.property).map((targetId) => ({
        targetType: "property" as const,
        targetId,
      })),
      ...Array.from(sets.floorPlan).map((targetId) => ({
        targetType: "floorPlan" as const,
        targetId,
      })),
    ],
  };
}

function readPropertySnapshots() {
  if (typeof window === "undefined") {
    return new Map<string, Property>();
  }

  try {
    const rawValue = window.sessionStorage.getItem(propertySnapshotsStorageKey);
    const snapshots = rawValue ? (JSON.parse(rawValue) as Property[]) : [];
    return new Map(snapshots.map((property) => [property.id, property]));
  } catch {
    return new Map<string, Property>();
  }
}

function writePropertySnapshots(snapshots: Map<string, Property>) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    propertySnapshotsStorageKey,
    JSON.stringify(Array.from(snapshots.values())),
  );
}

export function FavoriteProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FavoriteUser | null>(null);
  const [sets, setSets] = useState<FavoriteSets>(() => emptySets());
  const [propertySnapshots, setPropertySnapshots] = useState<Map<string, Property>>(
    () => new Map(),
  );
  const [isLoaded, setIsLoaded] = useState(false);

  const applyPayload = useCallback((payload: FavoritesPayload) => {
    favoriteCache = payload;
    setUser(payload.user);
    setSets(toFavoriteSets(payload.favorites));
    setIsLoaded(true);
  }, []);

  const refreshFavorites = useCallback(async () => {
    const payload = await loadFavorites({ force: true });
    applyPayload(payload);
  }, [applyPayload]);

  const clearFavorites = useCallback(() => {
    favoriteCache = null;
    favoriteRequest = null;
    setUser(null);
    setSets(emptySets());
    setPropertySnapshots(new Map());
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(propertySnapshotsStorageKey);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    let ignore = false;

    loadFavorites()
      .then((payload) => {
        if (!ignore) {
          applyPayload(payload);
        }
      })
      .catch(() => {
        if (!ignore) {
          setIsLoaded(true);
        }
      });

    return () => {
      ignore = true;
    };
  }, [applyPayload]);

  useEffect(() => {
    setPropertySnapshots(readPropertySnapshots());
  }, []);

  const isFavorite = useCallback(
    (targetType: FavoriteTarget, targetId: string) => sets[targetType].has(targetId),
    [sets],
  );

  const toggleFavorite = useCallback(
    async (
      targetType: FavoriteTarget,
      targetId: string,
      options?: { propertySnapshot?: Property },
    ) => {
      if (!user) {
        throw new Error("AUTH_REQUIRED");
      }

      const nextFavorite = !sets[targetType].has(targetId);
      const previousSets = sets;
      const optimisticSets = updateSet(sets, targetType, targetId, nextFavorite);
      setSets(optimisticSets);
      setFavoriteCacheFromState(user, optimisticSets);
      const previousSnapshots = propertySnapshots;

      if (targetType === "property" && nextFavorite && options?.propertySnapshot) {
        const nextSnapshots = new Map(propertySnapshots);
        nextSnapshots.set(targetId, options.propertySnapshot);
        setPropertySnapshots(nextSnapshots);
        writePropertySnapshots(nextSnapshots);
      }

      try {
        const response = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType,
            targetId,
            favorite: nextFavorite,
          }),
        });

        if (response.status === 401) {
          setUser(null);
          setSets(emptySets());
          favoriteCache = { user: null, favorites: [] };
          throw new Error("AUTH_REQUIRED");
        }

        const payload = (await response.json()) as {
          targetType?: FavoriteTarget;
          targetId?: string;
          isFavorite?: boolean;
          error?: string;
        };

        if (!response.ok || payload.error) {
          throw new Error(payload.error ?? "收藏失败，请稍后再试。");
        }

        const confirmedFavorite = Boolean(payload.isFavorite);
        setSets((currentSets) =>
          updateSet(currentSets, targetType, targetId, confirmedFavorite),
        );
        setFavoriteCacheFromState(
          user,
          updateSet(optimisticSets, targetType, targetId, confirmedFavorite),
        );

        return confirmedFavorite;
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "AUTH_REQUIRED") {
          setSets(previousSets);
          setFavoriteCacheFromState(user, previousSets);
          setPropertySnapshots(previousSnapshots);
          writePropertySnapshots(previousSnapshots);
        }
        throw error;
      }
    },
    [propertySnapshots, sets, user],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({
      user,
      isLoaded,
      propertySnapshots: Array.from(propertySnapshots.values()),
      isFavorite,
      favoriteIds: Array.from(sets.floorPlan),
      propertyFavoriteIds: Array.from(sets.property),
      refreshFavorites,
      clearFavorites,
      toggleFavorite,
    }),
    [
      clearFavorites,
      isFavorite,
      isLoaded,
      propertySnapshots,
      refreshFavorites,
      sets,
      toggleFavorite,
      user,
    ],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);

  if (!context) {
    throw new Error("useFavorites must be used within FavoriteProvider.");
  }

  return context;
}
