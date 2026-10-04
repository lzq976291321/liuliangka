import data from "@/data/china-regions.json";

export type CityRegion = { code: string; name: string };
export type ProvinceRegion = { code: string; name: string; value: string; cities: CityRegion[] };
export const regionDataSource = data.source;
export const provinceRegions: ProvinceRegion[] = data.provinces;
export const provinceOptions = provinceRegions.map((province) => province.value);

const legacyCities: Record<string, string> = {
  shenzhen: "深圳市", guangzhou: "广州市", dongguan: "东莞市", beijing: "北京市", tianjin: "天津市", chongqing: "重庆市", weifang: "潍坊市"
};

export const cityRegionAliases = provinceRegions.flatMap((province) => province.cities.flatMap((city) => {
  const names = new Set([city.name, city.name.replace(/市$/, "")]);
  return [...names].map((alias) => ({ alias, city: city.name, province: province.value, code: city.code }));
})).sort((a, b) => b.alias.length - a.alias.length);

export function findProvinceRegion(value?: string) {
  const input = value?.trim();
  return provinceRegions.find((province) => input === province.name || input === province.value);
}

export function findCityRegion(value?: string, province?: string) {
  if (!value?.trim()) return undefined;
  const input = legacyCities[value.trim()] ?? value.trim();
  const expectedProvince = province ? findProvinceRegion(province) : undefined;
  if (province && !expectedProvince) return undefined;
  const direct = cityRegionAliases.filter((region) => region.alias === input && (!expectedProvince || region.province === expectedProvince.value));
  if (direct.length === 1) return direct[0];
  // Old URLs may have a combined "广东省深圳市" value. Only accept a complete known name.
  const combined = cityRegionAliases.filter((region) => {
    if (expectedProvince && region.province !== expectedProvince.value) return false;
    const parent = findProvinceRegion(region.province)!;
    return input === `${parent.name}${region.alias}` || input === `${parent.value}${region.alias}`;
  });
  return combined.length === 1 ? combined[0] : undefined;
}

export function getCityOptions(province?: string): CityRegion[] {
  return findProvinceRegion(province)?.cities ?? [];
}
