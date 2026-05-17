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
```

未配置时，应用会使用本地样例套餐，方便先完善页面和转化链路。
