import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { BarChart3, ExternalLink, Flame, Link2, Radar, Route as RouteIcon, Signal, Target } from "lucide-react";
import { channelConfigs, getCampaignUrl } from "@/lib/campaign";
import { getAllProducts } from "@/lib/haoka172";
import { rankProducts } from "@/lib/recommendation";
import { scenarioConfigs } from "@/lib/scenarios";

export const metadata: Metadata = {
  title: "投放工作台",
  description: "按套餐、关键词、场景和渠道生成第一轮流量卡内容投放清单。"
};

export default async function OpsPage() {
  const products = await getAllProducts();
  const liveSource = Boolean(process.env.HAOKA172_USER_ID && process.env.HAOKA172_SECRET);
  const globalRanked = rankProducts(products, { budget: 39, dataNeedGB: 180 }).slice(0, 5);
  const topProduct = globalRanked[0];
  const highCommissionCount = products.filter((product) => product.commission >= 200).length;

  const launchItems = scenarioConfigs
    .map((scenario) => {
      const ranked = rankProducts(products, scenario.context).slice(0, 3);
      const primary = ranked[0];
      const path = `/liuliangka/${scenario.slug}`;
      const priorityScore = (primary?.result.score ?? 0) + (scenario.slug === "shenzhen" ? 8 : 0) + (scenario.slug === "cheap" ? 6 : 0);

      return {
        scenario,
        ranked,
        primary,
        path,
        priorityScore
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
  const firstLaunchPath = (launchItems[0]?.path ?? "/liuliangka/shenzhen") as Route;

  return (
    <main className="page">
      <section className="ops-hero">
        <div className="ops-hero-main">
          <span className="eyebrow">
            <Signal size={16} />
            第一轮投放
          </span>
          <h1 className="hero-title">先跑 8 个关键词，找到第一张能出单的卡。</h1>
          <p className="hero-copy">
            当前阶段不要扩成大平台，先用地区词、低月租词、学生词把点击和办理入口跑起来，每个入口都带 UTM，后面按点击和订单回传加码。
          </p>
          <div className="hero-actions">
            <Link className="button primary" href={firstLaunchPath}>
              打开优先页面
              <ExternalLink size={17} />
            </Link>
            <Link className="button" href="/assistant">
              <Radar size={17} />
              重新选品
            </Link>
            <Link className="button" href="/content">
              内容工厂
              <ExternalLink size={17} />
            </Link>
          </div>
        </div>
        <aside className="ops-signal-board">
          <div className="ops-metric">
            <span>数据源</span>
            <strong>{liveSource ? "172接口" : "样例数据"}</strong>
          </div>
          <div className="ops-metric">
            <span>可投页面</span>
            <strong>{scenarioConfigs.length}</strong>
          </div>
          <div className="ops-metric">
            <span>套餐池</span>
            <strong>{products.length}</strong>
          </div>
          <div className="ops-metric">
            <span>高佣候选</span>
            <strong>{highCommissionCount}</strong>
          </div>
        </aside>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">72 小时投放顺序</h2>
            <p className="section-note">先从强意图词开始，内容只做一件事：把用户引到对应场景页，再追踪办理点击。</p>
          </div>
          <span className="tag green">
            <Target size={13} />
            今日执行
          </span>
        </div>
        <div className="ops-table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>优先级</th>
                <th>关键词</th>
                <th>主推套餐</th>
                <th>推荐逻辑</th>
                <th>渠道链接</th>
              </tr>
            </thead>
            <tbody>
              {launchItems.map((item, index) => (
                <tr key={item.scenario.slug}>
                  <td>
                    <span className="priority-rank">{index + 1}</span>
                  </td>
                  <td>
                    <strong>{item.scenario.keyword}</strong>
                    <br />
                    <Link className="inline-link" href={item.path as Route}>
                      {item.scenario.title}
                    </Link>
                  </td>
                  <td>
                    {item.primary ? (
                      <>
                        <strong>{item.primary.product.productName}</strong>
                        <br />
                        {item.primary.product.monthlyRent}元 / {item.primary.product.dataGB}G / {item.primary.product.operator}
                      </>
                    ) : (
                      "暂无套餐"
                    )}
                  </td>
                  <td>{item.primary?.result.reasons.join(" / ") || "等待真实商品补齐"}</td>
                  <td>
                    <div className="campaign-links">
                      {channelConfigs.map((channel) => (
                        <a
                          className="button small"
                          href={getCampaignUrl(item.path, channel.source, item.scenario.slug, String(item.primary?.product.productID ?? "none"))}
                          key={channel.source}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {channel.label}
                          <Link2 size={14} />
                        </a>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section ops-grid">
        <div className="ops-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">选品雷达</h2>
              <p className="section-note">先把推荐分最高的卡放进内容入口，等真实订单数据回来再替换权重。</p>
            </div>
            <BarChart3 size={28} />
          </div>
          <div className="radar-list">
            {globalRanked.map(({ product, result }) => (
              <Link className="radar-row" href={`/card/${product.productID}`} key={product.productID}>
                <div>
                  <strong>{product.productName}</strong>
                  <span>
                    {product.monthlyRent}元 / {product.dataGB}G / 佣金{product.commission || "待补"}
                  </span>
                </div>
                <div className="score-meter" aria-label={`推荐分 ${result.score}`}>
                  <span style={{ width: `${result.score}%` }} />
                </div>
                <b>{result.score}</b>
              </Link>
            ))}
          </div>
        </div>

        <div className="ops-panel">
          <div className="section-header">
            <div>
              <h2 className="section-title">渠道打法</h2>
              <p className="section-note">同一个场景页配三套入口，点击会记录来源和 campaign。</p>
            </div>
            <RouteIcon size={28} />
          </div>
          <div className="channel-list">
            {channelConfigs.map((channel) => (
              <div className="channel-row" key={channel.source}>
                <span className="tag amber">{channel.label}</span>
                <strong>{channel.play}</strong>
                <p>{channel.angle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="ops-panel action-strip">
          <div>
            <span className="eyebrow">
              <Flame size={16} />
              下一步只看转化
            </span>
            <h2 className="section-title">本周判断标准</h2>
          </div>
          <div className="action-list">
            <span>页面收录</span>
            <span>渠道点击</span>
            <span>办理点击</span>
            <span>{topProduct ? `主推 ${topProduct.product.productName}` : "等待商品"}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
