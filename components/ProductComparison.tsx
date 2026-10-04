"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { CatalogProduct } from "@/app/ProductCatalogClient";
import { Modal } from "@/components/Modal";
import { type CustomerRequirements, getAgeInputError, toEligibilityContext } from "@/components/EligibilityControls";
import { evaluateEligibility } from "@/lib/product-eligibility";
import { formatAge, formatUpdatedAt, formatValue, isProductStale } from "@/lib/product-display";
import "./catalog-enhancements.css";

type ComparisonRow = {
  label: string;
  value: (product: CatalogProduct) => string;
  expandable?: boolean;
};

function comparableValue(value: string) {
  const normalized = value.trim().replace(/\s+/g, "");
  return !normalized || ["待确认", "未知", "未说明", "未提供"].includes(normalized) ? "待确认" : normalized;
}

function ComparisonValue({ value, expandable }: { value: string; expandable?: boolean }) {
  const text = value.trim() || "待确认";
  if (!expandable || (text.length <= 100 && text.split("\n").length <= 3)) return <>{text}</>;
  return <details className="comparison-details"><summary><span>{text}</span><b className="comparison-details-expand">展开完整内容</b><b className="comparison-details-collapse">收起完整内容</b></summary><div>{text}</div></details>;
}

export function ProductComparison({ products, requirements, onClose, onRemove, onApply }: { products: CatalogProduct[]; requirements: CustomerRequirements; onClose: () => void; onRemove: (id: number) => void; onApply: (product: CatalogProduct) => void }) {
  const [onlyDifferences, setOnlyDifferences] = useState(true);
  const context = toEligibilityContext(requirements);
  const rows: ComparisonRow[] = [
    { label: "月租", value: (product) => formatValue(product.monthlyRent, "元/月") },
    { label: "平均月费用", value: (product) => formatValue(product.averageMonthlyCost, "元/月") },
    { label: "预付金额", value: (product) => formatValue(product.prepaidAmount, "元") },
    { label: "付费周期", value: (product) => formatValue(product.billingPeriodMonths, "个月") },
    { label: "优惠结束后月租", value: (product) => formatValue(product.postPromoMonthlyRent, "元/月") },
    { label: "通用流量", value: (product) => formatValue(product.generalDataGB, "G") },
    { label: "定向流量", value: (product) => formatValue(product.directedDataGB, "G") },
    { label: "通话", value: (product) => formatValue(product.callMinutes, "分钟") },
    { label: "优惠期限", value: (product) => product.priceTime || "待确认" },
    { label: "首充要求", value: (product) => formatValue(product.firstRechargeAmount, "元") },
    { label: "办理年龄", value: (product) => formatAge(product.age1, product.age2) },
    { label: "号码归属地", value: (product) => product.area || "待确认" },
    { label: "办理条件", expandable: true, value: (product) => { const result = evaluateEligibility(product, context); return `${result.status === "eligible" ? "已知条件符合" : result.status === "ineligible" ? "不符合办理条件" : "待确认"}：${result.reasons.join("；")}`; } },
    { label: "套餐说明", expandable: true, value: (product) => product.taocan || "待确认" },
    { label: "办理规则", expandable: true, value: (product) => product.rule || "待确认" },
    { label: "待核对信息", expandable: true, value: (product) => product.validationIssues?.join("；") || "未发现字段冲突；完整规则以办理页为准" },
    { label: "资料更新", value: (product) => `${formatUpdatedAt(product.updatedAt)}${isProductStale(product.updatedAt) ? " · 待更新核对" : ""}` }
  ];
  const differentRows = rows.filter((row) => new Set(products.map((product) => comparableValue(row.value(product)))).size > 1);
  const visibleRows = onlyDifferences ? differentRows : rows;
  const hiddenRows = rows.length - differentRows.length;

  return (
    <Modal label="套餐对比" onClose={onClose} className="comparison-dialog">
      <header className="comparison-head"><div><h2>套餐对比</h2><p>首充可能计入话费余额，不与月租直接相加。</p></div><button className="icon-button" aria-label="关闭套餐对比" onClick={onClose} type="button"><X size={20} /></button></header>
      <div className="comparison-view-options">
        <label><input type="checkbox" checked={onlyDifferences} onChange={(event) => setOnlyDifferences(event.target.checked)} />只看不同项</label>
        <span>{onlyDifferences ? `已隐藏 ${hiddenRows} 项相同信息` : `共 ${rows.length} 项信息`}</span>
        <span className="comparison-swipe-hint">左右滑动查看套餐</span>
      </div>
      <div className="comparison-scroll" tabIndex={0} role="region" aria-label="套餐对比表，可横向滚动">
        <table className="comparison-table">
          <thead><tr><th scope="col">对比项目</th>{products.map((product) => <th scope="col" key={product.productID}><span>{product.operator}</span><strong>{product.productName}</strong><button type="button" onClick={() => onRemove(product.productID)} aria-label={`移除 ${product.productName}`}>移除</button></th>)}</tr></thead>
          <tbody>{visibleRows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{products.map((product) => <td key={product.productID}><ComparisonValue value={row.value(product)} expandable={row.expandable} /></td>)}</tr>)}
            {onlyDifferences && visibleRows.length === 0 ? <tr><td colSpan={products.length + 1} className="comparison-same-note">这些套餐的已列信息相同，可取消“只看不同项”查看详情。</td></tr> : null}
            <tr><th scope="row">办理入口</th>{products.map((product) => <td key={product.productID}><button type="button" className="button green" disabled={Boolean(getAgeInputError(requirements.age)) || evaluateEligibility(product, context).status === "ineligible"} onClick={() => onApply(product)}>去办理</button></td>)}</tr>
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
