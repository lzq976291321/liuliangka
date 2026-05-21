# 本地流量卡推荐工具

一个面向消费者的 AI 选卡导购 MVP。第一版目标是跑通：

```txt
172 商品数据 -> 商品知识库 -> AI 感导购 -> 推荐解释 -> 办理点击追踪
```

现在首页优先是“直接说需求，系统推荐 1 张首推 + 2 张备选”，地区/场景页主要保留给 SEO 和内容投放。

## 推荐引擎

默认推荐引擎是本地规则兜底：

```bash
RECOMMENDATION_PROVIDER=local
```

要做 Recombee PoC 时，配置：

```bash
RECOMMENDATION_PROVIDER=recombee
RECOMBEE_DATABASE_ID=你的Recombee数据库ID
RECOMBEE_PRIVATE_TOKEN=你的Recombee私有token
RECOMBEE_REGION=us-west # 可选，按 Recombee 后台数据库区域填写
```

架构边界：

```txt
本地商品知识库：负责商品事实、下架、宽带过滤、城市可办、风险解释
Recombee：只负责在候选商品池里排序
本地兜底：Recombee 未配置或请求失败时继续可用
```

同步商品到 Recombee：

```bash
npm run sync:recombee -- --dry-run
RECOMBEE_DATABASE_ID=xxx RECOMBEE_PRIVATE_TOKEN=xxx npm run sync:recombee
```

`sync:recombee` 会把当前商品知识库字段写成 Recombee item properties，包括 `active/category/cities/monthlyRent/dataGB/callMinutes/isLongTerm` 等。商品下架或不适合推荐时不会删除 Recombee item，只会用 `deleted=true` 标记，保留历史行为数据。

## 本地启动

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 172 接口配置

创建 `.env.local`：

```bash
HAOKA172_USER_ID=你的172登录账号
HAOKA172_SECRET=管理员提供的secret
NEXT_PUBLIC_SITE_URL=https://liuliangka.netlify.app
```

未配置时，应用会使用本地样例套餐，方便先完善页面和转化链路。

## 投放工作台

访问 `/ops` 查看第一轮关键词、主推套餐和渠道 UTM 链接。

访问 `/content` 生成知乎回答、小红书笔记、短视频口播、FAQ、SEO 文案和渠道链接。

访问 `/poster/shenzhen` 这类页面查看可截图海报，支持的 slug 来自 `lib/scenarios.ts`。

## 部署入口

正式入口优先使用 Netlify：`https://liuliangka.netlify.app`。

Vercel 保留为预览环境，不作为国内流量投放入口。

Netlify 构建使用：

```bash
npm run build:with-haoka172
```

这个命令会先同步一次 172 商品快照，再禁用构建期实时拉取，避免静态生成几百个页面时重复请求 172。同步失败时构建会失败，避免上线样例数据或过期商品池。

点击追踪默认在本地写入 `.data/events.jsonl`，线上环境建议配置：

```bash
TRACK_WEBHOOK_URL=你的点击事件接收地址
TRACK_WEBHOOK_SECRET=可选的校验密钥
```

## 商品知识库思路

172 是商品事实来源，但不会直接进入推荐。应用会先做：

```txt
172 原始商品
-> 字段容错和标准化
-> 品类识别，过滤宽带/未知/下架商品
-> 月租、流量、通话、首充、长期属性解析
-> 场景、地区、风险和人工 overrides 合并
-> 导购推荐
```

其中人工补充项放在 `lib/product-overrides.ts`。AI 导购只负责理解用户需求和解释推荐，不负责编造套餐事实。

## 验证 172 密钥

```bash
HAOKA172_USER_ID=你的172账号 HAOKA172_SECRET=管理员给的secret npm run check:haoka172
```

成功时会输出接口 `code`、商品数量和前 3 个商品。

## 同步和监听商品变化

本地最小监听脚本：

```bash
HAOKA172_USER_ID=你的172账号 HAOKA172_SECRET=管理员给的secret npm run sync:haoka172
```

脚本会写入：

- `.data/haoka172-products-snapshot.json`：全量商品历史快照
- `.data/haoka172-product-events.jsonl`：新增、消失、重新出现、上下架、字段变化事件

状态规则：

```txt
active：接口返回且 flag 为 true
inactive：接口返回但 flag 为 false
missing：本次接口没返回，疑似消失
inactive_missing：连续多次没返回，按下架处理
```

默认连续 3 次缺失后标记为 `inactive_missing`，可用 `HAOKA172_MISSING_INACTIVE_THRESHOLD` 调整。

## 172 限流策略

已观察到 172 商品接口存在频率限制：

```txt
访问过于频繁，1分钟不能超过5次
```

当前应对策略：

- 前台优先读取 `.data/haoka172-products-snapshot.json`，快照新鲜时不直接请求 172。
- `npm run sync:haoka172` 默认 30 分钟内不会重复同步，可用 `HAOKA172_SYNC_MIN_INTERVAL_SECONDS` 调整。
- 真正需要手动刷新时使用 `npm run sync:haoka172 -- --force`。
- 请求 172 时设置超时、429/5xx 退避重试，并尊重 `Retry-After` 响应头。
- 构建命令使用 `HAOKA172_DISABLE_LIVE_FETCH=1`，避免构建期因为多页面静态生成触发限流。
- 如果快照不存在且禁用实时拉取，应用会回退本地样例数据；正式部署应使用 `build:with-haoka172`，让同步失败直接阻断发布。

关键环境变量：

```bash
HAOKA172_CACHE_TTL_SECONDS=3600
HAOKA172_SNAPSHOT_MAX_AGE_SECONDS=7200
HAOKA172_SYNC_MIN_INTERVAL_SECONDS=1800
HAOKA172_TIMEOUT_MS=8000
HAOKA172_MAX_RETRIES=2
```
