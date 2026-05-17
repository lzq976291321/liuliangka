# 本地流量卡推荐工具

一个面向地区/场景流量卡推荐的 MVP。第一版目标是跑通：

```txt
172 商品数据 -> 推荐评分 -> 地区/场景页面 -> 详情页 -> 办理点击追踪
```

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
NEXT_PUBLIC_SITE_URL=https://liuliangka-blue.vercel.app
```

未配置时，应用会使用本地样例套餐，方便先完善页面和转化链路。

## 投放工作台

访问 `/ops` 查看第一轮关键词、主推套餐和渠道 UTM 链接。

访问 `/content` 生成知乎回答、小红书笔记、短视频口播、FAQ、SEO 文案和渠道链接。

访问 `/poster/shenzhen` 这类页面查看可截图海报，支持的 slug 来自 `lib/scenarios.ts`。

点击追踪默认在本地写入 `.data/events.jsonl`，线上环境建议配置：

```bash
TRACK_WEBHOOK_URL=你的点击事件接收地址
TRACK_WEBHOOK_SECRET=可选的校验密钥
```
