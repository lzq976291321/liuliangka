# 流量卡筛选办理

面向消费者的流量卡商品列表页。当前生产版本只保留三个核心能力：

- 展示当前可办理商品
- 按月租、通用流量、地区、周期、人群、运营商筛选
- 在弹窗 iframe 内打开办理页，并记录办理点击

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
```

`build:netlify` 会先强制同步商品。如果接口签名错误或上游不可用，构建会失败，避免发布空数据或错误商品。

## 运行策略

- 前台优先读取商品快照，减少上游接口请求。
- 构建期设置 `HAOKA172_DISABLE_LIVE_FETCH=1`，避免页面生成时重复请求。
- 商品缺少真实办理入口时不会展示在首页和 sitemap。
- 本地无密钥且没有快照时返回空商品，不再使用模拟商品数据。
- 点击事件默认写入本地 `.data/events.jsonl`，线上可通过 `TRACK_WEBHOOK_URL` 转发。
