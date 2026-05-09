export type Poi = {
  id: string;
  name: string;
  category: "交通" | "教育" | "商业" | "医疗" | "公园";
  distance: string;
};

export type ViewingAsset = {
  id: string;
  roomId: string;
  styleId: string;
  styleName?: string;
  type: "room-image" | "panorama-placeholder" | "panorama-whitebox" | "panorama-style";
  imageUrl: string;
  prompt: string;
  status?: string;
  qcStatus?: string;
  qcError?: string;
};

export type Room = {
  id: string;
  floorPlanId: string;
  name: string;
  type:
    | "living"
    | "bedroom"
    | "kitchen"
    | "bathroom"
    | "balcony"
    | "study"
    | "dining"
    | "storage"
    | "entry"
    | "corridor";
  sortOrder?: number;
  defaultYaw?: number;
  adjacent?: string[];
  hotspots?: Array<{
    target: string;
    label: string;
    yaw: number;
    pitch?: number;
  }>;
  assets: ViewingAsset[];
};

export type DesignStyle = {
  id: string;
  name: string;
  description: string;
};

export type FloorPlan = {
  id: string;
  propertyId: string;
  name: string;
  area: number;
  layout: string;
  orientation: string;
  bathrooms: number;
  balcony: boolean;
  totalPrice?: number;
  tags?: string[];
  highlights: string[];
  imageUrl: string;
  rooms: Room[];
};

export type Property = {
  id: string;
  name: string;
  city: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  priceRange: string;
  summary: string;
  coverImage: string;
  tags: string[];
  floorPlanTags?: string[];
  locationTags?: string[];
  priceTags?: string[];
  minTotalPrice?: number;
  maxTotalPrice?: number;
  pois: Poi[];
  floorPlans: FloorPlan[];
};

export type GenerationJob = {
  id: string;
  targetType: "floor-plan" | "room-render" | "panorama";
  targetId: string;
  prompt: string;
  status: "待生成" | "已完成" | "失败";
  resultUrl?: string;
};
