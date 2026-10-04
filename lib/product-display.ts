export function formatValue(value: number | undefined, unit = "") {
  return typeof value === "number" && Number.isFinite(value) ? `${value}${unit}` : "待确认";
}

export function formatAge(min?: number, max?: number) {
  return min !== undefined && max !== undefined ? `${min}–${max}岁` : "待确认";
}

export function formatUpdatedAt(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "更新时间待确认";
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

export function isProductStale(value?: string) {
  return !value || !Number.isFinite(Date.parse(value)) || Date.now() - Date.parse(value) > 30 * 60 * 1000;
}
