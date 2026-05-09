import { notFound } from "next/navigation";
import { getCommunityFloorPlan } from "@/lib/community-property";
import { designStyles, getFloorPlan } from "@/lib/data";
import { panoramaStyles } from "@/lib/panorama-styles";
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

  return (
    <ViewerClient
      property={result.property}
      floorPlan={result.floorPlan}
      styles={staticResult ? designStyles : panoramaStyles}
    />
  );
}
