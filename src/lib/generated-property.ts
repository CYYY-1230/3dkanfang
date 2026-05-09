import type { Property } from "@/lib/types";

type CommunitySeed = {
  id?: string;
  name?: string;
  city?: string;
  district?: string;
  address?: string;
  longitude: number;
  latitude: number;
  distance?: number;
};

function hashText(text: string) {
  return Array.from(text).reduce((total, char) => total + char.charCodeAt(0), 0);
}

function getCityBasePrice(city = "") {
  if (city.includes("上海")) {
    return 680;
  }
  if (city.includes("杭州")) {
    return 430;
  }
  if (city.includes("苏州")) {
    return 300;
  }
  return 260;
}

function getDistrictBoost(district = "") {
  if (/浦东|滨江|西湖|园区|工业园|张江|钱江|黄浦|徐汇/.test(district)) {
    return 1.22;
  }
  if (/萧山|余杭|吴中|相城|嘉定|宝山|闵行/.test(district)) {
    return 0.92;
  }
  return 1;
}

function inferAudience(seed: CommunitySeed) {
  const text = `${seed.city ?? ""}${seed.district ?? ""}${seed.address ?? ""}${seed.name ?? ""}`;

  if (/产业|科技|软件|园区|张江|滨江/.test(text)) {
    return "适合看重通勤效率和产业配套的年轻家庭或科技从业者。";
  }
  if (/湖|江|湾|公园|绿地|森林/.test(text)) {
    return "适合重视景观、散步半径和日常松弛感的改善家庭。";
  }
  if (/学校|学府|实验|文教|大学/.test(text)) {
    return "适合关注教育氛围和稳定居住半径的家庭型用户。";
  }
  return "适合想先了解板块氛围、预算梯度和生活便利度的普通买房用户。";
}

export function createGeneratedProperty(seed: CommunitySeed): Property {
  const name = seed.name?.trim() || "未命名小区";
  const city = seed.city?.trim() || "示例城市";
  const district = seed.district?.trim() || "示例区域";
  const hash = hashText(`${name}${city}${district}`);
  const base = getCityBasePrice(city) * getDistrictBoost(district);
  const lowTotal = Math.round((base * (0.78 + (hash % 9) / 100)) / 10) * 10;
  const highTotal = lowTotal + 120 + (hash % 5) * 40;
  const unitLow = (lowTotal / 95).toFixed(1);
  const unitHigh = (highTotal / 105).toFixed(1);
  const distanceText = seed.distance ? `距离当前选中楼盘约 ${Math.round(seed.distance)}m` : "位于当前地图浏览范围内";

  return {
    id: `amap-${seed.id ?? `${seed.longitude}-${seed.latitude}`}`,
    name,
    city,
    district,
    address: seed.address?.trim() || `${city}${district}`,
    latitude: seed.latitude,
    longitude: seed.longitude,
    priceRange: `${lowTotal}-${highTotal} 万`,
    summary: `${distanceText}。${inferAudience(seed)}价格、户型和成交信息为 AI 估算示意，用于演示产品效果。`,
    coverImage: "/assets/property-city.svg",
    tags: [
      "高德POI",
      "AI示意资料",
      `示意均价 ${unitLow}-${unitHigh} 万/㎡`,
      `示意成交 ${lowTotal}-${highTotal} 万`,
    ],
    pois: [],
    floorPlans: [],
  };
}
