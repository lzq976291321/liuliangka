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

## 172 账号配置

172 账号由项目内配置文件管理，不依赖 Netlify 服务器环境变量：

```txt
config/haoka172-accounts.json
```

配置结构：

```json
{
  "defaultAccountId": "default",
  "accounts": [
    {
      "id": "default",
      "name": "默认 172 账号",
      "productUserId": "172 商品接口 user_id",
      "productSecret": "172 商品接口 secret",
      "orderUserId": "172 办理页 userid"
    }
  ]
}
```

后续有多个 172 用户时，在 `accounts` 里继续追加账号，并按需要调整 `defaultAccountId`。

可以尝试从 Netlify 现有变量导入：

```bash
npm run import:netlify-config -- --context production --account default --order-user-id 172办理页userid
```

如果 Netlify 返回的是脱敏 secret，脚本会拒绝写入，需要手动把真实 `productSecret` 填到 `config/haoka172-accounts.json`。

## 商品同步

商品数据来自上游接口。

验证密钥：

```bash
npm run check:products
```

手动同步商品：

```bash
npm run sync:products -- --force
```

指定账号同步：

```bash
npm run sync:products -- --force --account default
```

同步脚本会写入：

- `.data/haoka172-products-snapshot.json`
- `.data/haoka172-product-events.jsonl`

## 部署

部署只保留 Netlify：

1. 提交代码并推送到 `main`
2. Netlify 自动执行 `npm run build:netlify`
3. 构建前先同步商品快照，再构建 Next.js

生产地址：

```txt
https://liuliangka.netlify.app
```

172 账号和渠道参数都由项目文件管理，Netlify UI 不需要再配置 `HAOKA172_USER_ID`、`HAOKA172_SECRET`、`HAOKA172_ORDER_USER_ID` 或 `NEXT_PUBLIC_CHANNEL_CONFIG_JSON`。

`build:netlify` 会先强制同步商品。如果接口签名错误或上游不可用，构建会失败，避免发布空数据或错误商品。

## 低配版渠道归因

给渠道生成专属链接：

```txt
https://liuliangka.netlify.app?channel=zhangsan
https://liuliangka.netlify.app?agent_id=10001
https://liuliangka.netlify.app?invite=abc123
```

用户进入网站后，渠道码会写入 `localStorage`。后续筛选、刷新、进入商品详情页，再点击办理时，系统会按配置替换 172 办理链接里的推广参数。

渠道配置在项目文件里：

```txt
config/channel-config.json
```

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
