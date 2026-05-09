ALTER TABLE "CommunityPoi"
ADD COLUMN "floorPlanTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "locationTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "priceTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "minTotalPrice" INTEGER,
ADD COLUMN "maxTotalPrice" INTEGER;

CREATE TABLE "CommunityFloorPlan" (
  "id" TEXT NOT NULL,
  "communityPoiId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "area" INTEGER NOT NULL,
  "layout" TEXT NOT NULL,
  "orientation" TEXT NOT NULL,
  "bathrooms" INTEGER NOT NULL,
  "balcony" BOOLEAN NOT NULL,
  "totalPrice" INTEGER NOT NULL,
  "tags" TEXT[] NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunityFloorPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunityPoi_minTotalPrice_maxTotalPrice_idx" ON "CommunityPoi"("minTotalPrice", "maxTotalPrice");
CREATE INDEX "CommunityFloorPlan_communityPoiId_idx" ON "CommunityFloorPlan"("communityPoiId");
CREATE INDEX "CommunityFloorPlan_totalPrice_idx" ON "CommunityFloorPlan"("totalPrice");

ALTER TABLE "CommunityFloorPlan"
ADD CONSTRAINT "CommunityFloorPlan_communityPoiId_fkey"
FOREIGN KEY ("communityPoiId") REFERENCES "CommunityPoi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
