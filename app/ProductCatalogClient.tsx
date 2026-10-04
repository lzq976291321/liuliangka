"use client";

import { ArrowUp, ExternalLink, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EligibilityControls, emptyRequirements, getAgeInputError, requirementsHref, toEligibilityContext, useCustomerRequirements } from "@/components/EligibilityControls";
import { ProductComparison } from "@/components/ProductComparison";
import { Modal } from "@/components/Modal";
import { evaluateEligibility } from "@/lib/product-eligibility";
import { formatValue, formatAge, formatUpdatedAt, isProductStale } from "@/lib/product-display";
import { OrderFrame } from "@/components/OrderFrame";
import { RemoteImage } from "@/components/RemoteImage";
import {
  buildAttributedOrderUrl,
  buildChannelInternalHref,
  useChannelAttribution
} from "@/lib/channel-attribution";
import type { ProductCategory } from "@/lib/types";
import { trackEvent } from "@/lib/track-event";
import type { CatalogPayload, CatalogProduct } from "@/lib/catalog-product";
import { catalogStateKey, catalogStateSearch, restoreCatalogState, initialVisibleCount, visibleCountStep, type CatalogState } from "@/lib/catalog-state";
export type { CatalogProduct } from "@/lib/catalog-product";

type ProductCatalogClientProps = { initialCatalog: CatalogPayload };

const operatorOptions = ["全部", "移动", "联通", "电信", "广电"] as const;
const allOption = "全部";

const priceOptions = [
  { label: "全部", value: "all" },
  { label: "20元以下", value: "lte19" },
  { label: "20-29元", value: "20-29" },
  { label: "30-39元", value: "30-39" },
  { label: "40-59元", value: "40-59" },
  { label: "60元以上", value: "gte60" }
] as const;

const dataOptions = [
  { label: "全部", value: "all" },
  { label: "100G以下", value: "lte100" },
  { label: "100-199G", value: "100-199" },
  { label: "200G以上", value: "gte200" }
] as const;

const termOptions = [
  { label: "全部", value: "all" },
  { label: "长期", value: "long" },
  { label: "短期优惠", value: "short" }
] as const;

