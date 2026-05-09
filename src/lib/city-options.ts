export type SupportedCity = "杭州" | "上海" | "苏州" | "南京";

export type CityOption = {
  name: SupportedCity;
  center: [number, number];
  searchCenters: [number, number][];
};

export const cityOptions: CityOption[] = [
  {
    name: "杭州",
    center: [120.197, 30.242],
    searchCenters: [
      [120.197, 30.242],
      [120.141, 30.319],
      [120.13, 30.259],
      [120.079, 30.287],
      [120.213, 30.211],
      [120.264, 30.185],
      [120.193, 30.071],
      [119.978, 30.279],
      [120.299, 30.418],
      [120.493, 30.322],
      [119.956, 30.049],
      [119.721, 30.228],
      [119.404, 30.191],
      [119.691, 29.793],
      [119.042, 29.609],
    ],
  },
  {
    name: "上海",
    center: [121.4737, 31.2304],
    searchCenters: [
      [121.4737, 31.2304],
      [121.515, 31.235],
      [121.43, 31.22],
      [121.38, 31.18],
      [121.55, 31.28],
      [121.26, 31.38],
    ],
  },
  {
    name: "苏州",
    center: [120.5853, 31.2989],
    searchCenters: [
      [120.5853, 31.2989],
      [120.62, 31.32],
      [120.68, 31.31],
      [120.74, 31.27],
      [120.56, 31.36],
      [120.48, 31.29],
    ],
  },
  {
    name: "南京",
    center: [118.7969, 32.0603],
    searchCenters: [
      [118.7969, 32.0603],
      [118.78, 32.04],
      [118.85, 32.03],
      [118.72, 32.13],
      [118.9, 32.1],
      [118.68, 31.99],
    ],
  },
];

export const supportedCityNames: SupportedCity[] = ["杭州", "上海", "苏州", "南京"];

export function getCityOption(cityName: string) {
  return cityOptions.find((city) => city.name === cityName) ?? cityOptions[0];
}
