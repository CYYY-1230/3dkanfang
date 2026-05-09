CREATE TABLE "CommunityPoi" (
  "id" TEXT NOT NULL,
  "amapId" TEXT,
  "name" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "priceRange" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'amap',
  "raw" JSONB,
  "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunityPoi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityPoi_amapId_key" ON "CommunityPoi"("amapId");
CREATE INDEX "CommunityPoi_city_district_idx" ON "CommunityPoi"("city", "district");
CREATE INDEX "CommunityPoi_longitude_latitude_idx" ON "CommunityPoi"("longitude", "latitude");
