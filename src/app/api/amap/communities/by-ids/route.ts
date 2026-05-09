import { NextResponse } from "next/server";
import { ensureCommunityStored, getCommunityLookupKey } from "@/lib/community-ingest";
import { getCommunityProperty } from "@/lib/community-property";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    ids?: string[];
  };
  const ids = Array.from(new Set((payload.ids ?? []).filter(Boolean))).slice(0, 50);

  if (ids.length === 0) {
    return NextResponse.json({ communities: [] });
  }

  await Promise.allSettled(ids.map((targetId) => ensureCommunityStored(targetId)));

  const settledProperties = await Promise.allSettled(
    ids.map((targetId) => getCommunityProperty(`amap-${getCommunityLookupKey(targetId)}`)),
  );
  const communities = settledProperties
    .filter((result): result is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof getCommunityProperty>>>> =>
      result.status === "fulfilled" && Boolean(result.value),
    )
    .map((result) => result.value);

  return NextResponse.json({
    count: communities.length,
    communities,
  });
}
