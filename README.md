# 流量卡筛选办理

面向消费者的流量卡商品列表页。当前代码包含以下能力：

- 展示当前可办理商品
- 按月租、通用流量、号码归属地、周期、运营商筛选
- 根据收货省市与准确年龄排除已知不能办理的套餐，未知条件明确待确认
- 选择 2–3 张卡，对比月租、优惠结束后月租、通用/定向流量、首充、期限与办理规则
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

部署只保留 Netlify。当前需要保留本地历史快照，使用以下发布命令：

```bash
npm run deploy:netlify
```

命令会按生产配置同步数据并构建，执行静态目录预检，再上传 `.netlify/static` 和服务端函数。对应代码提交使用 `[skip netlify]` 并推送到 `main`，避免另一次干净云构建覆盖本地快照。

生产地址：

```txt
https://liuliangka.netlify.app
```

172 账号和渠道参数都由项目文件管理，Netlify UI 不需要再配置 `HAOKA172_USER_ID`、`HAOKA172_SECRET`、`HAOKA172_ORDER_USER_ID` 或 `NEXT_PUBLIC_CHANNEL_CONFIG_JSON`。

`build:netlify` 会先强制同步商品。如果接口签名错误或上游不可用，构建会失败，避免发布空数据或错误商品。

`.data` 不进 Git，干净云构建只能取得上游当次返回的数据，不能自动恢复本地历史条目。`netlify build` 结束后，Next.js 插件会把 `.next` 恢复为包含服务端源码和配置的构建目录；绝不能将它直接用于 `--no-build` 静态上传。拆分构建与上传时必须显式指定 `--dir .netlify/static`。

`npm run check:publish` 会拒绝服务端目录、环境变量文件、配置文件、符号链接和密钥内容。发布后核对生产域名、部署版本、`/api/catalog`、实际浏览器筛选流程，并确认服务端文件路径不可公开访问。

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

## 套餐校验与办理条件

首页、详情和其他套餐统一通过 `getValidatedProduct` 合并商品资料与办理接口。缺失、空字符串和无效数值不会补成默认价格、流量或年龄；明确的 0 保留。总流量不作为通用流量，优惠期限不明确时不进入长期或短期筛选。两份月租不一致时将月租标记为待确认，不进入价格区间筛选；明确月均、预付金额和计费周期分别保存。其他字段保留来源及冲突提示。

号码归属地与收货地分别筛选。填写收货省市和年龄后，禁发地区、明确仅发范围以及年龄限制优先判断；缺少依据、未收录城市、复杂条款或资料冲突都标记待确认。勾选“只看已知条件符合的套餐”会排除待确认项，判断仅覆盖用户填写的条件。详情页修改条件后，其他套餐同步重算。省市使用联动选择，地区数据版本见 `data/china-regions.sources.md`。条件通过 URL 和本标签页的 sessionStorage 在列表、详情和刷新间保留；显式 URL 条件优先，清空不会恢复旧条件。

对比最多选择 3 张、至少 2 张，默认仅显示不同项，可切换全部。手机横向滚动时保留表头和项目名称，长条款可展开。变更条件后已选项仍保留在对比中，但已知不符合的套餐无法从对比或详情继续办理。首充可能计入话费余额，因此不会直接与月租相加生成总费用。

## 本地检查

```bash
npm test
npm run typecheck
npm run lint
HAOKA172_DISABLE_LIVE_FETCH=1 npm run build
```

最后一条命令使用本地快照验证构建，不刷新商品、不部署。查看本地已有数据可运行 `HAOKA172_DISABLE_LIVE_FETCH=1 npm run dev`。超过 30 分钟或缺少更新时间的资料会提示待更新核对；本地旧快照不能证明当前仍可办理。生产构建继续使用 `build:netlify` 的同步流程。

## 列表恢复、加载与埋点

首页服务端先输出 12 张卡，进入后通过 `/api/catalog` 获取完整筛选资料，每次加载更多增加 24 张。完整数据未到达前不把局部结果当成完整总数，也不产生无结果事件；接口失败保留已展示卡片并提供重试。筛选条件及已选对比写入 URL，本标签页同时保存已加载数量和滚动位置，返回列表或刷新可恢复。

首页 ISR 和两份来源缓存以 30 分钟为刷新周期，有访问时更新；生产环境需要部署这版代码后生效。任一来源刷新失败时整体回退到上次有效商品与办理目录，保留原时间，不把失败伪装成新资料。同步使用 `.data/haoka172-catalog-snapshot.json` 原子发布两份快照。来源未证明列表完整性时，未返回的历史条目继续保留并显示旧时间，明确下架才停用。

办理弹窗等待 10 秒后可手动重试，始终提供新窗口入口，不会自动刷新打断填写。跨域 iframe 的 load 仅移除加载遮罩，不能证明订单页面正常或办理成功。

新增 `catalog_zero_results`、`comparison_open`，沿用 `apply_click` 和 `channel_visit`。无结果事件只记录筛选类别和是否填写条件，不记录搜索内容、年龄或收货地。开发模式写 `.data/events.jsonl`；生产写运行日志，可配置现有 webhook 转发。未配置持久化接收服务时，不承诺生产事件长期保存。汇总命令：

```bash
npm run report:funnel
npm run report:funnel -- /path/to/exported-events.jsonl
```

这些是独立事件计数，点击办理不代表提交订单或激活成功。

## 数据源核验

```bash
npm run audit:sources
npm run audit:sources -- --sync
npm run audit:sources -- --snapshot
```

审计会读取真实商品和办理接口，报告 HTTP/业务状态、ID 对齐、缺失/冲突和更新时间，脱敏结果保存在 `.data/source-audit.json`。加 `--sync` 会先备份本地有效快照，两份来源验证通过后再原子更新；不部署。`--snapshot` 只按当前解析规则重算已核验快照的统计，保留上次源检查时间，不访问上游或伪造新同步时间。账号、签名和带推广参数的完整链接不写入审计报告。
