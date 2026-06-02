# 流量卡筛选办理

面向消费者的流量卡商品列表页。当前生产版本只保留三个核心能力：

- 展示当前可办理商品
- 按月租、通用流量、地区、周期、人群、运营商筛选
- 在弹窗 iframe 内打开办理页，并记录办理点击
- 支持低配版渠道归因，把专属链接里的渠道码转换成 172 推广参数

## 本地启动

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 商品同步

商品数据来自上游接口。创建 `.env.local`：

```bash
HAOKA172_USER_ID=你的账号
HAOKA172_SECRET=管理员提供的 secret
HAOKA172_ORDER_USER_ID=办理页用户 ID
NEXT_PUBLIC_SITE_URL=https://liuliangka.netlify.app
NEXT_PUBLIC_CHANNEL_CONFIG_JSON='{"zhangsan":{"name":"张三","orderUserId":"172给张三的userid"}}'
```

验证密钥：

```bash
npm run check:products
```

手动同步商品：

```bash
npm run sync:products -- --force
```

同步脚本会写入：

- `.data/haoka172-products-snapshot.json`
- `.data/haoka172-product-events.jsonl`

## Netlify 部署

部署只走 GitHub -> Netlify：

1. 提交代码并推送到 `main`
2. Netlify 自动执行 `npm run build:netlify`
3. 构建前先同步商品快照，再构建 Next.js

生产地址：

```txt
https://liuliangka.netlify.app
```

Netlify 生产环境需要配置：

```bash
HAOKA172_USER_ID
HAOKA172_SECRET
HAOKA172_ORDER_USER_ID
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_CHANNEL_CONFIG_JSON
```

`build:netlify` 会先强制同步商品。如果接口签名错误或上游不可用，构建会失败，避免发布空数据或错误商品。

## 低配版渠道归因

给渠道生成专属链接：

```txt
https://liuliangka.netlify.app?channel=zhangsan
https://liuliangka.netlify.app?agent_id=10001
https://liuliangka.netlify.app?invite=abc123
```

用户进入网站后，渠道码会写入 `localStorage`。后续筛选、刷新、进入商品详情页，再点击办理时，系统会按配置替换 172 办理链接里的推广参数。

配置渠道有两种方式：

1. 改 `lib/channel-attribution.ts` 里的 `staticChannelConfigs`
2. 在 Netlify 配置 `NEXT_PUBLIC_CHANNEL_CONFIG_JSON`

最常见配置是替换 172 链接里的 `userid`：

```json
{
  "zhangsan": {
    "name": "张三",
    "orderUserId": "172给张三的userid"
  }
}
```

如果 172 后续需要多个参数，可以用 `orderParams`：

```json
{
  "zhangsan": {
    "name": "张三",
    "orderParams": {
      "userid": "172给张三的userid",
      "agent_sn": "额外推广参数"
    }
  }
}
```

访问和办理点击会继续写入现有埋点，事件里会带上：

```txt
channel
channelKey
channelName
channelMatched
```

## 运行策略

- 前台优先读取商品快照，减少上游接口请求。
- 构建期设置 `HAOKA172_DISABLE_LIVE_FETCH=1`，避免页面生成时重复请求。
- 商品缺少真实办理入口时不会展示在首页和 sitemap。
- 本地无密钥且没有快照时返回空商品，不再使用模拟商品数据。
- 点击事件默认写入本地 `.data/events.jsonl`，线上可通过 `TRACK_WEBHOOK_URL` 转发。
