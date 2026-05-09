export const poiCategories = [
  {
    id: "transit",
    label: "交通",
    keywords: "地铁|公交",
    types: "150500|150700",
  },
  {
    id: "education",
    label: "教育",
    keywords: "学校|幼儿园",
    types: "141200|141201|141202|141203",
  },
  {
    id: "shopping",
    label: "商业",
    keywords: "商场|超市",
    types: "060100|060400",
  },
  {
    id: "medical",
    label: "医疗",
    keywords: "医院|诊所",
    types: "090100|090200",
  },
  {
    id: "park",
    label: "公园",
    keywords: "公园|景点",
    types: "110100|110200",
  },
] as const;

export type PoiCategoryId = (typeof poiCategories)[number]["id"];

export function getPoiCategory(categoryId: string) {
  return poiCategories.find((category) => category.id === categoryId) ?? poiCategories[0];
}
