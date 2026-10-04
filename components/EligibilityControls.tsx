"use client";

import { useEffect, useState } from "react";
import { findCityRegion, findProvinceRegion, getCityOptions, provinceOptions } from "@/lib/china-regions";

export type CustomerRequirements = { province: string; city: string; age: string };
export const emptyRequirements: CustomerRequirements = { province: "", city: "", age: "" };
export const requirementsStorageKey = "liuliangka.customer-requirements.v1";
const requirementKeys = ["province", "city", "age"] as const;

export function getAgeInputError(age: string) {
  return age !== "" && (!/^\d{1,3}$/.test(age) || Number(age) < 1 || Number(age) > 120) ? "请输入 1–120 的整数年龄" : "";
}

export function toEligibilityContext(requirements: CustomerRequirements) {
  return {
    province: requirements.province || undefined,
    city: requirements.city.trim() || undefined,
    age: requirements.age ? (getAgeInputError(requirements.age) ? Number.NaN : Number(requirements.age)) : undefined
  };
}

/** Normalize only verified names. Unknown URL/storage values stay visible and unconfirmed. */
export function normalizeCustomerRequirements(value: CustomerRequirements): CustomerRequirements {
  const province = value.province.trim();
  const city = value.city.trim();
  const knownProvince = findProvinceRegion(province);
  const knownCity = findCityRegion(city);
  return {
    province: knownProvince?.value ?? (province || knownCity?.province || ""),
    city: knownCity?.city ?? city,
    age: value.age.trim()
  };
}

export function parseStoredRequirements(value: string | null): CustomerRequirements | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const record = parsed as Record<string, unknown>;
    if (requirementKeys.some((key) => typeof record[key] !== "string")) return undefined;
    return normalizeCustomerRequirements({ province: record.province as string, city: record.city as string, age: record.age as string });
  } catch {
    return undefined;
  }
}

/** Any explicit condition makes the URL the complete snapshot, including explicit empty values. */
export function restoreCustomerRequirements(search: string, stored: string | null): { requirements: CustomerRequirements; source: "url" | "session" | "empty" } {
  const query = new URLSearchParams(search);
  if (requirementKeys.some((key) => query.has(key))) {
    return { requirements: normalizeCustomerRequirements({ province: query.get("province") ?? "", city: query.get("city") ?? "", age: query.get("age") ?? "" }), source: "url" };
  }
  const saved = parseStoredRequirements(stored);
  return saved ? { requirements: saved, source: "session" } : { requirements: { ...emptyRequirements }, source: "empty" };
}

export function requirementsHref(href: string, requirements: CustomerRequirements) {
  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = withoutHash.indexOf("?");
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const params = new URLSearchParams(queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "");
  for (const key of requirementKeys) {
    if (requirements[key]) params.set(key, requirements[key]);
    else params.delete(key);
  }
  return `${pathname}${params.size ? `?${params}` : ""}${hash}`;
}

function readSessionRequirements() {
  try { return window.sessionStorage.getItem(requirementsStorageKey); } catch { return null; }
}

function saveSessionRequirements(requirements: CustomerRequirements) {
  try {
    // Keep this scoped to the three inputs; catalog filters and attribution use their own state.
    window.sessionStorage.setItem(requirementsStorageKey, JSON.stringify({ province: requirements.province, city: requirements.city, age: requirements.age }));
  } catch { /* Storage restrictions must not prevent changing conditions. */ }
}

export function useCustomerRequirements(initialRequirements?: CustomerRequirements) {
  const [requirements, setRequirements] = useState<CustomerRequirements>(() => normalizeCustomerRequirements(initialRequirements ?? emptyRequirements));
  // The server cannot inspect this tab's saved inputs. An empty initial object still needs restoring.
  const [ready, setReady] = useState(Boolean(initialRequirements && requirementKeys.some((key) => initialRequirements[key])));
  useEffect(() => {
    function readRequirements() {
      const restored = restoreCustomerRequirements(window.location.search, readSessionRequirements());
      setRequirements(restored.requirements);
      saveSessionRequirements(restored.requirements);
      setReady(true);
    }
    function handleStorage(event: StorageEvent) {
      if (event.key === requirementsStorageKey || event.key === null) readRequirements();
    }
    readRequirements();
    window.addEventListener("requirementschange", readRequirements);
    window.addEventListener("popstate", readRequirements);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("requirementschange", readRequirements);
      window.removeEventListener("popstate", readRequirements);
      window.removeEventListener("storage", handleStorage);
    };
  }, [initialRequirements?.province, initialRequirements?.city, initialRequirements?.age]);
  function updateRequirements(next: CustomerRequirements) {
    const normalized = normalizeCustomerRequirements(next);
    setRequirements(normalized);
    saveSessionRequirements(normalized);
    window.history.replaceState(window.history.state, "", requirementsHref(`${window.location.pathname}${window.location.search}${window.location.hash}`, normalized));
    setReady(true);
    window.dispatchEvent(new Event("requirementschange"));
  }
  return [requirements, updateRequirements, ready] as const;
}

export function EligibilityControls({ value, onChange, idPrefix = "requirements" }: { value: CustomerRequirements; onChange: (next: CustomerRequirements) => void; idPrefix?: string }) {
  const ageError = getAgeInputError(value.age);
  const province = findProvinceRegion(value.province);
  const cityOptions = getCityOptions(value.province);
  const city = findCityRegion(value.city, value.province);
  const regionError = (value.province && !province) || (value.city && !city) ? "收货地区无法识别，请重新选择省份和城市" : "";
  const regionErrorId = regionError ? `${idPrefix}-region-error` : undefined;
  return (
    <div className="eligibility-controls">
      <label htmlFor={`${idPrefix}-province`}>收货省份
        <select id={`${idPrefix}-province`} value={province?.value ?? value.province} aria-invalid={Boolean(value.province && !province)} aria-describedby={regionErrorId} onChange={(event) => onChange({ ...value, province: event.target.value, city: "" })}>
          <option value="">不限 / 未填写</option>
          {value.province && !province ? <option value={value.province} disabled>{value.province}（待重新选择）</option> : null}
          {provinceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label htmlFor={`${idPrefix}-city`}>收货城市
        <select id={`${idPrefix}-city`} value={city?.city ?? value.city} disabled={!province} aria-invalid={Boolean(value.city && !city)} aria-describedby={regionErrorId} onChange={(event) => onChange({ ...value, city: event.target.value })}>
          <option value="">{province ? "不限 / 未填写" : "请先选择省份"}</option>
          {value.city && !city ? <option value={value.city} disabled>{value.city}（待重新选择）</option> : null}
          {cityOptions.map((option) => <option key={option.code} value={option.name}>{option.name}</option>)}
        </select>
      </label>
      <label htmlFor={`${idPrefix}-age`}>本人年龄
        <input id={`${idPrefix}-age`} inputMode="numeric" placeholder="填写周岁" value={value.age} maxLength={3} aria-invalid={Boolean(ageError)} aria-describedby={ageError ? `${idPrefix}-error` : undefined} onChange={(event) => onChange({ ...value, age: event.target.value.trim() })} />
      </label>
      {regionError ? <p className="field-error" id={regionErrorId} role="alert">{regionError}</p> : null}
      {ageError ? <p className="field-error" id={`${idPrefix}-error`} role="alert">{ageError}</p> : null}
    </div>
  );
}
