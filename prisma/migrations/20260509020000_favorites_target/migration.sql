CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "Favorite" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

ALTER TABLE IF EXISTS "Favorite" DROP CONSTRAINT IF EXISTS "Favorite_floorPlanId_fkey";
DROP INDEX IF EXISTS "Favorite_userId_floorPlanId_key";

ALTER TABLE IF EXISTS "Favorite"
ADD COLUMN IF NOT EXISTS "targetType" TEXT,
ADD COLUMN IF NOT EXISTS "targetId" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Favorite'
      AND column_name = 'floorPlanId'
  ) THEN
    UPDATE "Favorite"
    SET "targetType" = 'floorPlan',
        "targetId" = "floorPlanId"
    WHERE "targetType" IS NULL
      AND "targetId" IS NULL
      AND "floorPlanId" IS NOT NULL;
  END IF;
END $$;

DELETE FROM "Favorite"
WHERE "targetType" IS NULL
   OR "targetId" IS NULL;

ALTER TABLE "Favorite"
ALTER COLUMN "targetType" SET NOT NULL,
ALTER COLUMN "targetId" SET NOT NULL;

ALTER TABLE IF EXISTS "Favorite" DROP COLUMN IF EXISTS "floorPlanId";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Favorite_userId_fkey'
  ) THEN
    ALTER TABLE "Favorite"
    ADD CONSTRAINT "Favorite_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Favorite_userId_targetType_targetId_key" ON "Favorite"("userId", "targetType", "targetId");
CREATE INDEX IF NOT EXISTS "Favorite_targetType_targetId_idx" ON "Favorite"("targetType", "targetId");
