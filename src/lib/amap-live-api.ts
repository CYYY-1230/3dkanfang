export function canUseLiveAmapApi() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_LIVE_AMAP_API === "true";
}
