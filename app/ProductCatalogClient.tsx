"use client";

import { ExternalLink, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { OrderFrame } from "@/components/OrderFrame";
import { RemoteImage } from "@/components/RemoteImage";
import type { CardProduct, ProductCategory } from "@/lib/types";
import { getBrowserVisitorId } from "@/lib/visitor-id";

export type CatalogProduct = CardProduct & {
  orderUrl: string;
};

type ProductCatalogClientProps = {
  products: CatalogProduct[];
};

const operatorOptions = ["全部", "移动", "联通", "电信", "广电"] as const;
const allOption = "全部";

const priceOptions = [
  { label: "全部", value: "all" },
  { label: "19元内", value: "lte19" },
  { label: "20-29元", value: "20-29" },
  { label: "30-39元", value: "30-39" },
  { label: "40-59元", value: "40-59" },
  { label: "60元以上", value: "gte60" }
] as const;

const dataOptions = [
  { label: "全部", value: "all" },
  { label: "100G内", value: "lte100" },
  { label: "100-199G", value: "100-199" },
  { label: "200G以上", value: "gte200" }
] as const;

const termOptions = [
  { label: "全部", value: "all" },
  { label: "长期", value: "long" },
  { label: "短期优惠", value: "short" }
] as const;

const ageOptions = [
  { label: "全部", value: "all" },
  { label: "18-30岁", value: "18-30" },
  { label: "31-45岁", value: "31-45" },
  { label: "46-60岁", value: "46-60" }
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
  const generalData = product.generalDataGB ?? product.dataGB;
  const words = [
    product.productID,
    product.productName,
    product.operator,
    getCategoryLabel(product.category),
    product.area,
    product.taocan,
    product.rule,
    product.priceTime,
    product.backMoneyType,
    product.isLongTerm ? "长期" : "短期 优惠期",
    product.monthlyRent ? `${product.monthlyRent}元` : "",
    product.dataGB ? `${product.dataGB}G` : "",
    generalData ? `通用${generalData}G ${generalData}G通用` : "",
    product.callMinutes ? `${product.callMinutes}分钟` : "",
    product.firstRechargeAmount ? `首充${product.firstRechargeAmount}元` : "",
    `${product.age1}-${product.age2}岁`,
    product.numberSel > 0 ? "支持选号" : "不选号"
  ].join(" ");

  const normalized = normalizeSearchText(words);
  return `${normalized} ${normalized.replace(/\s/g, "")}`;
}

function getGeneralDataGB(product: CatalogProduct) {
  return product.generalDataGB ?? product.dataGB;
}

function matchesPriceBand(product: CatalogProduct, band: (typeof priceOptions)[number]["value"]) {
  const price = product.monthlyRent;

  if (band === "all") {
    return true;
  }

  if (band === "lte19") {
    return price <= 19;
  }

  if (band === "20-29") {
    return price >= 20 && price <= 29;
  }

  if (band === "30-39") {
    return price >= 30 && price <= 39;
  }

  if (band === "40-59") {
    return price >= 40 && price <= 59;
  }

  return price >= 60;
}

function matchesDataBand(product: CatalogProduct, band: (typeof dataOptions)[number]["value"]) {
  const generalData = getGeneralDataGB(product);

  if (band === "all") {
    return true;
  }

  if (band === "lte100") {
    return generalData <= 100;
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

  const longTerm = Boolean(product.isLongTerm) || product.priceTime.includes("长期");
  return term === "long" ? longTerm : !longTerm;
}

function matchesAgeGroup(product: CatalogProduct, ageGroup: (typeof ageOptions)[number]["value"]) {
  if (ageGroup === "all") {
    return true;
  }

  const [minAge, maxAge] = ageGroup.split("-").map(Number);
  return product.age1 <= maxAge && product.age2 >= minAge;
}

function trackApplyClick(product: CatalogProduct) {
  const query = new URLSearchParams(window.location.search);
  const payload = JSON.stringify({
    event: "apply_click",
    productId: product.productID,
    productName: product.productName,
    source: "catalog_modal",
    userId: getBrowserVisitorId(),
    path: window.location.pathname,
    referrer: document.referrer || undefined,
    utmSource: query.get("utm_source") || undefined,
    utmMedium: query.get("utm_medium") || undefined,
    utmCampaign: query.get("utm_campaign") || undefined,
    utmContent: query.get("utm_content") || undefined
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
    return;
  }

  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true
  }).catch(() => undefined);
}

export function ProductCatalogClient({ products }: ProductCatalogClientProps) {
  const [keyword, setKeyword] = useState("");
  const [operator, setOperator] = useState<(typeof operatorOptions)[number]>("全部");
  const [area, setArea] = useState(allOption);
  const [priceBand, setPriceBand] = useState<(typeof priceOptions)[number]["value"]>("all");
  const [dataBand, setDataBand] = useState<(typeof dataOptions)[number]["value"]>("all");
  const [term, setTerm] = useState<(typeof termOptions)[number]["value"]>("all");
  const [ageGroup, setAgeGroup] = useState<(typeof ageOptions)[number]["value"]>("all");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | undefined>();
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
    ageGroup !== "all";

  const filteredProducts = useMemo(() => {
    const keywordParts = normalizeSearchText(keyword)
      .split(" ")
      .filter(Boolean);
    const normalizedArea = area !== allOption ? normalizeSearchText(area) : "";

    return indexedProducts.flatMap(({ product, searchText }) => {
      if (operator !== "全部" && product.operator !== operator) {
        return [];
      }

      if (area !== allOption && product.area !== area && !searchText.includes(normalizedArea)) {
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

      if (!matchesAgeGroup(product, ageGroup)) {
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
  }, [ageGroup, area, dataBand, indexedProducts, keyword, operator, priceBand, term]);

  useEffect(() => {
    if (!areaOptions.includes(area)) {
      setArea(allOption);
    }
  }, [area, areaOptions]);

  useEffect(() => {
    if (!selectedProduct) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedProduct(undefined);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedProduct]);

  function openOrder(product: CatalogProduct) {
    trackApplyClick(product);
    setSelectedProduct(product);
  }

  function resetFilters() {
    setKeyword("");
    setOperator("全部");
    setArea(allOption);
    setPriceBand("all");
    setDataBand("all");
    setTerm("all");
    setAgeGroup("all");
  }

  return (
    <section className="catalog-shell">
      <h1 className="sr-only">流量卡办理</h1>
      <div className="catalog-toolbar">
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

          <div className="catalog-result-meter">
            <span>结果</span>
            <strong>{filteredProducts.length}</strong>
            <small>/ {catalogProducts.length}</small>
          </div>
        </div>

        <div className="catalog-filter-deck">
          <div className="catalog-filter-label">
            <SlidersHorizontal size={15} />
            筛选
          </div>

          <div className="catalog-filter-group">
            <b>地方</b>
            <div className="catalog-filter-row" aria-label="地区筛选">
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
            <b>人群</b>
            <div className="catalog-filter-row" aria-label="人群筛选">
              {ageOptions.map((option) => (
                <button
                  className={ageGroup === option.value ? "active" : ""}
                  key={option.value}
                  onClick={() => setAgeGroup(option.value)}
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
        当前显示 <strong>{filteredProducts.length}</strong> 个可办理商品
      </div>

      {filteredProducts.length ? (
        <div className="catalog-grid">
          {filteredProducts.map((product) => (
            <article className="catalog-card" key={product.productID}>
              <div className="catalog-card-media">
                <RemoteImage src={product.mainPic} alt={product.productName} />
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
                    <b>{product.monthlyRent}元</b>
                    <small>月租</small>
                  </span>
                  <span>
                    <b>{getGeneralDataGB(product)}G</b>
                    <small>通用</small>
                  </span>
                  <span>
                    <b>{matchesTerm(product, "long") ? "长期" : "优惠期"}</b>
                    <small>周期</small>
                  </span>
                </div>
                <div className="catalog-raw-tags">
                  <span>{product.firstRechargeAmount ? `首充${product.firstRechargeAmount}元` : "首充待确认"}</span>
                  <span>
                    {product.age1}-{product.age2}岁
                  </span>
                  <span>{product.numberSel > 0 ? "支持选号" : "不选号"}</span>
                </div>
                <p>{product.taocan || product.rule || "套餐详情请以办理页展示为准，办理前重点核对优惠期、首充和地区限制。"}</p>
                <div className="catalog-card-actions">
                  <button className="button green" onClick={() => openOrder(product)} type="button">
                    <ExternalLink size={17} />
                    去办理
                  </button>
                  <a className="button small" href={`/card/${product.productID}`}>
                    看详情
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="catalog-empty">
          <h2>没有匹配的商品</h2>
          <p>换一个地区、运营商或月租关键词试试。</p>
          <button className="button small" onClick={resetFilters} type="button">
            重置筛选
          </button>
        </div>
      )}

      {selectedProduct ? (
        <div className="order-modal" role="dialog" aria-label={`${selectedProduct.productName}办理`} aria-modal="true">
          <button className="order-modal-backdrop" onClick={() => setSelectedProduct(undefined)} type="button" aria-label="关闭办理弹窗" />
          <div className="order-modal-panel">
            <header className="order-modal-head">
              <div>
                <span>办理前请核对套餐规则</span>
                <h2>{selectedProduct.productName}</h2>
                <p>
                  {selectedProduct.operator} / {selectedProduct.area} / {selectedProduct.priceTime}
                </p>
              </div>
              <div className="order-modal-actions">
                <a className="button small" href={selectedProduct.orderUrl} rel="noreferrer" target="_blank">
                  新窗口打开
                </a>
                <button className="icon-button" onClick={() => setSelectedProduct(undefined)} type="button" aria-label="关闭办理弹窗">
                  <X size={20} />
                </button>
              </div>
            </header>
            <OrderFrame src={selectedProduct.orderUrl} title={`${selectedProduct.productName}办理`} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
