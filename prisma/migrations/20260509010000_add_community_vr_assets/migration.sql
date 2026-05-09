CREATE TABLE "CommunityFloorPlanRoom" (
  "id" TEXT NOT NULL,
  "communityFloorPlanId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "defaultYaw" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "adjacent" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "hotspots" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunityFloorPlanRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityRoomAsset" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "styleId" TEXT NOT NULL,
  "styleName" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "qcStatus" TEXT NOT NULL DEFAULT 'pending',
  "qcError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunityRoomAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunityFloorPlanRoom_communityFloorPlanId_idx" ON "CommunityFloorPlanRoom"("communityFloorPlanId");
CREATE INDEX "CommunityRoomAsset_roomId_idx" ON "CommunityRoomAsset"("roomId");
CREATE INDEX "CommunityRoomAsset_styleId_idx" ON "CommunityRoomAsset"("styleId");
CREATE UNIQUE INDEX "CommunityRoomAsset_roomId_styleId_key" ON "CommunityRoomAsset"("roomId", "styleId");

ALTER TABLE "CommunityFloorPlanRoom"
ADD CONSTRAINT "CommunityFloorPlanRoom_communityFloorPlanId_fkey"
FOREIGN KEY ("communityFloorPlanId") REFERENCES "CommunityFloorPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityRoomAsset"
ADD CONSTRAINT "CommunityRoomAsset_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "CommunityFloorPlanRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
