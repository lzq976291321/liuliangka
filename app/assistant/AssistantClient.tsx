"use client";

import { Bot, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { rankProducts } from "@/lib/recommendation";
import type { CardProduct, Operator } from "@/lib/types";

type AssistantClientProps = {
  products: CardProduct[];
};

const cityOptions = [
  { label: "深圳", value: "shenzhen" },
  { label: "广州", value: "guangzhou" },
  { label: "东莞", value: "dongguan" }
];

const sceneOptions = [
  { label: "低月租", value: "cheap" },
  { label: "学生党", value: "student" },
  { label: "长期主力卡", value: "long-term" },
  { label: "打游戏", value: "gaming" },
  { label: "外卖跑腿", value: "takeaway" },
  { label: "直播短视频", value: "live-stream" }
];

export function AssistantClient({ products }: AssistantClientProps) {
  const [city, setCity] = useState("shenzhen");
  const [scene, setScene] = useState("cheap");
  const [budget, setBudget] = useState(39);
  const [dataNeedGB, setDataNeedGB] = useState(180);
  const [operator, setOperator] = useState<Operator | "不限">("不限");
  const [age, setAge] = useState(24);

  const ranked = useMemo(
    () => rankProducts(products, { city, scene, budget, dataNeedGB, operator, age }).slice(0, 4),
    [age, budget, city, dataNeedGB, operator, products, scene]
  );

  return (
    <div className="assistant-grid">
      <section className="assistant-panel">
        <div className="section-header">
          <div>
            <h2 className="section-title">选号条件</h2>
            <p className="section-note">输入城市、预算、流量需求和使用场景，系统会按推荐分排序。</p>
          </div>
          <SlidersHorizontal size={28} />
        </div>
        <form className="form-grid">
          <div className="field">
            <label htmlFor="city">城市</label>
            <select id="city" value={city} onChange={(event) => setCity(event.target.value)}>
              {cityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="scene">使用场景</label>
            <select id="scene" value={scene} onChange={(event) => setScene(event.target.value)}>
              {sceneOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="budget">月预算</label>
            <input id="budget" min={19} max={99} type="number" value={budget} onChange={(event) => setBudget(Number(event.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="dataNeed">每月流量需求 G</label>
            <input id="dataNeed" min={30} max={500} type="number" value={dataNeedGB} onChange={(event) => setDataNeedGB(Number(event.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="operator">运营商偏好</label>
            <select id="operator" value={operator} onChange={(event) => setOperator(event.target.value as Operator | "不限")}>
              <option value="不限">不限</option>
              <option value="移动">移动</option>
              <option value="联通">联通</option>
              <option value="电信">电信</option>
              <option value="广电">广电</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="age">年龄</label>
            <input id="age" min={16} max={80} type="number" value={age} onChange={(event) => setAge(Number(event.target.value))} />
          </div>
        </form>
      </section>

      <section>
        <div className="section-header">
          <div>
            <span className="eyebrow">
              <Bot size={16} />
              智能匹配结果
            </span>
            <h1 className="section-title" style={{ marginTop: 12 }}>
              推荐这几张先测转化
            </h1>
          </div>
        </div>
        <div className="result-stack">
          {ranked.map(({ product, result }) => (
            <ProductCard key={product.productID} product={product} reasons={result.reasons} score={result.score} />
          ))}
        </div>
      </section>
    </div>
  );
}
