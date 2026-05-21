import { enrichProducts } from "@/lib/product-knowledge";
import type { CardProduct } from "@/lib/types";

export type ProductQualitySeverity = "high" | "medium" | "low";

export type ProductQualityIssue = {
  productID: number;
  productName: string;
  severity: ProductQualitySeverity;
  issue: string;
  suggestion: string;
};

export type ProductQualityTodo = {
  productID: number;
  productName: string;
  severity: ProductQualitySeverity;
  issues: string[];
  suggestions: string[];
};

type ProductQualityOptions = {
  focusProductIds?: Set<number>;
};

const severityWeight: Record<ProductQualitySeverity, number> = {
  high: 3,
  medium: 2,
  low: 1
};

function pushIssue(issues: ProductQualityIssue[], product: CardProduct, severity: ProductQualitySeverity, issue: string, suggestion: string) {
  issues.push({
    productID: product.productID,
    productName: product.productName,
    severity,
    issue,
    suggestion
  });
}

export function analyzeProductQuality(products: CardProduct[], options: ProductQualityOptions = {}) {
  const enriched = enrichProducts(products);
  const issues: ProductQualityIssue[] = [];
  const focusProductIds = options.focusProductIds;

  for (const product of enriched) {
    if (product.status === "hidden") {
      continue;
    }

    if (product.category === "unknown") {
      pushIssue(issues, product, "high", "无法识别品类", "人工确认是流量卡、宽带还是其他业务，并写入 product-overrides。");
      continue;
    }

    if (product.category !== "mobile-card") {
      continue;
    }

    if (product.status !== "active") {
      pushIssue(issues, product, "high", "商品不可推荐", "确认 172 flag 或同步状态，避免导购推荐下架卡。");
    }

    if (!product.applyUrl || product.applyUrl.startsWith("#")) {
      pushIssue(issues, product, "high", "缺少真实办理入口", "补齐 172 netAddr 或人工配置办理链接，否则只能展示详情不能转化。");
    }

    if (focusProductIds && !focusProductIds.has(product.productID)) {
      continue;
    }

    if (!product.generalDataGB) {
      pushIssue(issues, product, "medium", "未拆出通用流量", "人工确认通用/定向流量，避免导购只按总流量夸大推荐。");
    }

    if (!product.scenes.length) {
      pushIssue(issues, product, "medium", "缺少使用场景标签", "补充 student、cheap、takeaway、gaming、long-term 等场景。");
    }

    if (!product.cities.length && !product.area.includes("全国")) {
      pushIssue(issues, product, "medium", "地区兼容不明确", "确认可办城市、省内限制和禁发规则，避免跨地区误推。");
    }

    if (!product.firstRechargeAmount) {
      pushIssue(issues, product, "low", "首充金额未解析", "补充首充金额，导购解释时才能提前提示用户。");
    }

    if (product.disableArea.length >= 30) {
      pushIssue(issues, product, "low", "禁发区域较多", "确认是否适合作为首推，必要时降低 priority。");
    }
  }

  return issues.sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity] || a.productID - b.productID);
}

export function groupProductQualityIssues(issues: ProductQualityIssue[]) {
  const todos = new Map<number, ProductQualityTodo>();

  for (const issue of issues) {
    const current = todos.get(issue.productID);
    if (!current) {
      todos.set(issue.productID, {
        productID: issue.productID,
        productName: issue.productName,
        severity: issue.severity,
        issues: [issue.issue],
        suggestions: [issue.suggestion]
      });
      continue;
    }

    if (severityWeight[issue.severity] > severityWeight[current.severity]) {
      current.severity = issue.severity;
    }

    if (!current.issues.includes(issue.issue)) {
      current.issues.push(issue.issue);
    }

    if (!current.suggestions.includes(issue.suggestion)) {
      current.suggestions.push(issue.suggestion);
    }
  }

  return Array.from(todos.values()).sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity] || b.issues.length - a.issues.length || a.productID - b.productID);
}

export function getProductQualityStats(issues: ProductQualityIssue[]) {
  return issues.reduce(
    (result, issue) => {
      result[issue.severity] += 1;
      result.total += 1;
      return result;
    },
    { high: 0, medium: 0, low: 0, total: 0 }
  );
}
