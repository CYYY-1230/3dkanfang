import { notFound } from "next/navigation";
import { getCommunityFloorPlan } from "@/lib/community-property";
import { getFloorPlan } from "@/lib/data";
import { panoramaStyles } from "@/lib/panorama-styles";
import { hasPanoramaAssets, withPanoramaViewerAssets } from "@/lib/vr-viewing-data";
import { ViewerClient } from "./viewer-client";

export default async function ViewerPage({
  params,
}: {
  params: Promise<{ floorPlanId: string }>;
}) {
  const { floorPlanId } = await params;
  const staticResult = getFloorPlan(floorPlanId);
  const result = staticResult ?? (await getCommunityFloorPlan(floorPlanId));

  if (!result) {
    notFound();
  }

  const floorPlan = hasPanoramaAssets(result.floorPlan)
    ? result.floorPlan
    : withPanoramaViewerAssets(result.floorPlan);

  return (
    <ViewerClient
      property={result.property}
      floorPlan={floorPlan}
      styles={panoramaStyles}
    />
  );
}
