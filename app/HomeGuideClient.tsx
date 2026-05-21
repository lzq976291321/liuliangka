"use client";

import { ArrowRight, Bike, CheckCircle2, Gamepad2, GraduationCap, MapPin, PiggyBank, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { TrackButton } from "@/components/TrackButton";
import type { GuideRecommendation } from "@/lib/guide-recommendation";
import type { CardProduct, GuideIntent } from "@/lib/types";
import { getBrowserVisitorId } from "@/lib/visitor-id";

type HomeGuideClientProps = {
  initialRecommendations: GuideRecommendation[];
  initialEngine: string;
  initialRecommId?: string;
  stats: {
    total: number;
    recommendable: number;
    broadband: number;
    inactive: number;
    unknown: number;
  };
};

type RecommendApiResponse = {
  ok: boolean;
  engine: string;
  recommendations: GuideRecommendation[];
  recommId?: string;
  message?: string;
};

const scenes = [
  {
    label: "便宜副卡",
    value: "cheap",
    note: "月租优先",
    icon: PiggyBank,
    intent: { scene: "cheap", budget: 29, dataNeedGB: 150, needCallMinutes: false, preferLongTerm: false }
  },
  {
    label: "学生党",
    value: "student",
    note: "刷视频够用",
    icon: GraduationCap,
    intent: { scene: "student", budget: 29, dataNeedGB: 120, needCallMinutes: false, preferLongTerm: false }
  },
  {
    label: "长期主力",
    value: "long-term",
    note: "稳定少换",
    icon: ShieldCheck,
    intent: { scene: "long-term", dataNeedGB: 180, needCallMinutes: false, preferLongTerm: true }
  },
  {
    label: "外卖跑腿",
    value: "takeaway",
    note: "流量+通话",
    icon: Bike,
    intent: { scene: "takeaway", budget: 39, dataNeedGB: 180, needCallMinutes: true, preferLongTerm: false }
  },
  {
    label: "游戏热点",
    value: "gaming",
    note: "大流量",
    icon: Gamepad2,
    intent: { scene: "gaming", dataNeedGB: 220, needCallMinutes: false, preferLongTerm: false }
  }
] as const;

const cities = [
  { label: "深圳", value: "shenzhen" },
  { label: "广州", value: "guangzhou" },
  { label: "东莞", value: "dongguan" }
] as const;

const budgets = [19, 29, 39, 59] as const;

function getCityLabel(city?: string) {
  return cities.find((item) => item.value === city)?.label ?? "深圳";
}

function getSceneLabel(scene?: string) {
  return scenes.find((item) => item.value === scene)?.label ?? "长期主力";
}

function mergeIntent(base: GuideIntent, patch: GuideIntent): GuideIntent {
  return {
    ...base,
    ...patch,
    needCallMinutes: patch.needCallMinutes ?? base.needCallMinutes,
    preferLongTerm: patch.preferLongTerm ?? base.preferLongTerm,
    rawText: patch.rawText ?? base.rawText
  };
}

function productPitch(product: CardProduct) {
  const general = product.generalDataGB ? `其中通用约 ${product.generalDataGB}G` : "先按总流量判断";
  const call = product.callMinutes ? `含 ${product.callMinutes} 分钟通话` : "不主打通话";

  return `${product.monthlyRent}元/月，${product.dataGB}G，${general}，${call}。`;
}

export function HomeGuideClient({ initialRecommendations, initialEngine, initialRecommId, stats }: HomeGuideClientProps) {
  const requestIdRef = useRef(0);
  const [intent, setIntent] = useState<GuideIntent>({
    city: "shenzhen",
    scene: "long-term",
    budget: 39,
    dataNeedGB: 180,
    preferLongTerm: true,
    rawText: "我在深圳，想办一张 39 元以内的大流量卡，最好长期一点"
  });
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [engine, setEngine] = useState(initialEngine);
  const [recommId, setRecommId] = useState(initialRecommId);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const primary = recommendations[0];
  const alternatives = recommendations.slice(1);
  const selectedCity = getCityLabel(intent.city);
  const selectedScene = getSceneLabel(intent.scene);

  async function refreshRecommendations(nextIntent: GuideIntent) {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setPending(true);
    setMessage(undefined);

    const response = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: nextIntent,
        limit: 3,
        scenario: "home-guide",
        userId: getBrowserVisitorId()
      })
    }).catch(() => undefined);

    if (requestId !== requestIdRef.current) {
      return;
    }

    if (!response?.ok) {
      setMessage("推荐服务暂时不可用，先保留当前结果。");
      setPending(false);
      return;
    }

    const payload = (await response.json()) as RecommendApiResponse;
    if (requestId !== requestIdRef.current) {
      return;
    }

    if (payload.ok) {
      setRecommendations(payload.recommendations);
      setEngine(payload.engine);
      setRecommId(payload.recommId);
      setMessage(payload.message);
    }

    setPending(false);
  }

  function applyIntent(patch: GuideIntent) {
    setIntent((current) => {
      const next = mergeIntent(current, patch);
      void refreshRecommendations(next);
      return next;
    });
  }

  return (
    <section className="ai-guide simple-guide">
      <div className="ai-guide-main">
        <div className="ai-guide-copy">
          <span className="eyebrow">
            <Sparkles size={16} />
            智能选卡
          </span>
          <h1 className="ai-title">选三项，直接给你一张。</h1>
          <div className="guide-pool-row">
            <span>{stats.total} 个 172 商品</span>
            <span>{stats.recommendable} 张可推荐卡</span>
            <span>过滤宽带 {stats.broadband} 个</span>
          </div>
        </div>

        <div className="decision-steps">
          <div className="decision-step">
            <div className="step-head">
              <span>1</span>
              <strong>城市</strong>
            </div>
            <div className="choice-row">
              {cities.map((city) => (
                <button className={intent.city === city.value ? "choice-button active" : "choice-button"} key={city.value} onClick={() => applyIntent({ city: city.value })} type="button">
                  <MapPin size={16} />
                  {city.label}
                </button>
              ))}
            </div>
          </div>

          <div className="decision-step">
            <div className="step-head">
              <span>2</span>
              <strong>用途</strong>
            </div>
            <div className="scene-choice-grid">
              {scenes.map((scene) => {
                const SceneIcon = scene.icon;
                return (
                  <button className={intent.scene === scene.value ? "scene-choice active" : "scene-choice"} key={scene.value} onClick={() => applyIntent(scene.intent)} type="button">
                    <SceneIcon size={18} />
                    <b>{scene.label}</b>
                    <small>{scene.note}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="decision-step">
            <div className="step-head">
              <span>3</span>
              <strong>预算</strong>
            </div>
            <div className="choice-row">
              {budgets.map((budget) => (
                <button className={intent.budget === budget ? "choice-button active" : "choice-button"} key={budget} onClick={() => applyIntent({ budget })} type="button">
                  <WalletCards size={16} />
                  {budget}元内
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <aside className="guide-result">
        <div className="selection-ticket">
          <span>{selectedCity}</span>
          <span>{selectedScene}</span>
          <span>{intent.budget ?? 39}元内</span>
        </div>
        {message ? <p className="guide-message">{message}</p> : null}

        {primary ? (
          <article className="primary-result">
            <span className="tag green">
              <CheckCircle2 size={13} />
              {pending ? "匹配中" : `首推 ${primary.score}`}
            </span>
            <h2>{primary.product.productName}</h2>
            <p>{productPitch(primary.product)}</p>
            <div className="reason-list">
              {primary.reasons.slice(0, 4).map((reason) => (
                <span key={reason}>{reason}</span>
              ))}
            </div>
            <div className="risk-box">
              <b>
                <ShieldCheck size={16} />
                办理前确认
              </b>
              <ul>
                {primary.risks.slice(0, 3).map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </div>
            <div className="result-actions">
              <TrackButton
                engine={engine}
                productId={primary.product.productID}
                productName={primary.product.productName}
                recommId={recommId}
                href={primary.product.applyUrl}
                label="去办理"
                source="home_ai_guide"
              />
              <Link className="button" href={`/card/${primary.product.productID}`}>
                看详情
                <ArrowRight size={17} />
              </Link>
            </div>
          </article>
        ) : (
          <article className="primary-result">
            <h2>当前没有可推荐商品</h2>
            <p>可能是 172 接口未配置，或当前商品被过滤为宽带/下架/不可推荐。</p>
          </article>
        )}

        {alternatives.length ? (
          <div className="alternative-list">
            {alternatives.map((item) => (
              <Link className="alternative-card" href={`/card/${item.product.productID}`} key={item.product.productID}>
                <span>备选</span>
                <strong>{item.product.productName}</strong>
                <small>
                  {item.product.monthlyRent}元 / {item.product.dataGB}G / {item.product.operator}
                </small>
              </Link>
            ))}
          </div>
        ) : null}
      </aside>
    </section>
  );
}