function getCategoryLabel(category?: ProductCategory) {
  if (category === "mobile-card") {
    return "流量卡";
  }

  if (category === "broadband") {
    return "宽带";
  }

  return "未知";
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[【】\[\]（）()，,。.;；:：\/|+_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchText(product: CatalogProduct) {
  const generalData = product.generalDataGB;
  const words = [
    product.productID,
    product.productName,
    product.operator,
    getCategoryLabel(product.category),
    product.area,
    product.taocan,
    product.rule,
    product.priceTime,
    product.isLongTerm === true ? "长期" : product.isLongTerm === false ? "短期 优惠期" : "",
    product.monthlyRent ? `${formatValue(product.monthlyRent, "元")}` : "",
    product.dataGB ? `${product.dataGB}G` : "",
    generalData ? `通用${generalData}G ${generalData}G通用` : "",
    product.callMinutes ? `${product.callMinutes}分钟` : "",
    product.firstRechargeAmount ? `首充${product.firstRechargeAmount}元` : "",
    formatAge(product.age1, product.age2),
    product.numberSel > 0 ? "支持选号" : "不选号"
  ].join(" ");

  const normalized = normalizeSearchText(words);
  return `${normalized} ${normalized.replace(/\s/g, "")}`;
}

function getGeneralDataGB(product: CatalogProduct) {
  return product.generalDataGB;
}

function matchesPriceBand(product: CatalogProduct, band: (typeof priceOptions)[number]["value"]) {
  const price = product.monthlyRent;

  if (band === "all") {
    return true;
  }

  if (price === undefined) return false;

  if (band === "lte19") {
    return price < 20;
  }

  if (band === "20-29") {
    return price >= 20 && price < 30;
  }

  if (band === "30-39") {
    return price >= 30 && price < 40;
  }

  if (band === "40-59") {
    return price >= 40 && price < 60;
  }

  return price >= 60;
}

function matchesDataBand(product: CatalogProduct, band: (typeof dataOptions)[number]["value"]) {
  const generalData = getGeneralDataGB(product);

  if (band === "all") {
    return true;
  }

  if (generalData === undefined) return false;

  if (band === "lte100") {
    return generalData < 100;
  }

  if (band === "100-199") {
    return generalData >= 100 && generalData < 200;
  }

  return generalData >= 200;
}

function matchesTerm(product: CatalogProduct, term: (typeof termOptions)[number]["value"]) {
  if (term === "all") {
    return true;
  }

  return term === "long" ? product.isLongTerm === true : product.isLongTerm === false;
}

export function ProductCatalogClient({ initialCatalog }: ProductCatalogClientProps) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const products = catalog.products;
  const [catalogReady, setCatalogReady] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [stateReady, setStateReady] = useState(false);
  const [restoringView, setRestoringView] = useState(true);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const pendingRestoration = useRef<CatalogState | undefined>(undefined);
  const lastFilterKey = useRef<string | undefined>(undefined);
  const persistedState = useRef<CatalogState | undefined>(undefined);
  const channelAttribution = useChannelAttribution();
  const [keyword, setKeyword] = useState("");
  const [operator, setOperator] = useState<(typeof operatorOptions)[number]>("全部");
  const [area, setArea] = useState(allOption);
  const [priceBand, setPriceBand] = useState<(typeof priceOptions)[number]["value"]>("all");
  const [dataBand, setDataBand] = useState<(typeof dataOptions)[number]["value"]>("all");
  const [term, setTerm] = useState<(typeof termOptions)[number]["value"]>("all");
  const [requirements, setRequirements, requirementsReady] = useCustomerRequirements();
  const [onlyConfirmed, setOnlyConfirmed] = useState(false);
  const [comparisonIds, setComparisonIds] = useState<number[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const ageError = getAgeInputError(requirements.age);
  const hasRequirements = Boolean(requirements.province || requirements.city || requirements.age);
  const eligibility = useMemo(() => new Map(products.map((product) => [product.productID, evaluateEligibility(product, toEligibilityContext(requirements))])), [products, requirements]);
  const comparisonProducts = products.filter((product) => comparisonIds.includes(product.productID));
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | undefined>();
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);
  const [isFilterVisible, setIsFilterVisible] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const lastScrollCheckpointRef = useRef(0);
  const lastScrollUpdateAtRef = useRef(0);
  const tickingScrollRef = useRef(false);
  const filterVisibleRef = useRef(true);
  const showBackToTopRef = useRef(false);
  const catalogProducts = useMemo(() => products.filter((product) => product.category === "mobile-card"), [products]);
  const indexedProducts = useMemo(() => catalogProducts.map((product) => ({ product, searchText: buildSearchText(product) })), [catalogProducts]);
  const areaOptions = useMemo(() => {
    const areaCounts = new Map<string, number>();

    for (const product of catalogProducts) {
      if (!product.area || product.area === "待确认" || product.area === "收货地") {
        continue;
      }

      areaCounts.set(product.area, (areaCounts.get(product.area) ?? 0) + 1);
    }

    return [
      allOption,
      ...Array.from(areaCounts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"))
        .map(([value]) => value)
    ];
  }, [catalogProducts]);
  const hasActiveFilter =
    Boolean(keyword.trim()) ||
    operator !== allOption ||
    area !== allOption ||
    priceBand !== "all" ||
    dataBand !== "all" ||
    term !== "all" ||
    hasRequirements || onlyConfirmed;

  const filteredProducts = useMemo(() => {
    const keywordParts = normalizeSearchText(keyword)
      .split(" ")
      .filter(Boolean);

    return indexedProducts.flatMap(({ product, searchText }) => {
      if (operator !== "全部" && product.operator !== operator) {
        return [];
      }

      if (area !== allOption && product.area !== area) {
        return [];
      }

      if (!matchesPriceBand(product, priceBand)) {
        return [];
      }

      if (!matchesDataBand(product, dataBand)) {
        return [];
      }

      if (!matchesTerm(product, term)) {
        return [];
      }

      const eligibilityResult = eligibility.get(product.productID);
      if (ageError || eligibilityResult?.status === "ineligible" || (onlyConfirmed && eligibilityResult?.status !== "eligible")) {
        return [];
      }

      if (keywordParts.length && !keywordParts.every((part) => searchText.includes(part))) {
        const compactKeyword = keywordParts.join("");
        if (!compactKeyword || !searchText.includes(compactKeyword)) {
          return [];
        }
      }

      return [product];
    });
  }, [ageError, eligibility, onlyConfirmed, area, dataBand, indexedProducts, keyword, operator, priceBand, term]);
  const visibleProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);
  const updatedCount = filteredProducts.filter((product) => !isProductStale(product.updatedAt)).length;
  const hasMoreProducts = visibleProducts.length < filteredProducts.length;
  useEffect(() => { if (requirementsReady && !hasRequirements) setOnlyConfirmed(false); }, [hasRequirements, requirementsReady]);
  const selectedOrderUrl = selectedProduct ? buildAttributedOrderUrl(selectedProduct.orderUrl, channelAttribution) : "";

  useEffect(() => {
    if (catalogReady && !areaOptions.includes(area)) {
      setArea(allOption);
    }
  }, [area, areaOptions, catalogReady]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    setCatalogError(false);
    fetch("/api/catalog", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("catalog unavailable");
        const result = await response.json() as CatalogPayload;
        if (!Array.isArray(result.products) || !result.products.length) throw new Error("empty catalog");
        setCatalog(result);
        setCatalogReady(true);
      })
      .catch(() => { if (!disposed) setCatalogError(true); })
      .finally(() => window.clearTimeout(timeout));
    let disposed = false;
    return () => { disposed = true; window.clearTimeout(timeout); controller.abort(); };
  }, [loadAttempt]);

  useEffect(() => {
    function restore() {
      setRestoringView(true);
      let stored: unknown;
      try { stored = JSON.parse(sessionStorage.getItem(catalogStateKey) || "null"); } catch { /* Storage is optional. */ }
      const state = restoreCatalogState(window.location.search, stored);
      setKeyword(state.keyword); setOperator(state.operator); setArea(state.area);
      setPriceBand(state.priceBand); setDataBand(state.dataBand); setTerm(state.term);
      setOnlyConfirmed(state.onlyConfirmed); setComparisonIds(state.comparisonIds);
      setVisibleCount(state.visibleCount); pendingRestoration.current = state;
      filterVisibleRef.current = state.filterVisible; setIsFilterVisible(state.filterVisible);
      lastFilterKey.current = undefined;
      setStateReady(true);
      setRestoreVersion((version) => version + 1);
    }
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  const filterKey = JSON.stringify([keyword, operator, area, priceBand, dataBand, term, onlyConfirmed, requirements]);
  useEffect(() => {
    if (!stateReady || !requirementsReady) return;
    if (lastFilterKey.current === undefined) {
      lastFilterKey.current = filterKey;
    } else if (lastFilterKey.current !== filterKey) {
      lastFilterKey.current = filterKey;
      pendingRestoration.current = undefined;
      setVisibleCount(initialVisibleCount);
    }
  }, [filterKey, stateReady, requirementsReady]);

  useEffect(() => {
    if (!stateReady || !requirementsReady || !catalogReady) return;
    const saved = pendingRestoration.current;
    const frame = requestAnimationFrame(() => {
      pendingRestoration.current = undefined;
      if (saved?.scrollY) window.scrollTo({ top: saved.scrollY, behavior: "instant" });
      setRestoringView(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [stateReady, requirementsReady, catalogReady, restoreVersion]);

  useEffect(() => {
    if (!stateReady || !requirementsReady || !catalogReady) return;
    setComparisonIds((current) => {
      const next = current.filter((id) => products.some((p) => p.productID === id));
      return next.length === current.length ? current : next;
    });
  }, [products, catalogReady, stateReady, requirementsReady]);

  useEffect(() => {
    if (!stateReady || !requirementsReady) return;
    const state: CatalogState = { keyword, operator, area, priceBand, dataBand, term, onlyConfirmed, comparisonIds, visibleCount, filterVisible: isFilterVisible, scrollY: pendingRestoration.current?.scrollY ?? window.scrollY };
    persistedState.current = state;
    try { sessionStorage.setItem(catalogStateKey, JSON.stringify(state)); } catch { /* Browsing still works without storage. */ }
    const search = catalogStateSearch(window.location.search, state);
    if (search !== window.location.search.slice(1)) history.replaceState(history.state, "", `${window.location.pathname}?${search}${window.location.hash}`);
  }, [keyword, operator, area, priceBand, dataBand, term, onlyConfirmed, comparisonIds, visibleCount, isFilterVisible, stateReady, requirementsReady, catalogReady]);

  useEffect(() => {
    const saveScroll = () => {
      if (!persistedState.current || pendingRestoration.current) return;
      try { sessionStorage.setItem(catalogStateKey, JSON.stringify({ ...persistedState.current, scrollY: window.scrollY })); } catch { /* Optional storage. */ }
    };
    window.addEventListener("pagehide", saveScroll);
    window.addEventListener("scroll", saveScroll, { passive: true });
    return () => { saveScroll(); window.removeEventListener("pagehide", saveScroll); window.removeEventListener("scroll", saveScroll); };
  }, []);

  useEffect(() => {
    if (!selectedProduct || !catalogReady) return;
    const current = products.find((product) => product.productID === selectedProduct.productID);
    if (!current || ageError || eligibility.get(current.productID)?.status === "ineligible") setSelectedProduct(undefined);
    else if (current !== selectedProduct) setSelectedProduct(current);
  }, [products, selectedProduct, eligibility, ageError, catalogReady]);

  useEffect(() => {
    if (!catalogReady || !stateReady || !requirementsReady || filteredProducts.length || ageError) return;
    const timer = window.setTimeout(() => trackEvent("catalog_zero_results", {
      source: "catalog", operator, priceBand, dataBand, term, onlyConfirmed,
      hasKeyword: Boolean(keyword.trim()), hasLocation: Boolean(requirements.province || requirements.city), hasAge: Boolean(requirements.age)
    }, channelAttribution), 800);
    return () => window.clearTimeout(timer);
  }, [catalogReady, stateReady, requirementsReady, filteredProducts.length, ageError, keyword, operator, priceBand, dataBand, term, onlyConfirmed, requirements, channelAttribution]);

  useEffect(() => {
    const collapseScrollDelta = 18;
    const scrollUpdateIntervalMs = 80;
    const showBackToTopAfter = 520;

    lastScrollCheckpointRef.current = Math.max(window.scrollY, 0);
    showBackToTopRef.current = lastScrollCheckpointRef.current > showBackToTopAfter;
    setShowBackToTop(showBackToTopRef.current);

    function updateFilterVisible(nextFilterVisible: boolean) {
      if (filterVisibleRef.current === nextFilterVisible) {
        return;
      }

      filterVisibleRef.current = nextFilterVisible;
      setIsFilterVisible(nextFilterVisible);
    }

    function updateBackToTopVisible(nextBackToTopVisible: boolean) {
      if (showBackToTopRef.current === nextBackToTopVisible) {
        return;
      }

      showBackToTopRef.current = nextBackToTopVisible;
      setShowBackToTop(nextBackToTopVisible);
    }

    const updateScrollState = () => {
      const currentScrollY = Math.max(window.scrollY, 0);
      const now = window.performance.now();

      if (now - lastScrollUpdateAtRef.current < scrollUpdateIntervalMs) {
        tickingScrollRef.current = false;
        return;
      }

      lastScrollUpdateAtRef.current = now;

      const delta = currentScrollY - lastScrollCheckpointRef.current;
      updateBackToTopVisible(currentScrollY > showBackToTopAfter);

      if (delta >= collapseScrollDelta) {
        updateFilterVisible(false);
        lastScrollCheckpointRef.current = currentScrollY;
      } else if (delta <= -collapseScrollDelta) {
        lastScrollCheckpointRef.current = currentScrollY;
      }

      tickingScrollRef.current = false;
    };

    const handleScroll = () => {
      if (tickingScrollRef.current) {
        return;
      }

      tickingScrollRef.current = true;
      window.requestAnimationFrame(updateScrollState);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  function openOrder(product: CatalogProduct) {
    if (!requirementsReady || ageError || eligibility.get(product.productID)?.status === "ineligible") return;
    setComparisonOpen(false);
    trackEvent("apply_click", { productId: product.productID, productName: product.productName, source: comparisonOpen ? "comparison" : "catalog_modal" }, channelAttribution);
    setSelectedProduct(product);
  }

  function revealFilters() {
    filterVisibleRef.current = true;
    setIsFilterVisible(true);
    lastScrollCheckpointRef.current = Math.max(window.scrollY, 0);
  }

  function resetFilters() {
    setKeyword("");
    setOperator("全部");
    setArea(allOption);
    setPriceBand("all");
    setDataBand("all");
    setTerm("all");
    setRequirements(emptyRequirements);
    setOnlyConfirmed(false);
    revealFilters();
  }

  function toggleComparison(productID: number) {
    setComparisonIds((current) => current.includes(productID) ? current.filter((id) => id !== productID) : current.length < 3 ? [...current, productID] : current);
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="catalog-shell" data-restoring={restoringView}>
      <h1 className="sr-only">流量卡办理</h1>
      <section className="eligibility-panel" aria-label="办理条件">
        <div className="eligibility-heading"><h2>先核对办理条件</h2><span>按填写条件排除已知不能办理的套餐</span></div>
        <EligibilityControls value={requirements} onChange={setRequirements} />
        <label className="confirmed-filter"><input type="checkbox" checked={onlyConfirmed} disabled={!hasRequirements || Boolean(ageError)} onChange={(event) => setOnlyConfirmed(event.target.checked)} />只看已知条件符合的套餐</label>
      </section>
      <div className={`catalog-toolbar ${isFilterVisible ? "" : "is-filter-hidden"}`}>
        <div className="catalog-search-line">
          <label className="catalog-search">
            <Search size={18} />
            <input
              placeholder="搜商品名、地区、月租、流量，例如：联通 39 重庆"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            {keyword ? (
              <button className="catalog-search-clear" onClick={() => setKeyword("")} type="button" aria-label="清空搜索">
                <X size={16} />
              </button>
            ) : null}
          </label>

          <div className="catalog-toolbar-actions">
            {!isFilterVisible ? (
              <button className="catalog-expand-filter" onClick={revealFilters} type="button" aria-controls="catalog-filter-deck" aria-expanded={isFilterVisible}>
                <SlidersHorizontal size={16} />
                展开筛选
              </button>
            ) : null}

            <div className="catalog-result-meter">
              <span>结果</span>
              <strong>{catalogReady ? filteredProducts.length : "…"}</strong>
              <small>/ {catalog.total}</small>
            </div>
          </div>
        </div>

        <div className="catalog-filter-deck" id="catalog-filter-deck">
          <div className="catalog-filter-label">
            <SlidersHorizontal size={15} />
            筛选
          </div>

          <div className="catalog-filter-group">
            <b>归属地</b>
            <div className="catalog-filter-row" aria-label="号码归属地筛选">
              {areaOptions.map((option) => (
                <button className={area === option ? "active" : ""} key={option} onClick={() => setArea(option)} type="button">
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="catalog-filter-group">
            <b>月租</b>
            <div className="catalog-filter-row" aria-label="月租筛选">
              {priceOptions.map((option) => (
                <button
                  className={priceBand === option.value ? "active" : ""}
                  key={option.value}
                  onClick={() => setPriceBand(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="catalog-filter-group">
            <b>通用</b>
            <div className="catalog-filter-row" aria-label="通用流量筛选">
              {dataOptions.map((option) => (
                <button
                  className={dataBand === option.value ? "active" : ""}
                  key={option.value}
                  onClick={() => setDataBand(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="catalog-filter-group">
            <b>周期</b>
            <div className="catalog-filter-row" aria-label="套餐周期筛选">
              {termOptions.map((option) => (
                <button
                  className={term === option.value ? "active" : ""}
                  key={option.value}
                  onClick={() => setTerm(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="catalog-filter-group">
            <b>运营商</b>
            <div className="catalog-filter-row" aria-label="运营商筛选">
              {operatorOptions.map((option) => (
                <button className={operator === option ? "active" : ""} key={option} onClick={() => setOperator(option)} type="button">
                  {option}
                </button>
              ))}
            </div>
          </div>

          {hasActiveFilter ? (
            <button className="catalog-reset" onClick={resetFilters} type="button">
              <RotateCcw size={14} />
              重置
            </button>
          ) : null}
        </div>
      </div>

      <div className="catalog-count">
        {catalogReady ? <>当前显示 <strong>{visibleProducts.length}</strong> / {filteredProducts.length} 个套餐</> : catalogError ? `当前显示 ${visibleProducts.length} 个套餐，完整列表未更新` : "正在更新完整套餐列表…"}
        {catalogReady && catalog.stale ? <span> · {updatedCount} 条近期更新，{filteredProducts.length - updatedCount} 条待更新核对</span> : null}
      </div>

      {catalogError ? <div className="catalog-load-status" role="status">完整列表更新失败，已保留当前 {products.length} 个套餐。<button className="button small" type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>重新加载</button></div> : null}
      {filteredProducts.length ? (
        <>
          <div className="catalog-grid">
            {visibleProducts.map((product, index) => (
              <article className="catalog-card" key={product.productID}>
                <div className="catalog-card-media">
                  <RemoteImage
                    src={product.imageUrl}
                    alt={product.productName}
                    priority={index === 0 && !hasActiveFilter}
                  />
                  <span>{getCategoryLabel(product.category)}</span>
                </div>
                <div className="catalog-card-body">
                  <div className="catalog-card-meta">
                    <span>{product.operator}</span>
                    <span>{product.area}</span>
                  </div>
                  <h2>{product.productName}</h2>
                  <div className="catalog-card-facts" aria-label="套餐核心参数">
                    <span>
                      <b>{formatValue(product.monthlyRent, "元")}</b>
                      <small>月租</small>
                    </span>
                    <span>
                      <b>{formatValue(getGeneralDataGB(product), "G")}</b>
                      <small>通用</small>
                    </span>
                    <span>
                      <b>{product.isLongTerm === true ? "长期" : product.isLongTerm === false ? "优惠期" : "待确认"}</b>
                      <small>周期</small>
                    </span>
                  </div>
                  <div className="catalog-raw-tags">
                    <span>{product.firstRechargeAmount !== undefined ? `首充${product.firstRechargeAmount}元` : "首充待确认"}</span>
                    {product.averageMonthlyCost !== undefined ? <span>月均{product.averageMonthlyCost}元</span> : null}
                    {product.prepaidAmount !== undefined ? <span>预付{product.prepaidAmount}元{product.billingPeriodMonths ? ` / ${product.billingPeriodMonths}个月` : ""}</span> : null}
                    <span>
                      {formatAge(product.age1, product.age2)}
                    </span>
                    <span>{product.numberSel > 0 ? "支持选号" : "不选号"}</span>
                  </div>
                  <p>{product.taocan || product.rule || "套餐详情请以办理页展示为准，办理前重点核对优惠期、首充和地区限制。"}</p>
                  {hasRequirements ? <div className={`eligibility-result ${eligibility.get(product.productID)?.status}`}><strong>{eligibility.get(product.productID)?.status === "eligible" ? "已知条件符合" : "办理条件待确认"}</strong><span>{eligibility.get(product.productID)?.reasons.join("；")}</span></div> : null}
                  {product.validationIssues?.length ? <div className="fact-notice">部分套餐信息有冲突，查看详情核对</div> : null}
                  <small className="product-updated">资料更新：{formatUpdatedAt(product.updatedAt)}{isProductStale(product.updatedAt) ? " · 待更新核对" : ""}</small>
                  <div className="catalog-card-actions">
                    <button className="button green" disabled={!requirementsReady} onClick={() => openOrder(product)} type="button">
                      <ExternalLink size={17} />
                      去办理
                    </button>
                    <a className="button small" href={buildChannelInternalHref(requirementsHref(`/card/${product.productID}`, requirements), channelAttribution)}>
                      看详情
                    </a>
                    <button type="button" className="button small compare-toggle" aria-pressed={comparisonIds.includes(product.productID)} aria-label={`${comparisonIds.includes(product.productID) ? "移出" : "加入"}对比 ${product.productName}`} disabled={!comparisonIds.includes(product.productID) && comparisonIds.length >= 3} onClick={() => toggleComparison(product.productID)}>{comparisonIds.includes(product.productID) ? "已选对比" : "加入对比"}</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {hasMoreProducts ? (
            <button className="catalog-load-more" onClick={() => setVisibleCount((count) => count + visibleCountStep)} type="button">
              加载更多商品
            </button>
          ) : null}
        </>
      ) : (
        <div className="catalog-empty">
          <h2>{catalogReady ? "没有匹配的商品" : catalogError ? "暂时无法取得完整列表" : "正在加载套餐"}</h2>
          <p>{ageError || "可以调整筛选条件；条件未知的套餐不计入“已知条件符合”。"}</p>
          <button className="button small" onClick={resetFilters} type="button">
            重置筛选
          </button>
        </div>
      )}

      {comparisonIds.length ? (
        <aside className="comparison-tray" aria-label="待对比套餐">
          <div className="comparison-picks"><strong>已选 {comparisonIds.length} / 3</strong>{comparisonProducts.map((product) => <button key={product.productID} type="button" title={product.productName} onClick={() => toggleComparison(product.productID)} aria-label={`移出对比 ${product.productName}`}>{product.productName}<X size={14} /></button>)}{comparisonProducts.length < comparisonIds.length ? <span>部分套餐资料待加载</span> : null}</div>
          <button className="button green" type="button" disabled={comparisonProducts.length < 2} onClick={() => { trackEvent("comparison_open", { source: "catalog", productIds: comparisonIds, count: comparisonProducts.length }, channelAttribution); setComparisonOpen(true); }}>对比套餐</button>
          <button type="button" className="button small" onClick={() => setComparisonIds([])}>清空</button>
          <span className="comparison-tray-note">选择 2–3 张卡</span>
        </aside>
      ) : null}
      {comparisonOpen && comparisonProducts.length >= 2 ? <ProductComparison products={comparisonProducts} requirements={requirements} onClose={() => setComparisonOpen(false)} onRemove={(id) => { toggleComparison(id); if (comparisonProducts.length <= 2) setComparisonOpen(false); }} onApply={openOrder} /> : null}
      {selectedProduct ? (
        <Modal label={`${selectedProduct.productName}办理`} onClose={() => setSelectedProduct(undefined)} className="order-dialog">
          <header className="order-modal-head">
            <div><span>办理前请核对套餐规则</span><h2>{selectedProduct.productName}</h2><p>{selectedProduct.operator} / {selectedProduct.area} / {selectedProduct.priceTime}</p></div>
            <div className="order-modal-actions"><button className="icon-button" onClick={() => setSelectedProduct(undefined)} type="button" aria-label="关闭办理弹窗"><X size={20} /></button></div>
          </header>
          <OrderFrame src={selectedOrderUrl} title={`${selectedProduct.productName}办理`} />
        </Modal>
      ) : null}

      <button className={`back-to-top ${showBackToTop ? "is-visible" : ""}`} onClick={scrollToTop} type="button" aria-label="回到顶部">
        <ArrowUp size={22} />
      </button>
    </section>
  );
}
