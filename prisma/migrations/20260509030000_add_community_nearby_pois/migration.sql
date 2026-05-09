CREATE TABLE "CommunityNearbyPoi" (
  "id" TEXT NOT NULL,
  "communityPoiId" TEXT NOT NULL,
  "amapId" TEXT,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "type" TEXT,
  "typecode" TEXT,
  "address" TEXT NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "distance" INTEGER NOT NULL,
  "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunityNearbyPoi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityNearbyPoi_communityPoiId_amapId_category_key"
ON "CommunityNearbyPoi"("communityPoiId", "amapId", "category");

CREATE INDEX "CommunityNearbyPoi_communityPoiId_category_idx"
ON "CommunityNearbyPoi"("communityPoiId", "category");

ALTER TABLE "CommunityNearbyPoi"
ADD CONSTRAINT "CommunityNearbyPoi_communityPoiId_fkey"
FOREIGN KEY ("communityPoiId") REFERENCES "CommunityPoi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
