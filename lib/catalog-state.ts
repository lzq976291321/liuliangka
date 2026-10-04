export const catalogStateKey = "liuliangka.catalog.v1";
export const initialVisibleCount = 12;
export const visibleCountStep = 24;

export type CatalogState = {
  keyword: string;
  operator: "全部" | "移动" | "联通" | "电信" | "广电";
  area: string;
  priceBand: "all" | "lte19" | "20-29" | "30-39" | "40-59" | "gte60";
  dataBand: "all" | "lte100" | "100-199" | "gte200";
  term: "all" | "long" | "short";
  onlyConfirmed: boolean;
  comparisonIds: number[];
  visibleCount: number;
  scrollY: number;
  filterVisible: boolean;
};

export const defaultCatalogState: CatalogState = {
  keyword: "", operator: "全部", area: "全部", priceBand: "all", dataBand: "all", term: "all",
  onlyConfirmed: false, comparisonIds: [], visibleCount: initialVisibleCount, scrollY: 0, filterVisible: true
};

function choice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return choices.includes(value as T) ? value as T : fallback;
}

export function parseCatalogState(raw: unknown): CatalogState {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    keyword: typeof value.keyword === "string" ? value.keyword.slice(0, 200) : "",
    operator: choice(value.operator, ["全部", "移动", "联通", "电信", "广电"], "全部"),
    area: typeof value.area === "string" && value.area.length <= 40 ? value.area : "全部",
    priceBand: choice(value.priceBand, ["all", "lte19", "20-29", "30-39", "40-59", "gte60"], "all"),
    dataBand: choice(value.dataBand, ["all", "lte100", "100-199", "gte200"], "all"),
    term: choice(value.term, ["all", "long", "short"], "all"),
    onlyConfirmed: value.onlyConfirmed === true,
    comparisonIds: Array.isArray(value.comparisonIds) ? [...new Set(value.comparisonIds.filter((id): id is number => Number.isSafeInteger(id) && id > 0))].slice(0, 3) : [],
    visibleCount: typeof value.visibleCount === "number" && Number.isFinite(value.visibleCount) ? Math.max(initialVisibleCount, Math.min(5000, Math.floor(value.visibleCount))) : initialVisibleCount,
    scrollY: typeof value.scrollY === "number" && Number.isFinite(value.scrollY) ? Math.max(0, Math.min(1_000_000, value.scrollY)) : 0,
    filterVisible: typeof value.filterVisible === "boolean" ? value.filterVisible : !(typeof value.scrollY === "number" && value.scrollY > 18)
  };
}

const filterKeys = ["q", "operator", "area", "price", "data", "term", "confirmed", "compare"];

export function restoreCatalogState(search: string, stored: unknown): CatalogState {
  const previous = parseCatalogState(stored);
  const query = new URLSearchParams(search);
  if (!query.has("catalog") && !filterKeys.some((key) => query.has(key))) return previous;
  const fromUrl = parseCatalogState({
    keyword: query.get("q"), operator: query.get("operator"), area: query.get("area"),
    priceBand: query.get("price"), dataBand: query.get("data"), term: query.get("term"),
    onlyConfirmed: query.get("confirmed") === "1",
    comparisonIds: (query.get("compare") || "").split(",").map(Number)
  });
  const sameFilters = ["keyword", "operator", "area", "priceBand", "dataBand", "term", "onlyConfirmed"].every((key) => fromUrl[key as keyof CatalogState] === previous[key as keyof CatalogState]);
  return { ...fromUrl, visibleCount: sameFilters ? previous.visibleCount : initialVisibleCount, scrollY: sameFilters ? previous.scrollY : 0, filterVisible: sameFilters ? previous.filterVisible : true };
}

export function catalogStateSearch(search: string, state: CatalogState) {
  const query = new URLSearchParams(search);
  query.set("catalog", "1");
  const values: Record<string, string> = {
    q: state.keyword, operator: state.operator === "全部" ? "" : state.operator,
    area: state.area === "全部" ? "" : state.area, price: state.priceBand === "all" ? "" : state.priceBand,
    data: state.dataBand === "all" ? "" : state.dataBand, term: state.term === "all" ? "" : state.term,
    confirmed: state.onlyConfirmed ? "1" : "", compare: state.comparisonIds.join(",")
  };
  for (const [key, value] of Object.entries(values)) value ? query.set(key, value) : query.delete(key);
  return query.toString();
}
